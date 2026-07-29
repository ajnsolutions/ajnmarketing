/**
 * First Impression — shared UI-local types.
 *
 * Pure presentation/state types only. The authoritative data contract lives
 * in lib/business-discovery/public/types.ts (PR #74) and
 * lib/business-discovery/continuation/types.ts (PR #75) — this file never
 * redefines those, only adds what the UI needs on top.
 */

import type { InsightDecisionType, InsightKey } from "@/lib/business-discovery/continuation/types";
import type { DiscoveryConfidenceTier, DiscoverySourceType } from "@/lib/business-discovery/types";

export type ScanPhase =
  | "idle"
  | "scanning"
  | "results"
  | "error";

export type ScanErrorState = {
  code: string;
  message: string;
  /** Whether the submitted form context should be preserved so the visitor doesn't retype it. */
  retryable: boolean;
};

/**
 * One insight reshaped for display — normalizes the public contract's mixed
 * value shapes (string, string[], {connected,analyzed}, etc.) into a single
 * renderable form, without losing provenance.
 */
export type ReviewableInsight = {
  key: InsightKey;
  label: string;
  category: "identity" | "presence" | "growth";
  confidenceTier: DiscoveryConfidenceTier;
  sources: DiscoverySourceType[];
  reason: string;
  /** Plain-language display value — already joined/formatted, never a raw array or object. */
  displayValue: string | null;
  /** True when this insight has real business-impact weight and should be prioritized in guided review. */
  highPriority: boolean;
};

/** A visitor's local, pre-auth choice for one insight — never sent to any server until after authentication. */
export type DraftDecision = {
  insightKey: InsightKey;
  decision: InsightDecisionType;
  correctedValue?: string;
  note?: string;
};

export type DraftDecisionMap = Partial<Record<InsightKey, DraftDecision>>;
