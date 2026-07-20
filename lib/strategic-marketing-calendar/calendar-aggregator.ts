/**
 * Pure aggregation: sources + range → ordered client-safe events.
 * No DB. No LLM. Deterministic for identical inputs.
 */

import {
  normalizeCampaignCards,
  normalizeDecisionIntelligenceEvents,
  normalizeExecutivePriorities,
  normalizeMarketContextItems,
  normalizePendingApprovals,
  normalizePublishingItems,
  type NormalizeRange,
} from "@/lib/strategic-marketing-calendar/calendar-normalizers";
import { dedupeCalendarEvents } from "@/lib/strategic-marketing-calendar/calendar-ordering";
import { filterCalendarEvents } from "@/lib/strategic-marketing-calendar/calendar-filters";
import type { CalendarSourceBundle } from "@/lib/strategic-marketing-calendar/calendar-dependencies";
import type {
  StrategicCalendarCategory,
  StrategicMarketingCalendarEvent,
  StrategicMarketingCalendarResponse,
  StrategicCalendarView,
} from "@/lib/strategic-marketing-calendar/calendar-types";

export type AggregateCalendarInput = {
  businessProfileId: string;
  view: StrategicCalendarView;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  todayKey: string;
  sources: CalendarSourceBundle;
  categories?: Set<StrategicCalendarCategory> | null;
  now?: Date;
  /** Soft cap to keep responses bounded. */
  maxEvents?: number;
};

export function aggregateStrategicMarketingCalendar(
  input: AggregateCalendarInput,
): StrategicMarketingCalendarResponse {
  const range: NormalizeRange = {
    businessProfileId: input.businessProfileId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    timezone: input.timezone,
    todayKey: input.todayKey,
  };

  const collected: StrategicMarketingCalendarEvent[] = [];

  if (input.sources.briefing) {
    collected.push(
      ...normalizeExecutivePriorities({
        primaryAction: input.sources.briefing.primaryAction,
        executiveBrief: input.sources.briefing.executiveBrief,
        range,
      }),
    );
  }

  collected.push(...normalizeCampaignCards(input.sources.campaigns, range));
  collected.push(...normalizePublishingItems(input.sources.publishing, range));
  collected.push(...normalizePendingApprovals(input.sources.approvals, range));
  collected.push(...normalizeMarketContextItems(input.sources.marketContextItems, range));
  collected.push(...normalizeDecisionIntelligenceEvents(input.sources.decisionIntelligenceEvents, range));

  const deduped = dedupeCalendarEvents(collected);
  const filtered = filterCalendarEvents(deduped, input.categories ?? null);
  const maxEvents = input.maxEvents ?? 250;
  const events = filtered.slice(0, maxEvents);

  return {
    view: input.view,
    timezone: input.timezone,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    events,
    warnings: input.sources.warnings,
    pendingApprovalCount: input.sources.pendingApprovalCount,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
