"use client";

/**
 * Client-side sender for Growth Advisor telemetry. Fire-and-forget, never
 * blocks the UI, never throws into the caller — mirrors
 * lib/snapshot-ui/analytics.ts exactly. Metadata mirrors
 * GrowthAdvisorEventMetadata (lib/growth-advisor/experienceAnalytics.ts) —
 * a section name and/or recommendation id only, never conversation content.
 */

import type { GrowthAdvisorEvent, GrowthAdvisorEventMetadata } from "@/lib/growth-advisor/experienceAnalytics";

export function trackGrowthAdvisorEvent(event: GrowthAdvisorEvent, metadata?: GrowthAdvisorEventMetadata): void {
  void fetch("/api/growth-advisor/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, metadata }),
    keepalive: true,
  }).catch(() => undefined);
}
