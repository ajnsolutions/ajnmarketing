/**
 * Confidence vocabulary mapping (Part 2) — every subsystem in this repo
 * already tracks confidence in its own vocabulary (Business Discovery's
 * known/assumed/missing, everything else's low/medium/high). This module
 * maps every one of them onto the single High/Medium/Low vocabulary the
 * mission asks for — never a percentage, never a raw score.
 */

import type { DiscoveryConfidenceTier } from "@/lib/business-discovery/types";
import { BrainConfidenceLevels, type BrainConfidenceLevel } from "@/lib/business-brain-inspector/types";

/** Business Discovery's "missing" tier has no confidence to show — that
 * information belongs in the missing-knowledge list instead, never a card. */
export function fromDiscoveryConfidenceTier(tier: DiscoveryConfidenceTier): BrainConfidenceLevel | null {
  if (tier === "known") return BrainConfidenceLevels.HIGH;
  if (tier === "assumed") return BrainConfidenceLevels.MEDIUM;
  return null;
}

/** Every other subsystem (Customer Voice, External Intelligence, the
 * Business Knowledge Graph, the Business Learning Engine, the Opportunity
 * Detection Engine) already uses this exact three-tier vocabulary. */
export function fromConfidenceLevel(level: "low" | "medium" | "high"): BrainConfidenceLevel {
  return level as BrainConfidenceLevel;
}

const CONFIDENCE_RANK: Record<BrainConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };
const RANK_TO_CONFIDENCE: Record<number, BrainConfidenceLevel> = { 1: "low", 2: "medium", 3: "high" };

/** Overall confidence across every card the Business Brain currently has —
 * the average tier, rounded down so a handful of weak cards can't be
 * masked by many strong ones. Never a fabricated composite score. */
export function overallConfidenceFrom(confidences: BrainConfidenceLevel[]): BrainConfidenceLevel {
  if (confidences.length === 0) return BrainConfidenceLevels.LOW;
  const average = confidences.reduce((sum, level) => sum + CONFIDENCE_RANK[level], 0) / confidences.length;
  return RANK_TO_CONFIDENCE[Math.max(1, Math.floor(average))]!;
}
