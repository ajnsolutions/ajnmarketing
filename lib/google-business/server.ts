import {
  draftGoogleReviewReplyForCurrentUser,
  getGoogleBusinessDashboardDataForCurrentUser,
  getGoogleBusinessHomeStatsForCurrentUser,
  markGoogleReviewRespondedForCurrentUser,
  syncGoogleBusinessForCurrentUser,
} from "@/lib/google-business/service";

export async function getGoogleBusinessDashboardData() {
  return getGoogleBusinessDashboardDataForCurrentUser();
}

export async function getGoogleBusinessHomeStats() {
  return getGoogleBusinessHomeStatsForCurrentUser();
}

export async function syncGoogleBusinessData() {
  return syncGoogleBusinessForCurrentUser();
}

export async function draftGoogleReviewReply(reviewId: string) {
  return draftGoogleReviewReplyForCurrentUser(reviewId);
}

export async function markGoogleReviewResponded(reviewId: string) {
  return markGoogleReviewRespondedForCurrentUser(reviewId);
}
