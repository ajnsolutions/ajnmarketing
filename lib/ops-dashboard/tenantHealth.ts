import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomerSetupSnapshotForUser } from "@/lib/customer-setup/service";
import { inspectGoogleBusinessServerConfig } from "@/lib/google-business-profile/config";
import { PUBLIC_CONNECTION_COLUMNS } from "@/lib/google-business-profile/persistence";
import type { GoogleBusinessProfileConnectionPublic } from "@/lib/google-business-profile/types";
import { classifyGoogleBusinessConnectionReadOnly } from "@/lib/ops-dashboard/googleBusinessReadOnly";
import {
  APPROVAL_OVERDUE_HOURS,
  classifyTenantDimensions,
  worstTenantState,
  type TenantHealthState,
  type TenantHealthDimension,
} from "@/lib/ops-dashboard/tenantHealthClassify";

export {
  TenantHealthStates,
  APPROVAL_OVERDUE_HOURS,
  type TenantHealthState,
  type TenantHealthDimension,
} from "@/lib/ops-dashboard/tenantHealthClassify";

export type TenantHealthSnapshot = {
  businessProfileId: string;
  userId: string;
  businessName: string;
  onboardingCompleted: boolean;
  createdAt: string;
  overallState: TenantHealthState;
  dimensions: TenantHealthDimension[];
};

export type TenantHealthPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  tenants: TenantHealthSnapshot[];
};

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

type BusinessProfileRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  onboarding_completed: boolean;
  created_at: string;
};

/**
 * Bounded, paginated per-tenant operational health. Reuses the Phase 3B customer
 * setup snapshot and existing Google Business connection-status service for the two
 * dimensions that don't have cheap batch equivalents; batches publishing/approval/job
 * counts with single IN() queries so a page of N tenants issues O(1) count queries
 * plus O(N) snapshot/connection reads, not O(N) for every dimension.
 */
export async function getTenantOperationalHealthPage(
  supabase: SupabaseClient,
  options?: { page?: number; pageSize?: number; search?: string }
): Promise<TenantHealthPage> {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options?.pageSize ?? DEFAULT_PAGE_SIZE)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("business_profiles")
    .select("id, user_id, business_name, onboarding_completed, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = options?.search?.trim();
  if (search) {
    query = query.ilike("business_name", `%${search}%`);
  }

  const { data, count, error } = await query;
  if (error || !data) {
    return { page, pageSize, totalCount: 0, tenants: [] };
  }

  const rows = data as BusinessProfileRow[];
  const businessProfileIds = rows.map((r) => r.id);
  const userIds = rows.map((r) => r.user_id);

  // [Fix, PR #65 review] Reads only — never calls getGoogleBusinessProfileConnectionStatusForUser,
  // which will attempt a *live* Google token-refresh network call for any TTL-stale
  // "connected" row. That is correct for a customer's own single-page GBP view, but
  // would fire up to `pageSize` real provider calls as a side effect of an admin
  // merely opening this health page. batchGoogleConnections() below is a single
  // bounded query; classifyGoogleBusinessConnectionReadOnly() reuses the same pure
  // primitives the authoritative function uses, minus the network call.
  const gbpConfig = inspectGoogleBusinessServerConfig();

  const [publishingCounts, approvalCounts, jobFailureCounts, setupSnapshots, gbpConnections] =
    await Promise.all([
      batchPublishingCounts(supabase, businessProfileIds),
      batchApprovalCounts(supabase, businessProfileIds),
      batchRecentJobFailures(supabase, userIds),
      Promise.all(
        rows.map((r) =>
          getCustomerSetupSnapshotForUser(r.user_id, { supabaseClient: supabase }).catch(() => null)
        )
      ),
      batchGoogleConnections(supabase, userIds),
    ]);

  const tenants: TenantHealthSnapshot[] = rows.map((row, index) => {
    const gbp = classifyGoogleBusinessConnectionReadOnly(gbpConnections.get(row.user_id) ?? null, {
      oauthConfigured: gbpConfig.oauthConfigured,
      connectionStorageConfigured: gbpConfig.connectionStorageConfigured,
    });
    const dimensions = classifyTenantDimensions({
      setup: setupSnapshots[index],
      gbp,
      publishing: publishingCounts.get(row.id) ?? { failed: 0, queued: 0, retrying: 0 },
      approvals: approvalCounts.get(row.id) ?? { pending: 0, overdue: 0 },
      jobFailures: jobFailureCounts.get(row.user_id) ?? 0,
    });

    return {
      businessProfileId: row.id,
      userId: row.user_id,
      businessName: row.business_name?.trim() || "Unnamed business",
      onboardingCompleted: row.onboarding_completed,
      createdAt: row.created_at,
      overallState: worstTenantState(dimensions.map((d) => d.state)),
      dimensions,
    };
  });

  return { page, pageSize, totalCount: count ?? tenants.length, tenants };
}

async function batchPublishingCounts(
  supabase: SupabaseClient,
  businessProfileIds: string[]
): Promise<Map<string, { failed: number; queued: number; retrying: number }>> {
  const result = new Map<string, { failed: number; queued: number; retrying: number }>();
  if (businessProfileIds.length === 0) return result;

  const { data, error } = await supabase
    .from("publishing_jobs")
    .select("business_profile_id, status")
    .in("business_profile_id", businessProfileIds)
    .in("status", ["failed", "queued", "retrying"]);

  if (error || !data) return result;

  for (const row of data as { business_profile_id: string; status: string }[]) {
    const entry = result.get(row.business_profile_id) ?? { failed: 0, queued: 0, retrying: 0 };
    if (row.status === "failed") entry.failed += 1;
    else if (row.status === "queued") entry.queued += 1;
    else if (row.status === "retrying") entry.retrying += 1;
    result.set(row.business_profile_id, entry);
  }
  return result;
}

async function batchApprovalCounts(
  supabase: SupabaseClient,
  businessProfileIds: string[]
): Promise<Map<string, { pending: number; overdue: number }>> {
  const result = new Map<string, { pending: number; overdue: number }>();
  if (businessProfileIds.length === 0) return result;

  const { data, error } = await supabase
    .from("content_approvals")
    .select("business_profile_id, created_at")
    .in("business_profile_id", businessProfileIds)
    .eq("status", "pending");

  if (error || !data) return result;

  const overdueThreshold = Date.now() - APPROVAL_OVERDUE_HOURS * 60 * 60 * 1000;
  for (const row of data as { business_profile_id: string; created_at: string }[]) {
    const entry = result.get(row.business_profile_id) ?? { pending: 0, overdue: 0 };
    entry.pending += 1;
    if (new Date(row.created_at).getTime() < overdueThreshold) entry.overdue += 1;
    result.set(row.business_profile_id, entry);
  }
  return result;
}

async function batchGoogleConnections(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, GoogleBusinessProfileConnectionPublic>> {
  const result = new Map<string, GoogleBusinessProfileConnectionPublic>();
  if (userIds.length === 0) return result;

  const { data, error } = await supabase
    .from("google_business_profile_connections")
    .select(PUBLIC_CONNECTION_COLUMNS)
    .in("user_id", userIds);

  if (error || !data) return result;

  for (const row of data as unknown as GoogleBusinessProfileConnectionPublic[]) {
    result.set(row.user_id, row);
  }
  return result;
}

async function batchRecentJobFailures(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "failed")
    .gte("updated_at", since);

  if (error || !data) return result;

  for (const row of data as { user_id: string }[]) {
    result.set(row.user_id, (result.get(row.user_id) ?? 0) + 1);
  }
  return result;
}
