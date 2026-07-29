/**
 * First-win generation — value unlocked when a milestone completes.
 * Progress customers can see, not just a checked box.
 */

import {
  GuidedMilestoneKeys,
  type FirstWin,
  type GuidedMilestoneKey,
} from "@/lib/guided-setup/types";

const FIRST_WIN_BY_MILESTONE: Record<GuidedMilestoneKey, Omit<FirstWin, "id">> = {
  [GuidedMilestoneKeys.KNOW_BUSINESS]: {
    milestoneKey: GuidedMilestoneKeys.KNOW_BUSINESS,
    title: "I know who I'm advising",
    detail:
      "Your business basics are saved — recommendations will reference the right name, place, and services.",
    valueKind: "recommendation",
  },
  [GuidedMilestoneKeys.KNOW_SUCCESS]: {
    milestoneKey: GuidedMilestoneKeys.KNOW_SUCCESS,
    title: "Recommendations can support your goals",
    detail:
      "I know what success looks like for you — weekly plans and advice will stay focused on those outcomes.",
    valueKind: "marketing_plan",
  },
  [GuidedMilestoneKeys.WEBSITE_UNDERSTANDING]: {
    milestoneKey: GuidedMilestoneKeys.WEBSITE_UNDERSTANDING,
    title: "Better SEO and content insight",
    detail:
      "I've learned from your website (or noted you don't have one) — content suggestions stay closer to your real messaging.",
    valueKind: "seo_insight",
  },
  [GuidedMilestoneKeys.CUSTOMER_FEEDBACK]: {
    milestoneKey: GuidedMilestoneKeys.CUSTOMER_FEEDBACK,
    title: "Customer Voice is unlocking",
    detail:
      "Local reviews and presence feed Customer Voice — copy and recommendations can sound more like your customers.",
    valueKind: "customer_voice",
  },
  [GuidedMilestoneKeys.ADVISOR_READY]: {
    milestoneKey: GuidedMilestoneKeys.ADVISOR_READY,
    title: "Your Growth Advisor is ready",
    detail:
      "Foundation is in place for a trustworthy weekly meeting — optional connections can deepen insight later.",
    valueKind: "advisor_ready",
  },
};

export function firstWinForMilestone(key: GuidedMilestoneKey): FirstWin {
  const base = FIRST_WIN_BY_MILESTONE[key];
  return {
    id: `first_win_${key}`,
    ...base,
  };
}

export function buildFirstWins(completedKeys: GuidedMilestoneKey[]): FirstWin[] {
  return completedKeys.map((key) => firstWinForMilestone(key));
}
