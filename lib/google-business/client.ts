import type {
  GoogleBusinessDashboardData,
  GoogleBusinessReview,
  GoogleBusinessSyncResult,
} from "@/lib/google-business/types";

export async function syncGoogleBusinessProfile(): Promise<{
  data: GoogleBusinessSyncResult;
  error?: string;
}> {
  const response = await fetch("/api/google-business/sync", { method: "POST" });
  const payload = (await response.json()) as GoogleBusinessSyncResult & { error?: string };

  if (!response.ok) {
    return {
      data: { success: false, syncLog: payload.syncLog ?? null },
      error: payload.error ?? "Unable to sync Google Business Profile data",
    };
  }

  return { data: payload };
}

export async function draftGoogleReviewReplyClient(reviewId: string): Promise<{
  review: GoogleBusinessReview | null;
  error?: string;
}> {
  const response = await fetch("/api/google-business/reviews/reply-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });

  const payload = (await response.json()) as {
    review?: GoogleBusinessReview | null;
    error?: string;
  };

  if (!response.ok) {
    return { review: null, error: payload.error ?? "Unable to draft review reply" };
  }

  return { review: payload.review ?? null };
}

export async function markGoogleReviewRespondedClient(reviewId: string): Promise<{
  review: GoogleBusinessReview | null;
  error?: string;
}> {
  const response = await fetch("/api/google-business/reviews/mark-responded", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });

  const payload = (await response.json()) as {
    review?: GoogleBusinessReview | null;
    error?: string;
  };

  if (!response.ok) {
    return { review: null, error: payload.error ?? "Unable to mark review responded" };
  }

  return { review: payload.review ?? null };
}

export type { GoogleBusinessDashboardData };
