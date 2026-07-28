import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSnapshotForUser } from "@/lib/business-discovery/continuation/service";
import { ContinuationErrorCodes, type ContinuationErrorResponse } from "@/lib/business-discovery/continuation/types";

export const runtime = "nodejs";

/**
 * Authenticated-only. Resolves an opaque snapshotReference into its
 * public-safe content. Read-only — does not bind ownership (see /claim).
 *
 * Never accepts a URL or raw cached payload as a substitute for the
 * reference, never exposes an internal cache key or database identifier.
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
  const result = resolveSnapshotForUser(user.id, snapshotReference);

  switch (result.status) {
    case "resolved":
      return NextResponse.json({ snapshot: result.snapshot });
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
