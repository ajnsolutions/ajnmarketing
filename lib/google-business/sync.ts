import "server-only";

import { syncGoogleBusinessInsights } from "@/lib/google-business/insights";
import { syncGoogleBusinessLocations } from "@/lib/google-business/locations";
import { syncGoogleBusinessPosts } from "@/lib/google-business/posts";
import {
  completeGoogleBusinessSyncLog,
  createGoogleBusinessSyncLog,
  updateGoogleBusinessConnectionAfterSync,
} from "@/lib/google-business/persistence";
import { syncGoogleBusinessReviews } from "@/lib/google-business/reviews";
import type { GoogleBusinessSyncResult } from "@/lib/google-business/types";
import { getGoogleAccessContextForUser } from "@/lib/google-business/auth";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";

/** Google Business is the first implementation of the shared marketing channel sync architecture. */
export async function runGoogleBusinessSyncForUser(input: {
  userId: string;
  businessProfileId: string;
}): Promise<GoogleBusinessSyncResult> {
  const supabase = await createClient();

  let accessContext;
  try {
    accessContext = await getGoogleAccessContextForUser(supabase, input.userId);
  } catch (error) {
    await logAuditEvent(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      action: AuditActions.GOOGLE_BUSINESS_SYNC_FAILED,
      entityType: "google_business_connection",
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
    return {
      success: false,
      syncLog: null,
      error: "Google Business Profile is not connected.",
    };
  }

  const syncLog = await createGoogleBusinessSyncLog(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    connectionId: accessContext.connection.id,
  });

  if (!syncLog) {
    return {
      success: false,
      syncLog: null,
      error: "Unable to start Google Business sync.",
    };
  }

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action: AuditActions.GOOGLE_BUSINESS_SYNC_STARTED,
    entityType: "google_business_sync_log",
    entityId: syncLog.id,
    status: "started",
    metadata: { connectionId: accessContext.connection.id },
  });

  const errors: string[] = [];
  let locationsSynced = 0;
  let reviewsSynced = 0;
  let postsSynced = 0;
  let insightsSynced = 0;

  try {
    const locationResult = await syncGoogleBusinessLocations(supabase, {
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      connectionId: accessContext.connection.id,
      accessToken: accessContext.accessToken,
    });

    locationsSynced = locationResult.locationsSynced;
    const primaryLocation = locationResult.primaryLocation;

    if (primaryLocation) {
      await updateGoogleBusinessConnectionAfterSync(supabase, accessContext.connection.id, {
        gbpAccountId: primaryLocation.google_account_id,
        gbpLocationId: primaryLocation.google_location_id,
        gbpLocationName: primaryLocation.location_title ?? primaryLocation.google_location_id,
      });

      try {
        const reviewResult = await syncGoogleBusinessReviews(supabase, {
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          accessToken: accessContext.accessToken,
          location: primaryLocation,
        });
        reviewsSynced = reviewResult.reviewsSynced;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Reviews sync failed");
      }

      try {
        postsSynced = await syncGoogleBusinessPosts(supabase, {
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          accessToken: accessContext.accessToken,
          location: primaryLocation,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Posts sync failed");
      }

      try {
        insightsSynced = await syncGoogleBusinessInsights(supabase, {
          userId: input.userId,
          businessProfileId: input.businessProfileId,
          accessToken: accessContext.accessToken,
          location: primaryLocation,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Insights sync failed");
      }
    } else {
      errors.push("No Google Business locations were found to sync.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Google Business sync failed");
  }

  const syncStatus =
    errors.length === 0
      ? "success"
      : locationsSynced > 0 || reviewsSynced > 0 || postsSynced > 0 || insightsSynced > 0
        ? "partial"
        : "failed";

  const completedLog = await completeGoogleBusinessSyncLog(supabase, syncLog.id, {
    syncStatus,
    locationsSynced,
    reviewsSynced,
    postsSynced,
    insightsSynced,
    errorMessage: errors.length > 0 ? errors.join(" | ") : null,
  });

  await logAuditEvent(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    action:
      syncStatus === "failed"
        ? AuditActions.GOOGLE_BUSINESS_SYNC_FAILED
        : AuditActions.GOOGLE_BUSINESS_SYNC_COMPLETED,
    entityType: "google_business_sync_log",
    entityId: completedLog?.id ?? syncLog.id,
    status: syncStatus === "failed" ? "failure" : "success",
    metadata: {
      syncStatus,
      locationsSynced,
      reviewsSynced,
      postsSynced,
      insightsSynced,
      ...(errors.length > 0
        ? auditErrorMetadata(errors.join(" | "), "Google Business sync encountered errors")
        : {}),
    },
  });

  return {
    success: syncStatus === "success" || syncStatus === "partial",
    syncLog: completedLog,
    error: errors.length > 0 ? errors.join(" | ") : undefined,
  };
}
