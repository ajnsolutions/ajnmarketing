/**
 * Anonymous funnel counters for the interactive demo.
 * In-memory only — sufficient for single-instance observability during Phase 1.
 */

import type { InteractiveDemoFunnelEvent } from "@/lib/interactive-demo/types";

const counts: Record<InteractiveDemoFunnelEvent, number> = {
  demo_started: 0,
  demo_completed: 0,
  cta_clicked: 0,
};

export function trackInteractiveDemoEvent(event: InteractiveDemoFunnelEvent): void {
  counts[event] += 1;
}

export function getInteractiveDemoEventCounts(): Record<
  InteractiveDemoFunnelEvent,
  number
> {
  return { ...counts };
}

export function resetInteractiveDemoEventCounts(): void {
  counts.demo_started = 0;
  counts.demo_completed = 0;
  counts.cta_clicked = 0;
}
