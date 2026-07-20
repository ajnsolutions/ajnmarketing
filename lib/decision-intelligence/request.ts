/**
 * Bounded query-parameter parsing for Decision Intelligence API routes.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_RANGE_DAYS = 366;

export type ParsedHistoryQuery =
  | { ok: true; start?: string; end?: string; limit: number }
  | { ok: false; error: string };

function isValidIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function parseHistoryQuery(searchParams: URLSearchParams): ParsedHistoryQuery {
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");
  const limitRaw = searchParams.get("limit");

  let start: string | undefined;
  let end: string | undefined;

  if (startRaw) {
    if (!isValidIsoDate(startRaw)) return { ok: false, error: "start must be a valid ISO date" };
    start = new Date(startRaw).toISOString();
  }
  if (endRaw) {
    if (!isValidIsoDate(endRaw)) return { ok: false, error: "end must be a valid ISO date" };
    end = new Date(endRaw).toISOString();
  }
  if (start && end && new Date(start) > new Date(end)) {
    return { ok: false, error: "start must be before end" };
  }
  if (start && end) {
    const rangeDays = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_RANGE_DAYS) {
      return { ok: false, error: `date range must not exceed ${MAX_RANGE_DAYS} days` };
    }
  }

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "limit must be a positive integer" };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  return { ok: true, start, end, limit };
}

export type ParsedChangesQuery =
  | { ok: true; currentDecisionId: string; previousDecisionId: string | null }
  | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChangesQuery(searchParams: URLSearchParams): ParsedChangesQuery {
  const currentDecisionId = searchParams.get("currentDecisionId");
  const previousDecisionId = searchParams.get("previousDecisionId");

  if (!currentDecisionId || !UUID_PATTERN.test(currentDecisionId)) {
    return { ok: false, error: "currentDecisionId is required and must be a valid ID" };
  }
  if (previousDecisionId && !UUID_PATTERN.test(previousDecisionId)) {
    return { ok: false, error: "previousDecisionId must be a valid ID" };
  }

  return { ok: true, currentDecisionId, previousDecisionId: previousDecisionId ?? null };
}

export type ParsedEvidenceQuery = { ok: true; decisionId: string } | { ok: false; error: string };

export function parseEvidenceQuery(searchParams: URLSearchParams): ParsedEvidenceQuery {
  const decisionId = searchParams.get("decisionId");
  if (!decisionId || !UUID_PATTERN.test(decisionId)) {
    return { ok: false, error: "decisionId is required and must be a valid ID" };
  }
  return { ok: true, decisionId };
}
