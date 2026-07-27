"use client";

/**
 * Client-side sender for the First Impression funnel. Fire-and-forget, never
 * blocks the UI, never throws into the caller. The metadata shape mirrors
 * SnapshotFunnelEventMetadata (lib/snapshot-ui/experienceAnalytics.ts) —
 * section names and insight keys only, never a value or correction text.
 */

import type { SnapshotFunnelEvent, SnapshotFunnelEventMetadata } from "@/lib/snapshot-ui/experienceAnalytics";

export function trackSnapshotEvent(event: SnapshotFunnelEvent, metadata?: SnapshotFunnelEventMetadata): void {
  void fetch("/api/business-discovery/snapshot-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, metadata }),
    keepalive: true,
  }).catch(() => undefined);
}
