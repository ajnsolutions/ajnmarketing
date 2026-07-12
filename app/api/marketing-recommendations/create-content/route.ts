import { NextResponse } from "next/server";
import { generateContentDraftForRecommendationForCurrentUser } from "@/lib/marketing-decisions/create-content";

type CreateContentBody = {
  recommendation_id?: string;
};

// Standard RFC 4122 shape (any version) -- matches whatever a real
// marketing_recommendations.id (a Postgres uuid column, populated by
// gen_random_uuid()) can ever legitimately look like. Rejecting anything else here,
// before any database access, means a malformed id can never reach a query and
// produce a raw "invalid input syntax for type uuid" Postgres error.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_ROUTE_FAILURE_MESSAGE = "Unable to create a draft from this recommendation. Please try again.";

export async function POST(request: Request) {
  try {
    let body: CreateContentBody;
    try {
      body = (await request.json()) as CreateContentBody;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const recommendationId = body.recommendation_id?.trim();

    if (!recommendationId) {
      return NextResponse.json({ error: "recommendation_id is required" }, { status: 400 });
    }

    if (!UUID_PATTERN.test(recommendationId)) {
      return NextResponse.json({ error: "recommendation_id must be a valid id" }, { status: 400 });
    }

    const { result, error } = await generateContentDraftForRecommendationForCurrentUser(
      recommendationId
    );

    if (error || !result) {
      // `error` here is already sanitized by generateContentDraftForRecommendation's
      // own SafeContentDraftError guarantee (see lib/marketing-decisions/create-content.ts)
      // -- never a raw Postgres/Supabase/internal message. Passed straight through.
      return NextResponse.json(
        { error: error ?? GENERIC_ROUTE_FAILURE_MESSAGE },
        { status: error === "Unauthorized" ? 401 : 502 }
      );
    }

    return NextResponse.json({
      content_approval_id: result.contentApproval.id,
      title: result.contentApproval.title,
      status: result.contentApproval.status,
      recommendation_status: result.recommendation.status,
      reused: result.reused,
    });
  } catch {
    // Top-level safety net: anything that escapes the checks and the injectable core
    // above (a truly unexpected exception -- every expected business-logic failure
    // already returns cleanly, without throwing, above) is replaced with a fixed,
    // generic message. This mirrors generateContentDraftForRecommendation's own
    // SafeContentDraftError guarantee (lib/marketing-decisions/create-content.ts):
    // an unconditional fallback, not pattern-based sanitization, because pattern
    // matching alone can't recognize every shape a raw Postgres/Supabase message
    // might take.
    return NextResponse.json({ error: GENERIC_ROUTE_FAILURE_MESSAGE }, { status: 502 });
  }
}
