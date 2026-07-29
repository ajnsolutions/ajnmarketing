import type { GoalKey, GoalTimeframeOption } from "@/lib/goals/types";
import { GoalTimeframes } from "@/lib/goals/types";

export type GoalCatalogEntry = {
  key: GoalKey;
  label: string;
  /** Short hint for conversational onboarding. */
  hint: string;
};

/** Suggested success goals — Wave III onboarding vocabulary. */
export const GOAL_CATALOG: readonly GoalCatalogEntry[] = [
  {
    key: "increase_revenue",
    label: "Increase revenue",
    hint: "More sales from the customers you already attract.",
  },
  {
    key: "generate_more_leads",
    label: "Generate more leads",
    hint: "More people reaching out who are ready to buy.",
  },
  {
    key: "increase_recurring_customers",
    label: "Increase recurring customers",
    hint: "More repeat visits and longer customer relationships.",
  },
  {
    key: "improve_online_reputation",
    label: "Improve online reputation",
    hint: "Stronger reviews and trust where people check you out.",
  },
  {
    key: "increase_website_conversions",
    label: "Increase website conversions",
    hint: "More visitors taking the next step on your site.",
  },
  {
    key: "launch_new_service",
    label: "Launch a new service",
    hint: "Introduce something new without losing focus.",
  },
  {
    key: "expand_new_market",
    label: "Expand into a new market",
    hint: "Reach a new area or audience thoughtfully.",
  },
  {
    key: "grow_memberships",
    label: "Grow memberships",
    hint: "More members joining and staying.",
  },
  {
    key: "reduce_seasonality",
    label: "Reduce seasonality",
    hint: "Smoother demand across quieter months.",
  },
  {
    key: "save_time_automation",
    label: "Save time with automation",
    hint: "Less manual marketing busywork for you.",
  },
] as const;

export const GOAL_TIMEFRAME_OPTIONS: readonly GoalTimeframeOption[] = [
  { id: GoalTimeframes.NINETY_DAYS, label: "90 days" },
  { id: GoalTimeframes.SIX_MONTHS, label: "6 months" },
  { id: GoalTimeframes.ONE_YEAR, label: "1 year" },
];

const BY_KEY = new Map(GOAL_CATALOG.map((entry) => [entry.key, entry] as const));
const BY_LABEL = new Map(GOAL_CATALOG.map((entry) => [entry.label, entry] as const));

/** Legacy marketing_goals labels → catalog keys (best-effort migration). */
const LEGACY_LABEL_TO_KEY: Record<string, GoalKey> = {
  "More phone calls": "generate_more_leads",
  "More Google visibility": "generate_more_leads",
  "More reviews": "improve_online_reputation",
  "Better content consistency": "save_time_automation",
  "More website traffic": "increase_website_conversions",
  "Better local ranking": "generate_more_leads",
  "Less time managing marketing": "save_time_automation",
};

export function goalEntryForKey(key: string): GoalCatalogEntry | null {
  return BY_KEY.get(key as GoalKey) ?? null;
}

export function goalEntryForLabel(label: string): GoalCatalogEntry | null {
  return BY_LABEL.get(label) ?? null;
}

export function resolveGoalKeyFromLabel(label: string): GoalKey | null {
  return goalEntryForLabel(label)?.key ?? LEGACY_LABEL_TO_KEY[label] ?? null;
}

export function timeframeLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return GOAL_TIMEFRAME_OPTIONS.find((option) => option.id === id)?.label ?? null;
}
