import "server-only";

import type { OverrideType } from "@/lib/marketing-memory/preferenceTypes";

/**
 * Deterministic, server-computed idempotency keys for overrides — never trusted from
 * the client as the sole identity. Mirrors lib/marketing-memory/idempotency.ts.
 *
 * clientRequestId (when present) scopes a single user gesture; without it we fall back
 * to a second-resolution timestamp so accidental double-submits within the same second
 * collapse, while intentional repeats later still record.
 */

export function buildOverrideIdempotencyKey(input: {
  businessProfileId: string;
  overrideType: OverrideType;
  decisionLinkId?: string | null;
  relatedLearningId?: string | null;
  factorType?: string | null;
  factorValue?: string | null;
  clientRequestId?: string | null;
  createdAtIso: string;
}): string {
  const decisionPart = input.decisionLinkId?.trim() || "no-decision";
  const learningPart = input.relatedLearningId?.trim() || "no-learning";
  const factorPart = `${input.factorType?.trim() || ""}:${input.factorValue?.trim() || ""}`;
  const requestPart = input.clientRequestId?.trim()
    ? `req:${input.clientRequestId.trim()}`
    : `at:${input.createdAtIso.slice(0, 19)}`;

  return [
    "ovr",
    input.businessProfileId,
    input.overrideType,
    decisionPart,
    learningPart,
    factorPart,
    requestPart,
  ].join(":");
}

/** Stable key used to find the currently-active preference of the same identity. */
export function preferenceIdentityKey(
  preferenceType: string,
  factorType: string | null | undefined,
  factorValue: string | null | undefined
): string {
  return `${preferenceType}|${factorType ?? ""}|${factorValue ?? ""}`;
}
