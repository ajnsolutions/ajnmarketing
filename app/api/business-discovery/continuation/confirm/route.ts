import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitConfirmationsForUser } from "@/lib/business-discovery/continuation/service";
import { ContinuationErrorCodes, type ContinuationErrorResponse, type ConfirmationDecisionInput } from "@/lib/business-discovery/continuation/types";

export const runtime = "nodejs";

const MAX_NOTE_LENGTH = 500;

function parseDecisions(raw: unknown): ConfirmationDecisionInput[] | null {
  if (!Array.isArray(raw)) return null;

  const decisions: ConfirmationDecisionInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    if (typeof record.insightKey !== "string" || typeof record.decision !== "string") return null;
    if (record.note !== undefined && typeof record.note !== "string") return null;
    if (typeof record.note === "string" && record.note.length > MAX_NOTE_LENGTH) return null;

    decisions.push({
      insightKey: record.insightKey as ConfirmationDecisionInput["insightKey"],
      decision: record.decision as ConfirmationDecisionInput["decision"],
      correctedValue: record.correctedValue,
      note: typeof record.note === "string" ? record.note : undefined,
    });
  }
  return decisions;
}

/**
 * Authenticated-only. Requires the reference to already be claimed by the
 * calling user (see /claim) — submitting decisions on an unclaimed or
 * someone-else's-claimed reference is rejected, never silently allowed.
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

  const record = body as Record<string, unknown>;
  const decisions = parseDecisions(record.decisions);
  if (!decisions) {
    return NextResponse.json(
      { error: { code: ContinuationErrorCodes.VALIDATION_FAILED, message: "Invalid decisions." } } satisfies ContinuationErrorResponse,
      { status: 400 }
    );
  }

  const result = await submitConfirmationsForUser(supabase, user.id, record.snapshotReference, decisions);

  switch (result.status) {
    case "applied":
      return NextResponse.json({ records: result.records });
    case "not_claimed":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.NOT_CLAIMED, message: "Claim this snapshot before submitting decisions." } } satisfies ContinuationErrorResponse,
        { status: 403 }
      );
    case "claimed_by_another_user":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.CONFLICT, message: "This snapshot belongs to a different account." } } satisfies ContinuationErrorResponse,
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
    case "invalid_decisions":
      return NextResponse.json(
        { error: { code: ContinuationErrorCodes.VALIDATION_FAILED, message: result.errors.join(" ") } } satisfies ContinuationErrorResponse,
        { status: 400 }
      );
  }
}
