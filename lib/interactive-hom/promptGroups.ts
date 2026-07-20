/**
 * Suggested-prompt grouping for Ask Your Head of Marketing (presentation only).
 */

import type { InteractiveHomSuggestedPrompt } from "@/lib/interactive-hom/types";
import { INTERACTIVE_HOM_SUGGESTED_PROMPTS } from "@/lib/interactive-hom/prompts";

export const InteractiveHomPromptGroups = {
  CURRENT_PRIORITIES: "current_priorities",
  WHY_PLAN_CHANGED: "why_plan_changed",
  CAMPAIGNS: "campaigns",
  EXPERIMENTS: "experiments",
  PERFORMANCE: "performance",
  PREFERENCES: "preferences",
  UNCERTAIN: "uncertain",
} as const;

export type InteractiveHomPromptGroup =
  (typeof InteractiveHomPromptGroups)[keyof typeof InteractiveHomPromptGroups];

export type GroupedInteractiveHomPrompt = InteractiveHomSuggestedPrompt & {
  group: InteractiveHomPromptGroup;
  groupLabel: string;
};

const GROUP_LABELS: Record<InteractiveHomPromptGroup, string> = {
  current_priorities: "Current priorities",
  why_plan_changed: "Why the plan changed",
  campaigns: "Campaigns",
  experiments: "Experiments",
  performance: "Marketing performance",
  preferences: "Customer preferences",
  uncertain: "What remains uncertain",
};

const PROMPT_GROUP_BY_ID: Record<string, InteractiveHomPromptGroup> = {
  work_today: InteractiveHomPromptGroups.CURRENT_PRIORITIES,
  why_recommended: InteractiveHomPromptGroups.CURRENT_PRIORITIES,
  priority: InteractiveHomPromptGroups.CURRENT_PRIORITIES,
  what_changed: InteractiveHomPromptGroups.WHY_PLAN_CHANGED,
  why_plan_changed: InteractiveHomPromptGroups.WHY_PLAN_CHANGED,
  ignored_evidence: InteractiveHomPromptGroups.WHY_PLAN_CHANGED,
  campaign: InteractiveHomPromptGroups.CAMPAIGNS,
  experiment_impact: InteractiveHomPromptGroups.EXPERIMENTS,
  learned: InteractiveHomPromptGroups.PREFERENCES,
  preference_impact: InteractiveHomPromptGroups.PREFERENCES,
  risks: InteractiveHomPromptGroups.UNCERTAIN,
  opportunities: InteractiveHomPromptGroups.PERFORMANCE,
};

export function groupInteractiveHomPrompts(
  prompts: readonly InteractiveHomSuggestedPrompt[] = INTERACTIVE_HOM_SUGGESTED_PROMPTS,
): Array<{ group: InteractiveHomPromptGroup; label: string; prompts: GroupedInteractiveHomPrompt[] }> {
  const buckets = new Map<InteractiveHomPromptGroup, GroupedInteractiveHomPrompt[]>();

  for (const prompt of prompts) {
    const group = PROMPT_GROUP_BY_ID[prompt.id] ?? InteractiveHomPromptGroups.CURRENT_PRIORITIES;
    const entry: GroupedInteractiveHomPrompt = {
      ...prompt,
      group,
      groupLabel: GROUP_LABELS[group],
    };
    const list = buckets.get(group) ?? [];
    list.push(entry);
    buckets.set(group, list);
  }

  const order: InteractiveHomPromptGroup[] = [
    InteractiveHomPromptGroups.CURRENT_PRIORITIES,
    InteractiveHomPromptGroups.WHY_PLAN_CHANGED,
    InteractiveHomPromptGroups.CAMPAIGNS,
    InteractiveHomPromptGroups.EXPERIMENTS,
    InteractiveHomPromptGroups.PERFORMANCE,
    InteractiveHomPromptGroups.PREFERENCES,
    InteractiveHomPromptGroups.UNCERTAIN,
  ];

  return order
    .filter((group) => (buckets.get(group)?.length ?? 0) > 0)
    .map((group) => ({
      group,
      label: GROUP_LABELS[group],
      prompts: buckets.get(group) ?? [],
    }));
}
