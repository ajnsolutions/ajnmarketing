export type RecommendationCreateContentResult = {
  content_approval_id: string;
  title: string;
  status: string;
  recommendation_status: string;
  reused: boolean;
};

export async function createRecommendationContentDraft(
  recommendationId: string
): Promise<{ result: RecommendationCreateContentResult | null; error?: string }> {
  const response = await fetch("/api/marketing-recommendations/create-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recommendation_id: recommendationId }),
  });

  const payload = (await response.json()) as RecommendationCreateContentResult & {
    error?: string;
  };

  if (!response.ok) {
    return {
      result: null,
      error: payload.error ?? "Unable to create a draft from this recommendation",
    };
  }

  return {
    result: {
      content_approval_id: payload.content_approval_id,
      title: payload.title,
      status: payload.status,
      recommendation_status: payload.recommendation_status,
      reused: payload.reused,
    },
  };
}
