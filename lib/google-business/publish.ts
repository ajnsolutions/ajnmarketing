import "server-only";

import {
  getGoogleAccessContextForUser,
  resolveGoogleLocationIds,
} from "@/lib/google-business/auth";
import { GOOGLE_MY_BUSINESS_V4_BASE, googleApiFetch } from "@/lib/google-business/google-api";
import {
  getPrimaryGoogleBusinessLocationForUser,
  upsertGoogleBusinessPost,
} from "@/lib/google-business/persistence";
import type { GoogleApiLocalPost } from "@/lib/google-business/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createGoogleBusinessLocalPost(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    summary: string;
    title?: string | null;
    publishingQueueId?: string;
    contentApprovalId?: string;
    topicType?: string;
  }
): Promise<{
  googlePostId: string;
  googlePostName: string;
  publishedAt: string;
  state: string;
  rawResponse: Record<string, unknown>;
  locationId: string;
}> {
  const access = await getGoogleAccessContextForUser(supabase, input.userId);
  if (!access) {
    throw new Error("Connect Google Business Profile before publishing.");
  }

  // Tenant safety: service-role callers must not publish via a mismatched business id.
  if (access.connection.business_profile_id !== input.businessProfileId) {
    throw new Error(
      "Google Business Profile connection does not match this business. Reconnect Google Business Profile."
    );
  }

  const location = await getPrimaryGoogleBusinessLocationForUser(
    supabase,
    input.userId,
    input.businessProfileId
  );
  if (!location) {
    throw new Error("Sync Google Business Profile locations before publishing.");
  }

  if (
    location.user_id !== input.userId ||
    location.business_profile_id !== input.businessProfileId
  ) {
    throw new Error(
      "Google Business Profile location does not match this business. Sync locations again."
    );
  }

  const { accountId, locationId } = resolveGoogleLocationIds(location);
  const url = `${GOOGLE_MY_BUSINESS_V4_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`;

  const payload = {
    languageCode: "en-US",
    summary: input.summary,
    topicType: input.topicType ?? "STANDARD",
  };

  const response = await googleApiFetch<GoogleApiLocalPost>(url, access.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const googlePostName = response.name ?? "";
  const googlePostId =
    googlePostName.split("/").pop() ??
    `${locationId}-${response.createTime ?? Date.now()}`;
  const publishedAt = response.createTime ?? new Date().toISOString();
  const state = response.state ?? "LIVE";

  await upsertGoogleBusinessPost(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    locationId: location.id,
    googlePostId,
    postType: response.topicType ?? "STANDARD",
    status: state === "LIVE" ? "published" : state === "SCHEDULED" ? "scheduled" : "draft",
    title: input.title ?? null,
    summary: input.summary,
    callToAction: response.callToAction?.actionType ?? null,
    mediaJson: response.media ?? [],
    publishTime: publishedAt,
    scheduledTime: state === "SCHEDULED" ? response.updateTime ?? null : null,
    rawJson: response as Record<string, unknown>,
    publishingQueueId: input.publishingQueueId ?? null,
    contentApprovalId: input.contentApprovalId ?? null,
    source: "google",
  });

  return {
    googlePostId,
    googlePostName,
    publishedAt,
    state,
    rawResponse: response as Record<string, unknown>,
    locationId: location.id,
  };
}
