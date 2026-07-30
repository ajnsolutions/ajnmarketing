/**
 * Business Knowledge Graph — single entrypoint other subsystems call.
 *
 * Pure composition over already-fetched Business Brain packages — this
 * module does no I/O of its own and introduces no private data store; every
 * input is exactly what Growth Advisor, Weekly Growth Plan, and Content
 * Generator already fetch today (see docs/project-magic/BUSINESS_BRAIN.md).
 *
 * Adding a future provider (Part 10 — Testimonials, Weather, Holiday
 * Calendar, GBP Insights, Competitor Intelligence, Social Analytics,
 * Advertising, Email Marketing) means adding one adapter function that
 * returns GraphSignalInput[] and appending it to `gatherGraphSignals` below
 * — build.ts and reasoning.ts never change, and never branch on provider id.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { TestimonialKnowledgeFactRecord } from "@/lib/testimonials/types";
import { businessDiscoveryToGraphSignals } from "@/lib/business-knowledge-graph/adapters/businessDiscovery";
import { goalsToGraphSignals } from "@/lib/business-knowledge-graph/adapters/goals";
import { customerVoiceToGraphSignals } from "@/lib/business-knowledge-graph/adapters/customerVoice";
import { externalIntelligenceToGraphSignals } from "@/lib/business-knowledge-graph/adapters/externalIntelligence";
import { smartUploadsToGraphSignals } from "@/lib/business-knowledge-graph/adapters/smartUploads";
import { testimonialKnowledgeToGraphSignals } from "@/lib/business-knowledge-graph/adapters/testimonials";
import { buildBusinessKnowledgeGraph } from "@/lib/business-knowledge-graph/build";
import { reasonAboutBusinessGraph, type BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import {
  computeBusinessKnowledgeHealth,
  type BusinessKnowledgeHealth,
  type KnowledgeSourcePresence,
} from "@/lib/business-knowledge-graph/knowledgeHealth";
import type { BusinessKnowledgeGraph, GraphSignalInput } from "@/lib/business-knowledge-graph/types";

export type BusinessGraphInput = {
  businessDiscovery?: BusinessDiscoveryResult | null;
  goals?: BusinessGoal[] | null;
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[] | null;
  testimonialFacts?: TestimonialKnowledgeFactRecord[] | null;
  now?: Date;
};

export function gatherGraphSignals(input: BusinessGraphInput): GraphSignalInput[] {
  return [
    ...businessDiscoveryToGraphSignals(input.businessDiscovery),
    ...goalsToGraphSignals(input.goals),
    ...customerVoiceToGraphSignals(input.customerVoice),
    ...externalIntelligenceToGraphSignals(input.externalIntelligence),
    ...smartUploadsToGraphSignals(input.smartUploadFacts),
    ...testimonialKnowledgeToGraphSignals(input.testimonialFacts),
  ];
}

export function buildBusinessGraph(input: BusinessGraphInput): BusinessKnowledgeGraph {
  return buildBusinessKnowledgeGraph(gatherGraphSignals(input), input.now ?? new Date());
}

/**
 * The main entrypoint: builds the graph and runs the reasoning engine in one
 * call. Growth Advisor, Weekly Growth Plan, and Marketing Health all call
 * this with the same already-fetched Business Brain packages they already
 * assemble today — never a second fetch of raw provider data.
 */
export function getBusinessReasoning(input: BusinessGraphInput): BusinessReasoningResult {
  const graph = buildBusinessGraph(input);
  return reasonAboutBusinessGraph(graph, input.now ?? new Date());
}

/** Which Business Brain sources actually contributed a signal this request —
 * never a connection-status check, an honest "did we learn anything." */
function sourcePresenceFromInput(input: BusinessGraphInput): KnowledgeSourcePresence {
  return {
    businessDiscovery: Boolean(input.businessDiscovery),
    goals: Boolean(input.goals?.length),
    customerVoice: Boolean(input.customerVoice && input.customerVoice.emptyState !== "no_evidence"),
    externalIntelligence: Boolean(
      input.externalIntelligence && input.externalIntelligence.emptyState !== "no_evidence",
    ),
    smartUploads: Boolean(input.smartUploadFacts?.length),
    testimonials: Boolean(input.testimonialFacts?.length),
  };
}

/**
 * The six Business Knowledge Health dimensions (Part 7) — computed from the
 * same graph and reasoning as getBusinessReasoning, no second fetch.
 */
export function getBusinessKnowledgeHealth(input: BusinessGraphInput): BusinessKnowledgeHealth {
  const now = input.now ?? new Date();
  const graph = buildBusinessGraph(input);
  const reasoning = reasonAboutBusinessGraph(graph, now);
  return computeBusinessKnowledgeHealth({
    graph,
    reasoning,
    sourcePresence: sourcePresenceFromInput(input),
    customerVoiceProviderCount: input.customerVoice?.contributingProviders.length ?? 0,
    customerVoiceEvidenceCount: input.customerVoice?.evidenceCount ?? 0,
    now,
  });
}

export type { BusinessKnowledgeGraph } from "@/lib/business-knowledge-graph/types";
export type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
export type {
  BusinessKnowledgeHealth,
  KnowledgeHealthDimension,
  KnowledgeHealthGap,
  KnowledgeSourcePresence,
} from "@/lib/business-knowledge-graph/knowledgeHealth";
