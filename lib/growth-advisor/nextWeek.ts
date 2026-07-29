/**
 * "Next week" monitoring — what the advisor expects to watch.
 * Combines existing briefing.nextWeek with Business Brain grounded monitors.
 * Never fabricates upcoming events.
 */

import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";

export type NextWeekMonitorItem = {
  id: string;
  label: string;
  detail: string;
};

export function buildNextWeekMonitoring(input: {
  briefing: HeadOfMarketingBriefing;
  goals: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
}): NextWeekMonitorItem[] {
  const items: NextWeekMonitorItem[] = [];
  const seen = new Set<string>();

  const push = (item: NextWeekMonitorItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  // Reuse existing briefing next-week lines as Suggested monitoring (honest continuity).
  input.briefing.nextWeek.forEach((line, index) => {
    push({
      id: `briefing_${index}`,
      label: "What I'm preparing",
      detail: line,
    });
  });

  if (input.briefing.confidence.gbpConnected || input.customerVoice) {
    push({
      id: "review_trends",
      label: "Review trends",
      detail: "I'll keep watching how customers talk about your business.",
    });
  }

  if (input.goals.length > 0) {
    push({
      id: "goal_progress",
      label: "Goal progress",
      detail: "I'll track movement toward what success looks like for you.",
    });
  }

  const ei = input.externalIntelligence;
  if (ei && ei.emptyState !== "no_evidence") {
    if (ei.weather.length > 0) {
      push({
        id: "weather",
        label: "Weather changes",
        detail: "Weather can shift near-term demand — I'll watch for meaningful changes.",
      });
    }
    if (ei.seasonalOpportunities.length > 0 || ei.holidayCalendar.length > 0) {
      push({
        id: "seasonal_demand",
        label: "Seasonal demand",
        detail: "I'll watch for seasonal moments that may open a marketing window.",
      });
    }
    if (ei.competitorActivity.length > 0) {
      push({
        id: "competitor_activity",
        label: "Competitor activity",
        detail: "I'll notice public competitor moves that may affect your positioning.",
      });
    }
    if (ei.localEvents.length > 0) {
      push({
        id: "local_events",
        label: "Upcoming local events",
        detail: "Local events can create timely opportunities — I'll keep an eye out.",
      });
    }
  }

  if (items.length < 2 && input.briefing.confidence.gbpConnected) {
    push({
      id: "market_signals",
      label: "Market signals",
      detail:
        "I'm still establishing external market signals — recommendations stay grounded in what we know.",
    });
  }

  return items.slice(0, 6);
}
