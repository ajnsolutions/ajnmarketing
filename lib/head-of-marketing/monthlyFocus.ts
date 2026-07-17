import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type {
  FocusHorizonSupport,
  FocusStyleSupport,
  MonthlyFocus,
  MonthlyFocusPriority,
} from "@/lib/head-of-marketing/monthlyFocusTypes";

export type MonthlyFocusInput = {
  gbpConnected: boolean;
  unansweredReviews: number;
  openRecommendations: number;
  healthState: MarketingHealthState;
  planSummary: string | null;
  marketingThemes: string[];
  businessGoals: string[];
  seasonalHint: string | null;
  isEarlyCustomer: boolean;
  now?: Date;
};

const HORIZON: FocusHorizonSupport = {
  activeHorizon: "monthly",
  supportedHorizons: ["monthly", "quarterly", "annual"],
  note: "Monthly Focus is the living priority. Quarterly Priorities and Annual Vision can reuse this shape later without a new engine.",
};

const STYLES: FocusStyleSupport = {
  supportedStyles: ["hands_on", "weekly", "monthly", "trusted"],
  note: "Management styles change how often Focus is discussed; the Focus remains the shared direction.",
};

const FORBIDDEN = [
  "Marketing Strategy",
  "Objectives",
  "Campaign Management",
  "Planning Engine",
  "Roadmap",
  "KPI",
  "OKR",
] as const;

function monthName(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(now);
}

function cleanTheme(raw: string): string {
  return raw
    .replace(/^(theme|focus|priority)\s*[:\-–]\s*/i, "")
    .trim();
}

function toPriorityLabel(raw: string): string {
  const cleaned = cleanTheme(raw);
  if (!cleaned) return cleaned;
  // Prefer gerund-friendly customer language when the theme is noun-heavy.
  if (/^improv/i.test(cleaned) || /^build/i.test(cleaned) || /^prepar/i.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (/visibility|seo|local|google/i.test(cleaned)) {
    return `Improving ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  if (/review/i.test(cleaned)) {
    return `Building more positive reviews`;
  }
  if (/competitor/i.test(cleaned)) {
    return `Staying ahead of nearby competitors`;
  }
  if (/season/i.test(cleaned)) {
    return `Preparing seasonal marketing`;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildPriorities(input: MonthlyFocusInput): {
  priorities: MonthlyFocusPriority[];
  sourcedFromPlan: boolean;
} {
  const priorities: MonthlyFocusPriority[] = [];
  let sourcedFromPlan = false;

  for (const theme of input.marketingThemes) {
    const label = toPriorityLabel(theme);
    if (!label) continue;
    priorities.push({ label });
    sourcedFromPlan = true;
    if (priorities.length >= 4) break;
  }

  if (priorities.length < 4) {
    for (const goal of input.businessGoals) {
      const label = toPriorityLabel(goal);
      if (!label) continue;
      if (priorities.some((p) => p.label.toLowerCase() === label.toLowerCase())) continue;
      priorities.push({
        label,
        why: "I believe this gives us a meaningful opportunity for your business.",
      });
      sourcedFromPlan = true;
      if (priorities.length >= 4) break;
    }
  }

  if (input.seasonalHint && priorities.length < 4) {
    const seasonalLabel = `Preparing seasonal marketing`;
    if (!priorities.some((p) => /seasonal/i.test(p.label))) {
      priorities.push({
        label: seasonalLabel,
        why: `I'd like us to be ready for ${input.seasonalHint}.`,
      });
      sourcedFromPlan = true;
    }
  }

  // Signal-informed defaults — still presentation, not a new planner.
  if (priorities.length === 0) {
    if (!input.gbpConnected) {
      priorities.push({
        label: "Improving local visibility",
        why: "I believe this gives us the biggest opportunity to help customers find you.",
      });
    } else {
      priorities.push({
        label: "Improving local visibility",
        why: "Steady visibility compounds trust with the customers you want.",
      });
    }
    priorities.push({
      label: "Building more positive reviews",
      why: "Reputation helps every other marketing effort work harder.",
    });
    if (input.seasonalHint) {
      priorities.push({
        label: "Preparing seasonal marketing",
        why: "Timing matters — I'd like us to be ready before the rush.",
      });
    } else {
      priorities.push({
        label: "Staying ahead of nearby competitors",
        why: "I'll keep an eye on the market so we don't get surprised.",
      });
    }
  }

  while (priorities.length < 2) {
    priorities.push({
      label: "Keeping your marketing steady and consistent",
      why: "Consistency is often the quiet advantage.",
    });
  }

  return { priorities: priorities.slice(0, 4), sourcedFromPlan };
}

function progressLine(healthState: MarketingHealthState): string {
  switch (healthState) {
    case "excellent":
      return "We're making excellent progress on this month's focus.";
    case "healthy":
      return "We're on track with what we're working toward this month.";
    case "needs_attention":
      return "I'd like to shift our attention slightly so we stay aligned with this month's focus.";
    case "at_risk":
      return "I'm focusing first on the foundations that make this month's priorities possible.";
  }
}

/**
 * Pure Monthly Focus orchestrator.
 * Translates existing plan themes/goals and live signals into customer language.
 * Does not create a planning engine.
 */
export function buildMonthlyFocus(input: MonthlyFocusInput): MonthlyFocus {
  const now = input.now ?? new Date();
  const { priorities, sourcedFromPlan } = buildPriorities(input);
  const month = monthName(now);

  const intro = input.isEarlyCustomer
    ? `Over the next month I'd like us to focus on a few clear priorities for ${month}.`
    : `Over the next month I'd like us to focus on:`;

  const reinforcement =
    "Everything I'm doing this month supports these priorities.";

  const successLooksLike = sourcedFromPlan
    ? "What success looks like: steady progress on these priorities, without you having to chase the details."
    : "What success looks like: clearer visibility, stronger reputation, and a calm weekly rhythm.";

  let magicMoment: string | null = null;
  if (input.healthState === "excellent") {
    magicMoment = "Nothing needs to change. Go enjoy your month.";
  } else if (input.healthState === "healthy") {
    magicMoment = "We're making steady progress.";
  } else {
    magicMoment = "Here's what I'd like us to accomplish together.";
  }

  return {
    title: "This Month's Focus",
    intro,
    priorities,
    reinforcement,
    progressLine: progressLine(input.healthState),
    successLooksLike,
    magicMoment,
    horizon: HORIZON,
    styles: STYLES,
    sourcedFromPlan,
  };
}

export const MONTHLY_FOCUS_FORBIDDEN_TERMS = FORBIDDEN;
