/**
 * Google Business Reviews — initial Customer Voice provider.
 * Maps existing google_business_reviews rows into ProviderEvidenceInput.
 * Does not change sync or reply engines.
 */

import type { CustomerVoiceProvider, CustomerVoiceProviderResult } from "@/lib/customer-voice/provider";
import type {
  CustomerVoiceProviderContext,
  ProviderEvidenceInput,
} from "@/lib/customer-voice/types";
import { CustomerVoiceProviderIds } from "@/lib/customer-voice/types";
import type { GoogleBusinessReview } from "@/lib/google-business/types";

export function mapGoogleReviewToEvidence(review: GoogleBusinessReview): ProviderEvidenceInput {
  return {
    externalId: review.id || review.google_review_id,
    occurredAt: review.review_created_at,
    rating: review.rating,
    text: review.comment?.trim() || (review.rating ? `${review.rating}-star review` : ""),
    language: "en",
    authorDisplayName: review.reviewer_name,
    metadata: {
      googleReviewId: review.google_review_id,
      replyStatus: review.reply_status,
    },
  };
}

export type GoogleReviewsLoader = (context: CustomerVoiceProviderContext) => Promise<GoogleBusinessReview[]>;

export function createGoogleBusinessReviewsProvider(
  loadReviews: GoogleReviewsLoader,
): CustomerVoiceProvider {
  return {
    id: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    label: "Google Business Reviews",
    async fetchEvidence(context): Promise<CustomerVoiceProviderResult> {
      const reviews = await loadReviews(context);
      const evidence = reviews
        .map(mapGoogleReviewToEvidence)
        .filter((item) => item.text.trim().length > 0);

      return {
        providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
        sourceLabel: "Google Business Reviews",
        fetchedAt: (context.now ?? new Date()).toISOString(),
        evidence,
        notes:
          evidence.length === 0
            ? ["No Google Business review text available for Customer Voice yet."]
            : undefined,
      };
    },
  };
}
