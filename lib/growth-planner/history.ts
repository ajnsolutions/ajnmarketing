/**
 * Weekly Growth Plan history — encode/decode/compare.
 * Persisted as a marketing_goals marker (same pattern as Business Goals).
 */

import {
  PRIMARY_OBJECTIVE_LABELS,
  PrimaryObjectiveKeys,
  WeeklyPlanStatuses,
  type PrimaryObjectiveKey,
  type WeeklyGrowthPlan,
  type WeeklyPlanComparison,
  type WeeklyPlanHistoryEntry,
  type WeeklyPlanStatus,
} from "@/lib/growth-planner/types";

export const WEEKLY_GROWTH_PLANS_MARKER_PREFIX = "__weekly_growth_plans_v1__:";

const OBJECTIVE_KEYS = new Set<string>(Object.values(PrimaryObjectiveKeys));
const STATUS_VALUES = new Set<string>(Object.values(WeeklyPlanStatuses));

function isObjectiveKey(value: unknown): value is PrimaryObjectiveKey {
  return typeof value === "string" && OBJECTIVE_KEYS.has(value);
}

function isStatus(value: unknown): value is WeeklyPlanStatus {
  return typeof value === "string" && STATUS_VALUES.has(value);
}

function isWeeklyGrowthPlan(value: unknown): value is WeeklyGrowthPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<WeeklyGrowthPlan>;
  return (
    typeof p.id === "string" &&
    typeof p.weekKey === "string" &&
    typeof p.generatedAt === "string" &&
    isStatus(p.status) &&
    !!p.primaryObjective &&
    isObjectiveKey(p.primaryObjective.key) &&
    typeof p.primaryObjective.label === "string" &&
    typeof p.whyNow === "string" &&
    Array.isArray(p.supportingActions) &&
    Array.isArray(p.evidence) &&
    !!p.explainability
  );
}

export function planToHistoryEntry(plan: WeeklyGrowthPlan): WeeklyPlanHistoryEntry {
  return {
    id: plan.id,
    weekKey: plan.weekKey,
    generatedAt: plan.generatedAt,
    objectiveKey: plan.primaryObjective.key,
    objectiveLabel: plan.primaryObjective.label,
    status: plan.status,
    outcome: plan.outcome,
    plan,
  };
}

export function encodeWeeklyGrowthPlansMarker(entries: WeeklyPlanHistoryEntry[]): string {
  // Cap history to keep marketing_goals payload bounded.
  const capped = entries
    .slice()
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 26);
  return `${WEEKLY_GROWTH_PLANS_MARKER_PREFIX}${JSON.stringify(capped)}`;
}

export function parseWeeklyGrowthPlansMarker(raw: string): WeeklyPlanHistoryEntry[] | null {
  if (!raw.startsWith(WEEKLY_GROWTH_PLANS_MARKER_PREFIX)) return null;
  const json = raw.slice(WEEKLY_GROWTH_PLANS_MARKER_PREFIX.length);
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const entries: WeeklyPlanHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<WeeklyPlanHistoryEntry>;
      if (typeof row.id !== "string" || typeof row.weekKey !== "string") continue;
      if (typeof row.generatedAt !== "string") continue;
      if (!isObjectiveKey(row.objectiveKey)) continue;
      if (!isStatus(row.status)) continue;
      if (!isWeeklyGrowthPlan(row.plan)) continue;
      entries.push({
        id: row.id,
        weekKey: row.weekKey,
        generatedAt: row.generatedAt,
        objectiveKey: row.objectiveKey,
        objectiveLabel:
          typeof row.objectiveLabel === "string"
            ? row.objectiveLabel
            : PRIMARY_OBJECTIVE_LABELS[row.objectiveKey],
        status: row.status,
        outcome: typeof row.outcome === "string" ? row.outcome : null,
        plan: row.plan,
      });
    }
    return entries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  } catch {
    return null;
  }
}

export function decodeWeeklyGrowthPlansFromMarketingGoals(
  marketingGoals: string[] | null | undefined,
): WeeklyPlanHistoryEntry[] {
  for (const item of marketingGoals ?? []) {
    const parsed = parseWeeklyGrowthPlansMarker(item);
    if (parsed) return parsed;
  }
  return [];
}

/** Upsert current week's plan into history (replace same weekKey). */
export function upsertWeeklyPlanHistory(
  existing: WeeklyPlanHistoryEntry[],
  plan: WeeklyGrowthPlan,
): WeeklyPlanHistoryEntry[] {
  const entry = planToHistoryEntry(plan);
  const withoutSameWeek = existing.filter((e) => e.weekKey !== plan.weekKey);
  return [entry, ...withoutSameWeek]
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 26);
}

export function applyWeeklyGrowthPlansToMarketingGoals(
  existing: string[] | null | undefined,
  entries: WeeklyPlanHistoryEntry[],
): string[] {
  const withoutPlans = (existing ?? []).filter(
    (item) => !item.startsWith(WEEKLY_GROWTH_PLANS_MARKER_PREFIX),
  );
  if (entries.length === 0) return withoutPlans;
  return [...withoutPlans, encodeWeeklyGrowthPlansMarker(entries)];
}

export function compareWeeklyPlans(
  current: WeeklyPlanHistoryEntry,
  previous: WeeklyPlanHistoryEntry | null,
): WeeklyPlanComparison {
  if (!previous) {
    return {
      current,
      previous: null,
      objectiveChanged: false,
      statusChanged: false,
      summary: "This is the first weekly plan on record.",
    };
  }

  const objectiveChanged = current.objectiveKey !== previous.objectiveKey;
  const statusChanged = current.status !== previous.status;

  let summary: string;
  if (objectiveChanged) {
    summary = `Focus shifted from “${previous.objectiveLabel}” to “${current.objectiveLabel}.”`;
  } else if (statusChanged) {
    summary = `Same objective (“${current.objectiveLabel}”); status moved to ${current.status.replace(/_/g, " ")}.`;
  } else {
    summary = `Continuing “${current.objectiveLabel}” from last week.`;
  }

  return {
    current,
    previous,
    objectiveChanged,
    statusChanged,
    summary,
  };
}

export function latestPlanAndPrevious(
  history: WeeklyPlanHistoryEntry[],
): { current: WeeklyPlanHistoryEntry | null; previous: WeeklyPlanHistoryEntry | null } {
  const sorted = history.slice().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  return {
    current: sorted[0] ?? null,
    previous: sorted[1] ?? null,
  };
}
