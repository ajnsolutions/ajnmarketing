/**
 * Confirmation processing — pure logic, no I/O. Turns a batch of
 * client-submitted decisions into server-derived ConfirmationRecord[],
 * deriving "original discovery provenance" (value/sources/confidence tier)
 * exclusively from the *resolved* snapshot, never from anything the client
 * claims about it — this is what makes a tampered/altered "original value"
 * submission harmless: the client's opinion of the original is never read.
 *
 * Persistence decision (see docs/BUSINESS_DISCOVERY_CONTINUATION.md for the
 * full reasoning): of the 8 confirmable insight keys, exactly one —
 * primaryServices — has an existing, durable, non-colliding home:
 * business_profiles.primary_services. The rest (business summary, target
 * customers, brand personality, strengths, growth opportunities) have no
 * dedicated column, and this task does not add one (Part 3's explicit "do
 * not create a large new Business Brain schema"). Their confirmation
 * *records* still exist and are returned to the caller and tracked in the
 * confirmation store (in-memory, see confirmationStore.ts) — a bespoke,
 * user-visible marker in `voice_notes` was considered and rejected, because
 * voice_notes is itself a customer-editable field (see
 * components/dashboard/brand-voice-page.tsx) and stuffing internal markers
 * into it would corrupt what customers actually see there.
 */

import {
  DiscoveryConfidenceTiers,
  type DiscoveryConfidenceTier,
  type DiscoverySourceType,
} from "@/lib/business-discovery/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";
import {
  INSIGHT_KEY_ALLOWLIST,
  InsightDecisionTypes,
  InsightKeys,
  ResultingFactStatuses,
  type ConfirmationDecisionInput,
  type ConfirmationRecord,
  type InsightKey,
  type ResultingFactStatus,
} from "@/lib/business-discovery/continuation/types";

type ResolvedInsight = {
  value: unknown;
  sources: DiscoverySourceType[];
  confidenceTier: DiscoveryConfidenceTier;
};

function getResolvedInsight(snapshot: PublicBusinessDiscoveryResultV1, key: InsightKey): ResolvedInsight {
  switch (key) {
    case InsightKeys.BUSINESS_SUMMARY:
      return snapshot.businessSummary;
    case InsightKeys.PRIMARY_SERVICES:
      return snapshot.primaryServices;
    case InsightKeys.LIKELY_TARGET_CUSTOMERS:
      return snapshot.likelyTargetCustomers;
    case InsightKeys.BRAND_PERSONALITY:
      return snapshot.brandPersonality;
    case InsightKeys.VISIBLE_STRENGTHS:
      return snapshot.visibleStrengths;
    case InsightKeys.ONLINE_PRESENCE_WEBSITE:
      return snapshot.onlinePresence.website;
    case InsightKeys.ONLINE_PRESENCE_GOOGLE_BUSINESS_PROFILE:
      return snapshot.onlinePresence.googleBusinessProfile;
    case InsightKeys.POSSIBLE_GROWTH_OPPORTUNITIES:
      return snapshot.possibleGrowthOpportunities;
  }
}

export type ApplyDecisionOutcome = { record: ConfirmationRecord } | { error: string };

/**
 * Applies one decision against the resolved snapshot's *current* value for
 * that key — the snapshot is the sole source of truth for "the original";
 * nothing about it is ever taken from the client's request.
 */
export function applyConfirmationDecision(
  snapshot: PublicBusinessDiscoveryResultV1,
  input: ConfirmationDecisionInput,
  userId: string,
  now: string
): ApplyDecisionOutcome {
  if (!INSIGHT_KEY_ALLOWLIST.has(input.insightKey)) {
    return { error: `Unknown insight key: ${String(input.insightKey)}` };
  }

  const insight = getResolvedInsight(snapshot, input.insightKey);

  let resultingValue: unknown = null;
  let resultingFactStatus: ResultingFactStatus = ResultingFactStatuses.UNRESOLVED;

  switch (input.decision) {
    case InsightDecisionTypes.CONFIRM: {
      // A Missing insight has nothing to confirm — defensively a no-op
      // rather than fabricating a "known fact" out of nothing.
      if (insight.confidenceTier === DiscoveryConfidenceTiers.MISSING) {
        resultingFactStatus = ResultingFactStatuses.UNRESOLVED;
        resultingValue = null;
      } else {
        resultingValue = insight.value;
        resultingFactStatus = ResultingFactStatuses.KNOWN_FACT;
      }
      break;
    }
    case InsightDecisionTypes.CORRECT: {
      if (input.correctedValue === undefined || input.correctedValue === null) {
        return { error: `A corrected value is required to correct ${input.insightKey}.` };
      }
      resultingValue = input.correctedValue;
      resultingFactStatus = ResultingFactStatuses.KNOWN_FACT;
      break;
    }
    case InsightDecisionTypes.REJECT: {
      resultingValue = null;
      resultingFactStatus = ResultingFactStatuses.REJECTED;
      break;
    }
    case InsightDecisionTypes.REVIEW_LATER: {
      resultingValue = null;
      resultingFactStatus = ResultingFactStatuses.UNRESOLVED;
      break;
    }
    default:
      return { error: `Unknown decision: ${String(input.decision)}` };
  }

  return {
    record: {
      insightKey: input.insightKey,
      decision: input.decision,
      originalValue: insight.value,
      originalSources: insight.sources,
      originalConfidenceTier: insight.confidenceTier,
      resultingValue,
      resultingFactStatus,
      note: input.note?.trim() || null,
      decidedByUserId: userId,
      decidedAt: now,
    },
  };
}

export function applyConfirmationDecisions(
  snapshot: PublicBusinessDiscoveryResultV1,
  decisions: ConfirmationDecisionInput[],
  userId: string,
  now: string
): { records: ConfirmationRecord[]; errors: string[] } {
  const records: ConfirmationRecord[] = [];
  const errors: string[] = [];

  for (const decision of decisions) {
    const outcome = applyConfirmationDecision(snapshot, decision, userId, now);
    if ("error" in outcome) {
      errors.push(outcome.error);
    } else {
      records.push(outcome.record);
    }
  }

  return { records, errors };
}

/**
 * The one durable mapping onto existing business_profiles persistence — see
 * this file's header comment for why only primaryServices lands here today.
 */
export function buildBusinessProfileFieldsFromConfirmations(
  records: ConfirmationRecord[]
): { primary_services?: string } {
  const servicesRecord = records.find(
    (record) => record.insightKey === InsightKeys.PRIMARY_SERVICES && record.resultingFactStatus === ResultingFactStatuses.KNOWN_FACT
  );
  if (!servicesRecord) return {};

  const value = servicesRecord.resultingValue;
  const services = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  if (services.length === 0) return {};

  return { primary_services: services.join(", ") };
}
