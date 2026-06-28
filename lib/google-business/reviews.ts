import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoogleLocationIds, starRatingToNumber } from "@/lib/google-business/auth";
import { GOOGLE_MY_BUSINESS_V4_BASE, googleApiFetch } from "@/lib/google-business/google-api";
import { upsertGoogleBusinessReview } from "@/lib/google-business/persistence";
import type { GoogleApiReview, GoogleBusinessLocation } from "@/lib/google-business/types";

function resolveReviewReplyStatus(review: GoogleApiReview): "unanswered" | "responded" {
  return review.reviewReply?.comment?.trim() ? "responded" : "unanswered";
}

export async function syncGoogleBusinessReviews(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    accessToken: string;
    location: GoogleBusinessLocation;
  }
): Promise<{ reviewsSynced: number; averageRating: number | null; reviewCount: number }> {
  const { accountId, locationId } = resolveGoogleLocationIds(input.location);

  let pageToken: string | undefined;
  let reviewsSynced = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  do {
    const url = new URL(
      `${GOOGLE_MY_BUSINESS_V4_BASE}/accounts/${accountId}/locations/${locationId}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await googleApiFetch<{
      reviews?: GoogleApiReview[];
      nextPageToken?: string;
      averageRating?: number;
      totalReviewCount?: number;
    }>(url.toString(), input.accessToken);

    for (const review of response.reviews ?? []) {
      const googleReviewId =
        review.reviewId ??
        review.name?.split("/").pop() ??
        `${locationId}-${review.createTime ?? reviewsSynced}`;

      const rating = starRatingToNumber(review.starRating);
      if (rating > 0) {
        ratingSum += rating;
        ratingCount += 1;
      }

      const saved = await upsertGoogleBusinessReview(supabase, {
        userId: input.userId,
        businessProfileId: input.businessProfileId,
        locationId: input.location.id,
        googleReviewId,
        reviewerName: review.reviewer?.displayName ?? null,
        reviewerPhotoUrl: review.reviewer?.profilePhotoUrl ?? null,
        rating: rating || 5,
        comment: review.comment ?? null,
        reviewReply: review.reviewReply?.comment ?? null,
        replyStatus: resolveReviewReplyStatus(review),
        googleReviewUrl: review.name
          ? `https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1s${encodeURIComponent(googleReviewId)}`
          : null,
        reviewCreatedAt: review.createTime ?? null,
        replyUpdatedAt: review.reviewReply?.updateTime ?? review.updateTime ?? null,
        rawJson: review as Record<string, unknown>,
      });

      if (saved) reviewsSynced += 1;
    }

    pageToken = response.nextPageToken;

    if (response.averageRating != null || response.totalReviewCount != null) {
      await supabase
        .from("google_business_locations")
        .update({
          average_rating: response.averageRating ?? null,
          review_count: response.totalReviewCount ?? ratingCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", input.location.id);
    }
  } while (pageToken);

  const averageRating =
    ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : null;

  return {
    reviewsSynced,
    averageRating,
    reviewCount: ratingCount,
  };
}
