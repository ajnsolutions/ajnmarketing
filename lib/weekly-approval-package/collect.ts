import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getContentApprovalsForUser } from "@/lib/content-approval/persistence";
import type { ContentApproval } from "@/lib/content-approval/types";
import { getUnansweredGoogleBusinessReviews } from "@/lib/google-business/persistence";
import type { GoogleBusinessReview } from "@/lib/google-business/types";
import { getRecommendationDecisionPackagesForApprovals } from "@/lib/recommendation-presentation/service";
import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";
import {
  classifyContentDraftKind,
  mapContentTypeToPlatform,
  platformLabel,
  truncateSummary,
} from "@/lib/weekly-approval-package/group";
import {
  WeeklyPackageItemKinds,
  WeeklyPackagePlatforms,
  type WeeklyPackageItem,
} from "@/lib/weekly-approval-package/types";

/**
 * Pending content drafts for the weekly package:
 * - recommendation-generated drafts (marketing_recommendation_id set), or
 * - GBP-related pending drafts (platform updates awaiting approval).
 * Hand-authored non-GBP pending items are included only when recommendation-linked.
 */
export function selectPendingApprovalsForWeeklyPackage(
  approvals: ContentApproval[]
): ContentApproval[] {
  return approvals.filter((approval) => {
    if (approval.status !== "pending") return false;
    if (approval.marketing_recommendation_id) return true;
    if (approval.source === "marketing_recommendation") return true;
    const platform = mapContentTypeToPlatform(approval.content_type);
    return platform === WeeklyPackagePlatforms.GOOGLE_BUSINESS_PROFILE;
  });
}

/** Pending AI review replies ready for owner review (draft with text). */
export function selectPendingReviewRepliesForWeeklyPackage(
  reviews: GoogleBusinessReview[]
): GoogleBusinessReview[] {
  return reviews.filter(
    (review) =>
      review.reply_status === "draft" &&
      Boolean(review.ai_draft_reply?.trim()) &&
      review.business_profile_id // tenant field present
  );
}

export async function collectWeeklyPackageItems(input: {
  userId: string;
  businessProfileId: string;
  supabase: SupabaseClient;
  buildItemReviewUrl: (itemId: string) => string;
}): Promise<WeeklyPackageItem[]> {
  const { userId, businessProfileId, supabase, buildItemReviewUrl } = input;

  const [allApprovals, unansweredReviews] = await Promise.all([
    getContentApprovalsForUser(supabase, userId),
    getUnansweredGoogleBusinessReviews(supabase, userId),
  ]);

  // Strict tenant filter even when RLS is bypassed (service-role callers).
  const tenantApprovals = allApprovals.filter(
    (a) => a.user_id === userId && a.business_profile_id === businessProfileId
  );
  const tenantReviews = unansweredReviews.filter(
    (r) => r.user_id === userId && r.business_profile_id === businessProfileId
  );

  const pendingApprovals = selectPendingApprovalsForWeeklyPackage(tenantApprovals);
  const pendingReplies = selectPendingReviewRepliesForWeeklyPackage(tenantReviews);

  const packagesByApprovalId = await getRecommendationDecisionPackagesForApprovals(
    userId,
    businessProfileId,
    pendingApprovals,
    supabase
  );

  const items: WeeklyPackageItem[] = [];

  for (const approval of pendingApprovals) {
    const pkg: ClientRecommendationDecisionPackage | undefined = packagesByApprovalId.get(
      approval.id
    );
    const platform = mapContentTypeToPlatform(approval.content_type);
    const kind = classifyContentDraftKind(approval.content_type);
    const itemId = `approval:${approval.id}`;

    items.push({
      id: itemId,
      kind,
      platform,
      platformLabel: platformLabel(platform),
      title: pkg?.title ?? approval.title,
      summary: truncateSummary(pkg?.generatedDraft?.content ?? approval.content),
      recommendationId: approval.marketing_recommendation_id,
      contentApprovalId: approval.id,
      reviewId: null,
      recommendationPackage: pkg ?? null,
      whyNow: pkg?.whyNow ?? null,
      expectedBenefit: pkg?.expectedBenefit ?? null,
      createdAt: approval.created_at,
      reviewUrl: buildItemReviewUrl(itemId),
      // Populated by the caller (generateWeeklyApprovalPackageForUser) once a recipient
      // email is known to bind the email-action token to -- see lib/email-actions.
      approveActionUrl: null,
      rejectActionUrl: null,
    });
  }

  for (const review of pendingReplies) {
    const itemId = `review:${review.id}`;
    const star = review.rating != null ? `${review.rating}-star` : "customer";
    const title = `Reply to ${star} review${review.reviewer_name ? ` from ${review.reviewer_name}` : ""}`;
    items.push({
      id: itemId,
      kind: WeeklyPackageItemKinds.REVIEW_REPLY,
      platform: WeeklyPackagePlatforms.REVIEW_REPLY,
      platformLabel: platformLabel(WeeklyPackagePlatforms.REVIEW_REPLY),
      title,
      summary: truncateSummary(review.ai_draft_reply ?? ""),
      recommendationId: null,
      contentApprovalId: null,
      reviewId: review.id,
      recommendationPackage: null,
      whyNow: "A customer left feedback that deserves a timely, professional reply.",
      expectedBenefit: "Strengthen local reputation and show customers you are listening.",
      createdAt: review.review_created_at ?? review.updated_at ?? review.created_at,
      reviewUrl: buildItemReviewUrl(itemId),
      // Review replies use a different mutation path (not patchContentApprovalForUser),
      // so they are explicitly out of scope for one-click email approve/reject.
      approveActionUrl: null,
      rejectActionUrl: null,
    });
  }

  return items;
}
