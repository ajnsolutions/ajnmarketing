import "server-only";

/**
 * Pure request helpers for marketing-memory preference/override HTTP routes.
 */

export type ParsedPreferenceIdRequest =
  | { ok: true; preferenceId: string; activeUntil?: string | null }
  | { ok: false; error: string };

export function parseDeactivatePreferenceRequestBody(body: unknown): ParsedPreferenceIdRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "id is required" };
  }

  const record = body as Record<string, unknown>;
  const preferenceId =
    typeof record.id === "string"
      ? record.id.trim()
      : typeof record.preferenceId === "string"
        ? record.preferenceId.trim()
        : "";

  if (!preferenceId) {
    return { ok: false, error: "id is required" };
  }

  const activeUntilRaw = record.activeUntil ?? record.active_until;
  if (activeUntilRaw == null) {
    return { ok: true, preferenceId };
  }

  if (typeof activeUntilRaw !== "string" || Number.isNaN(Date.parse(activeUntilRaw))) {
    return { ok: false, error: "activeUntil must be a valid ISO timestamp when provided" };
  }

  return { ok: true, preferenceId, activeUntil: new Date(activeUntilRaw).toISOString() };
}
