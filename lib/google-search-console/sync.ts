import "server-only";

import { querySearchAnalytics } from "@/lib/google-search-console/api";
import { getGoogleSearchConsoleAccessContextForUser } from "@/lib/google-search-console/auth";
import {
  completeSearchConsoleSyncLog,
  createSearchConsoleSyncLog,
  recordSearchConsoleConnectionFailureIfUnrecoverable,
  replaceCurrentSearchConsoleMetrics,
  updateSearchConsoleConnectionAfterSync,
} from "@/lib/google-search-console/persistence";
import type { GoogleSearchConsoleSyncResult, SearchAnalyticsApiRow } from "@/lib/google-search-console/types";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";

/** Google Search Console typically finalizes data ~2-3 days after the fact. */
const DATA_LAG_DAYS = 3;
const PERIOD_LENGTH_DAYS = 28;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number, from: Date): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export function computeSearchConsolePeriods(now: Date = new Date()): {
  current: { start: string; end: string };
  previous: { start: string; end: string };
} {
  const end = daysAgo(DATA_LAG_DAYS, now);
  const start = daysAgo(DATA_LAG_DAYS + PERIOD_LENGTH_DAYS, now);
  const previousEnd = daysAgo(DATA_LAG_DAYS + PERIOD_LENGTH_DAYS, now);
  const previousStart = daysAgo(DATA_LAG_DAYS + PERIOD_LENGTH_DAYS * 2, now);

  return {
    current: { start: isoDate(start), end: isoDate(end) },
    previous: { start: isoDate(previousStart), end: isoDate(previousEnd) },
  };
}

function toStoredRow(row: SearchAnalyticsApiRow): { value: string; clicks: number; impressions: number; ctr: number; position: number } {
  return {
    value: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

/**
 * Fetches query- and page-dimension Search Analytics for both the current and
 * comparison period, and stores normalized rows. Mirrors the shape of
 * lib/google-business/sync.ts::runGoogleBusinessSyncForUser (access context →
 * sync log → per-dimension fetch → persist → complete log), scoped to Search Console.
 */
export async function runGoogleSearchConsoleSyncForUser(input: {
  userId: string;
  businessProfileId: string;
}): Promise<GoogleSearchConsoleSyncResult> {
  const supabase = await createClient();

  let accessContext;
  try {
    accessContext = await getGoogleSearchConsoleAccessContextForUser(supabase, input.userId);
  } catch (error) {
    await logAuditEvent(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      action: AuditActions.SEARCH_CONSOLE_SYNC_FAILED,
      entityType: "google_search_console_connection",
      status: "failure",
      metadata: auditErrorMetadata(error, "Unable to authenticate with Google"),
    });

    return {
      success: false,
      syncLog: null,
      error: error instanceof Error ? error.message : "Unable to authenticate with Google",
    };
  }

  if (!accessContext) {
    return { success: false, syncLog: null, error: "Search Console is not connected." };
  }

  const siteUrl = accessContext.connection.selected_site_url;
  if (!siteUrl) {
    return { success: false, syncLog: null, error: "Select a Search Console property before syncing." };
  }

  const syncLog = await createSearchConsoleSyncLog(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    connectionId: accessContext.connection.id,
  });

  if (!syncLog) {
    return { success: false, syncLog: null, error: "Unable to start Search Console sync." };
  }

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action: AuditActions.SEARCH_CONSOLE_SYNC_STARTED,
    entityType: "google_search_console_sync_log",
    entityId: syncLog.id,
    status: "started",
    metadata: { connectionId: accessContext.connection.id, siteUrl },
  });

  const periods = computeSearchConsolePeriods();
  const errors: string[] = [];
  let queriesSynced = 0;
  let pagesSynced = 0;

  async function syncDimension(dimension: "query" | "page", period: "current" | "previous", range: { start: string; end: string }) {
    try {
      const rows = await querySearchAnalytics(accessContext!.accessToken, siteUrl!, {
        startDate: range.start,
        endDate: range.end,
        dimension,
      });

      await replaceCurrentSearchConsoleMetrics(supabase, {
        userId: input.userId,
        businessProfileId: input.businessProfileId,
        connectionId: accessContext!.connection.id,
        periodLabel: period,
        dimension,
        periodStart: range.start,
        periodEnd: range.end,
        rows: rows.map(toStoredRow),
      });

      if (dimension === "query" && period === "current") queriesSynced = rows.length;
      if (dimension === "page" && period === "current") pagesSynced = rows.length;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${dimension} (${period}) sync failed`);
      await recordSearchConsoleConnectionFailureIfUnrecoverable(supabase, input.userId, error);
    }
  }

  await syncDimension("query", "current", periods.current);
  await syncDimension("query", "previous", periods.previous);
  await syncDimension("page", "current", periods.current);
  await syncDimension("page", "previous", periods.previous);

  const syncStatus =
    errors.length === 0 ? "success" : queriesSynced > 0 || pagesSynced > 0 ? "partial" : "failed";

  if (syncStatus !== "failed") {
    await updateSearchConsoleConnectionAfterSync(supabase, input.userId);
  }

  const completedLog = await completeSearchConsoleSyncLog(supabase, syncLog.id, {
    syncStatus,
    queriesSynced,
    pagesSynced,
    errorMessage: errors.length > 0 ? errors.join(" | ") : null,
  });

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action: syncStatus === "failed" ? AuditActions.SEARCH_CONSOLE_SYNC_FAILED : AuditActions.SEARCH_CONSOLE_SYNC_COMPLETED,
    entityType: "google_search_console_sync_log",
    entityId: completedLog?.id ?? syncLog.id,
    status: syncStatus === "failed" ? "failure" : "success",
    metadata: {
      syncStatus,
      queriesSynced,
      pagesSynced,
      ...(errors.length > 0 ? auditErrorMetadata(errors.join(" | "), "Search Console sync encountered errors") : {}),
    },
  });

  return {
    success: syncStatus === "success" || syncStatus === "partial",
    syncLog: completedLog,
    error: errors.length > 0 ? errors.join(" | ") : undefined,
  };
}
