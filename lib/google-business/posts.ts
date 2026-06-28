import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoogleLocationIds } from "@/lib/google-business/auth";
import { GOOGLE_MY_BUSINESS_V4_BASE, googleApiFetch } from "@/lib/google-business/google-api";
import { upsertGoogleBusinessPost } from "@/lib/google-business/persistence";
import type { GoogleApiLocalPost, GoogleBusinessLocation, GoogleBusinessPostStatus } from "@/lib/google-business/types";

function mapGooglePostStatus(state: string | undefined): GoogleBusinessPostStatus {
  switch (state) {
    case "LIVE":
      return "published";
    case "SCHEDULED":
      return "scheduled";
    case "REJECTED":
      return "rejected";
    case "EXPIRED":
      return "expired";
    default:
      return "draft";
  }
}

export async function syncGoogleBusinessPosts(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    accessToken: string;
    location: GoogleBusinessLocation;
  }
): Promise<number> {
  const { accountId, locationId } = resolveGoogleLocationIds(input.location);

  let pageToken: string | undefined;
  let postsSynced = 0;

  do {
    const url = new URL(
      `${GOOGLE_MY_BUSINESS_V4_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`
    );
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await googleApiFetch<{
      localPosts?: GoogleApiLocalPost[];
      nextPageToken?: string;
    }>(url.toString(), input.accessToken);

    for (const post of response.localPosts ?? []) {
      const googlePostId =
        post.name?.split("/").pop() ??
        `${locationId}-${post.createTime ?? postsSynced}`;

      const saved = await upsertGoogleBusinessPost(supabase, {
        userId: input.userId,
        businessProfileId: input.businessProfileId,
        locationId: input.location.id,
        googlePostId,
        postType: post.topicType ?? "standard",
        status: mapGooglePostStatus(post.state),
        title: null,
        summary: post.summary ?? null,
        callToAction: post.callToAction?.actionType ?? null,
        mediaJson: post.media ?? [],
        publishTime: post.createTime ?? null,
        scheduledTime: post.state === "SCHEDULED" ? post.updateTime ?? null : null,
        rawJson: post as Record<string, unknown>,
      });

      if (saved) postsSynced += 1;
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return postsSynced;
}
