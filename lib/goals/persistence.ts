/**
 * Persist structured BusinessGoal[] inside business_profiles.marketing_goals
 * without a schema migration — same pattern as audience/origin Magic markers.
 */

import { GOAL_CATALOG, resolveGoalKeyFromLabel } from "@/lib/goals/catalog";
import {
  GoalStatuses,
  GoalTimeframes,
  type BusinessGoal,
  type GoalKey,
  type GoalStatus,
  type GoalTimeframe,
} from "@/lib/goals/types";

export const BUSINESS_GOALS_MARKER_PREFIX = "__business_goals_v1__:";

type StoredGoalV1 = {
  key: GoalKey;
  label: string;
  priority: number;
  status: GoalStatus;
  targetTimeframe: GoalTimeframe | null;
  createdAt: string;
  updatedAt: string;
};

function isGoalKey(value: unknown): value is GoalKey {
  return typeof value === "string" && GOAL_CATALOG.some((entry) => entry.key === value);
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return (
    value === GoalStatuses.ACTIVE ||
    value === GoalStatuses.PAUSED ||
    value === GoalStatuses.ACHIEVED ||
    value === GoalStatuses.DROPPED
  );
}

function isGoalTimeframe(value: unknown): value is GoalTimeframe {
  return (
    value === GoalTimeframes.NINETY_DAYS ||
    value === GoalTimeframes.SIX_MONTHS ||
    value === GoalTimeframes.ONE_YEAR
  );
}

export function parseBusinessGoalsMarker(raw: string): BusinessGoal[] | null {
  if (!raw.startsWith(BUSINESS_GOALS_MARKER_PREFIX)) return null;
  const json = raw.slice(BUSINESS_GOALS_MARKER_PREFIX.length);
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const goals: BusinessGoal[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<StoredGoalV1>;
      if (!isGoalKey(row.key) || typeof row.label !== "string") continue;
      if (typeof row.priority !== "number") continue;
      goals.push({
        key: row.key,
        label: row.label,
        priority: row.priority,
        status: isGoalStatus(row.status) ? row.status : GoalStatuses.ACTIVE,
        targetTimeframe: isGoalTimeframe(row.targetTimeframe) ? row.targetTimeframe : null,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date(0).toISOString(),
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
      });
    }
    return goals.sort((a, b) => a.priority - b.priority);
  } catch {
    return null;
  }
}

/** Build goals from plain selected labels (selection order = priority). */
export function goalsFromSelectedLabels(
  labels: string[],
  timeframe: GoalTimeframe | null,
  now = new Date(),
): BusinessGoal[] {
  const iso = now.toISOString();
  const goals: BusinessGoal[] = [];
  let priority = 1;
  for (const label of labels) {
    const key = resolveGoalKeyFromLabel(label);
    if (!key) continue;
    const catalog = GOAL_CATALOG.find((entry) => entry.key === key);
    if (!catalog) continue;
    if (goals.some((goal) => goal.key === key)) continue;
    goals.push({
      key,
      label: catalog.label,
      priority,
      status: GoalStatuses.ACTIVE,
      targetTimeframe: timeframe,
      createdAt: iso,
      updatedAt: iso,
    });
    priority += 1;
  }
  return goals;
}

export function encodeBusinessGoalsMarker(goals: BusinessGoal[]): string {
  const payload: StoredGoalV1[] = goals.map((goal) => ({
    key: goal.key,
    label: goal.label,
    priority: goal.priority,
    status: goal.status,
    targetTimeframe: goal.targetTimeframe,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  }));
  return `${BUSINESS_GOALS_MARKER_PREFIX}${JSON.stringify(payload)}`;
}

/**
 * Merge structured goals into marketing_goals:
 * - keeps audience/origin Magic markers
 * - stores one `__business_goals_v1__:` marker
 * - stores human-readable goal labels for existing consumers
 */
export function applyBusinessGoalsToMarketingGoals(
  existing: string[] | null | undefined,
  goals: BusinessGoal[],
): string[] {
  const withoutGoals = (existing ?? []).filter(
    (item) =>
      !item.startsWith(BUSINESS_GOALS_MARKER_PREFIX) &&
      resolveGoalKeyFromLabel(item) == null &&
      !GOAL_CATALOG.some((entry) => entry.label === item),
  );
  const activeLabels = goals
    .filter((goal) => goal.status === GoalStatuses.ACTIVE)
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => goal.label);
  if (goals.length === 0) return withoutGoals;
  return [...withoutGoals, ...activeLabels, encodeBusinessGoalsMarker(goals)];
}

export function decodeBusinessGoalsFromMarketingGoals(
  marketingGoals: string[] | null | undefined,
): BusinessGoal[] {
  const list = marketingGoals ?? [];
  for (const item of list) {
    const parsed = parseBusinessGoalsMarker(item);
    if (parsed && parsed.length > 0) return parsed;
  }

  // Fallback: reconstruct from plain labels (legacy or partial saves).
  const labels = list.filter(
    (item) => !item.startsWith(BUSINESS_GOALS_MARKER_PREFIX) && resolveGoalKeyFromLabel(item),
  );
  return goalsFromSelectedLabels(labels, null);
}

export function stripBusinessGoalsArtifacts(goals: string[]): string[] {
  return goals.filter((item) => !item.startsWith(BUSINESS_GOALS_MARKER_PREFIX));
}

export function reorderGoals(goals: BusinessGoal[], orderedKeys: GoalKey[]): BusinessGoal[] {
  const byKey = new Map(goals.map((goal) => [goal.key, goal] as const));
  const now = new Date().toISOString();
  const next: BusinessGoal[] = [];
  let priority = 1;
  for (const key of orderedKeys) {
    const existing = byKey.get(key);
    if (!existing) continue;
    next.push({ ...existing, priority, updatedAt: now });
    priority += 1;
  }
  return next;
}
