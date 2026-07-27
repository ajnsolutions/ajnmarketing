import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimSnapshotForUser } from "@/lib/business-discovery/continuation/service";
import { ContinuationErrorCodes, type ContinuationErrorResponse } from "@/lib/business-discovery/continuation/types";

export const runtime = "nodejs";

/**
 * Authenticated-only. Binds a valid snapshotReference to the current user.
 * Idempotent for the same user (repeat calls return the original claim
 * time); rejected as a conflict if a different user already claimed it.
 * Creates no account, business, or tenant record — only an in-memory claim.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: ContinuationErrorCodes.UNAUTHENTICATED, message: "Sign in to continue from a snapshot." } } satisfies ContinuationErrorResponse,
      { status: 401 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: { code: ContinuationErrorCodes.VALIDATION_FAILED, message: "Request must be application/json." } } satisfies ContinuationErrorResponse,
      { status: 415 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: ContinuationErrorCodes.VALIDATION_FAILED, message: "Invalid JSON body." } } satisfies ContinuationErrorResponse,
      { status: 400 }
    );
  }

  const snapshotReference = (body as { snapshotReference?: unknown })?.snapshotReference;
  const result = claimSnapshotForUser(user.id, snapshotReference);

  switch (result.status) {
    case "claimed":
      return NextResponse.json({ claimed: true, claimedAt: result.claimedAt });
    case "already_claimed_by_you":
      return NextResponse.json({ claimed: true, claimedAt: result.claimedAt, alreadyClaimed: true });
    case "claimed_by_another_user":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.CONFLICT, message: "This snapshot has already been claimed." } } satisfies ContinuationErrorResponse,
        { status: 409 }
      );
    case "invalid":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.VALIDATION_FAILED, message: "That snapshot reference isn't valid." } } satisfies ContinuationErrorResponse,
        { status: 400 }
      );
    case "not_found":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.NOT_FOUND, message: "We couldn't find that snapshot." } } satisfies ContinuationErrorResponse,
        { status: 404 }
      );
    case "expired":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.EXPIRED, message: "That snapshot has expired. Let's start fresh." } } satisfies ContinuationErrorResponse,
        { status: 410 }
      );
  }
}
