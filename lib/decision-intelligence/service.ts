/**
 * Decision Intelligence service entrypoints — the only module the API routes, Head of
 * Marketing section, dedicated page, Interactive HoM, and Strategic Calendar integration
 * should import from. Read-only; batches source reads; degrades gracefully per source.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDecisionSnapshotForUser,
  getLatestActiveDecisionSnapshot,
  getPreviousDecisionSnapshot,
  listDecisionSnapshotsForBusiness,
} from "@/lib/decision-intelligence/persistence";
import { buildEvidenceTraceForSnapshot } from "@/lib/decision-intelligence/evidenceTrace";
import { compareDecisionSnapshots } from "@/lib/decision-intelligence/comparisonEngine";
import { buildLearningImpactSummaries } from "@/lib/decision-intelligence/learningImpact";
import { getLearningsForBusiness } from "@/lib/marketing-memory/learningPersistence";
import { listPreferencesForBusiness } from "@/lib/marketing-memory/preferencePersistence";
import { listOverridesForBusiness } from "@/lib/marketing-memory/overridePersistence";
import { listExperimentsForBusiness } from "@/lib/marketing-experimentation/experiment-service";
import type {
  DecisionEvidenceTrace,
  DecisionIntelligenceSummary,
  DecisionIntelligenceWarning,
  DecisionTimelineEvent,
  MarketingDirectorDecisionSnapshot,
} from "@/lib/decision-intelligence/types";
import { DecisionTimelineEventTypes } from "@/lib/decision-intelligence/types";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

const MAX_TIMELINE_EVENTS = 50;
// [Claude review] getLearningsForBusiness has no built-in limit. buildLearningImpactSummaries
// issues two additional batched-but-concurrent lookups per learning (evidence_links +
// observations) via Promise.all -- safe for a realistic learning count, but genuinely
// unbounded without this cap. Learnings are already ordered most-recent-first, so this
// keeps the panel's most relevant entries.
const MAX_LEARNINGS_FOR_IMPACT = 50;

export type DecisionIntelligenceDeps = {
  now?: Date;
};

async function safeSourceRead<T>(
  source: string,
  fallback: T,
  read: () => Promise<T>,
  warnings: DecisionIntelligenceWarning[],
): Promise<T> {
  try {
    return await read();
  } catch (err) {
    warnings.push({ source, message: err instanceof Error ? err.message : "Failed to load" });
    return fallback;
  }
}

export async function getDecisionIntelligenceSummaryForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  deps: DecisionIntelligenceDeps = {},
): Promise<DecisionIntelligenceSummary> {
  const now = deps.now ?? new Date();
  const warnings: DecisionIntelligenceWarning[] = [];
  const limitations: string[] = [];

  const currentDecision = await safeSourceRead(
    "decision_snapshot",
    null,
    () => getLatestActiveDecisionSnapshot(supabase, userId, businessProfileId),
    warnings,
  );

  if (!currentDecision) {
    return {
      currentDecision: null,
      currentPriorities: [],
      comparison: null,
      learningImpact: [],
      timeline: [],
      limitations: ["No Marketing Director decision has been recorded yet for this business."],
      warnings,
      generatedAt: now.toISOString(),
    };
  }

  const [previousDecision, currentTraces, history, learnings, preferences, overrides, experiments] = await Promise.all([
    safeSourceRead("previous_decision", null, () => getPreviousDecisionSnapshot(supabase, userId, businessProfileId, currentDecision.evaluated_at), warnings),
    safeSourceRead("evidence_trace", [] as DecisionEvidenceTrace[], () => buildEvidenceTraceForSnapshot(supabase, userId, businessProfileId, currentDecision, { now }), warnings),
    safeSourceRead("decision_history", [] as MarketingDirectorDecisionSnapshot[], () => listDecisionSnapshotsForBusiness(supabase, userId, businessProfileId, { limit: 100 }), warnings),
    safeSourceRead("learnings", [] as Awaited<ReturnType<typeof getLearningsForBusiness>>, () => getLearningsForBusiness(supabase, userId, businessProfileId), warnings),
    safeSourceRead("preferences", [] as Awaited<ReturnType<typeof listPreferencesForBusiness>>, () => listPreferencesForBusiness(supabase, userId, businessProfileId), warnings),
    safeSourceRead("overrides", [] as Awaited<ReturnType<typeof listOverridesForBusiness>>, () => listOverridesForBusiness(supabase, userId, businessProfileId), warnings),
    safeSourceRead("experiments", [] as Awaited<ReturnType<typeof listExperimentsForBusiness>>, () => listExperimentsForBusiness(userId, businessProfileId, { supabaseClient: supabase }), warnings),
  ]);

  const previousTraces = previousDecision
    ? await safeSourceRead("previous_evidence_trace", [] as DecisionEvidenceTrace[], () => buildEvidenceTraceForSnapshot(supabase, userId, businessProfileId, previousDecision, { now }), warnings)
    : [];

  const comparison = compareDecisionSnapshots(currentDecision, previousDecision, currentTraces, previousTraces);

  const everConsultedLearningIds = new Set(history.flatMap((s) => s.consulted_learning_ids));
  const everConsultedPreferenceIds = new Set(history.flatMap((s) => s.consulted_preference_ids));
  const everIgnoredLearningReasons = new Map<string, string>();
  const everIgnoredPreferenceReasons = new Map<string, string>();
  for (const snapshot of history) {
    for (const entry of snapshot.ignored_evidence) {
      const target = entry.evidenceType === "learning" ? everIgnoredLearningReasons : everIgnoredPreferenceReasons;
      if (!target.has(entry.id)) target.set(entry.id, entry.reason);
    }
  }

  const learningImpact = await safeSourceRead(
    "learning_impact",
    [] as Awaited<ReturnType<typeof buildLearningImpactSummaries>>,
    () =>
      buildLearningImpactSummaries(supabase, businessProfileId, {
        learnings: learnings.slice(0, MAX_LEARNINGS_FOR_IMPACT),
        preferences,
        overrides,
        everConsultedLearningIds,
        everConsultedPreferenceIds,
        everIgnoredLearningReasons,
        everIgnoredPreferenceReasons,
      }),
    warnings,
  );

  const timeline = buildTimelineEvents(history, overrides, experiments, learnings);

  if (currentDecision.was_cold_start) {
    limitations.push("This decision was made without Marketing Memory evidence (cold start) — no preferences or learnings existed yet.");
  }

  return {
    currentDecision,
    currentPriorities: [{ snapshot: currentDecision, trace: currentTraces }],
    comparison,
    learningImpact,
    timeline,
    limitations,
    warnings,
    generatedAt: now.toISOString(),
  };
}

function buildTimelineEvents(
  history: MarketingDirectorDecisionSnapshot[],
  overrides: { id: string; created_at: string; override_type: string; is_permanent: boolean }[],
  experiments: Awaited<ReturnType<typeof listExperimentsForBusiness>>,
  learnings: Awaited<ReturnType<typeof getLearningsForBusiness>>,
): DecisionTimelineEvent[] {
  const events: DecisionTimelineEvent[] = [];

  for (const snapshot of history) {
    events.push({
      id: `decision:${snapshot.id}`,
      type: DecisionTimelineEventTypes.DECISION_GENERATED,
      occurredAt: snapshot.evaluated_at,
      title: snapshot.title,
      description: snapshot.customer_summary,
      sourceTarget: "/dashboard/decision-intelligence",
    });
  }

  for (const override of overrides) {
    events.push({
      id: `override:${override.id}`,
      type: DecisionTimelineEventTypes.OVERRIDE_RECORDED,
      occurredAt: override.created_at,
      title: override.is_permanent ? "Permanent override recorded" : "Temporary override recorded",
      description: override.override_type.replaceAll("_", " "),
      sourceTarget: "/dashboard/decision-intelligence",
    });
  }

  for (const experiment of experiments) {
    if (experiment.started_at) {
      events.push({
        id: `experiment_approved:${experiment.id}`,
        type: DecisionTimelineEventTypes.EXPERIMENT_APPROVED,
        occurredAt: experiment.started_at,
        title: `Experiment approved: ${experiment.title}`,
        description: experiment.hypothesis,
        sourceTarget: "/dashboard#experiments-heading",
      });
    }
    if (experiment.completed_at) {
      events.push({
        id: `experiment_completed:${experiment.id}`,
        type: DecisionTimelineEventTypes.EXPERIMENT_COMPLETED,
        occurredAt: experiment.completed_at,
        title: `Experiment completed: ${experiment.title}`,
        description: experiment.outcome.attributionAvailable
          ? experiment.outcome.summary
          : "Aggregate performance observed; variant attribution unavailable. Result is inconclusive.",
        sourceTarget: "/dashboard#experiments-heading",
      });
    }
  }

  for (const learning of learnings) {
    if (learning.status === "active" && learning.confidence_level !== "early_signal") {
      events.push({
        id: `learning_promoted:${learning.id}`,
        type: DecisionTimelineEventTypes.LEARNING_PROMOTED,
        occurredAt: learning.evaluated_at,
        title: "Learning promoted",
        description: learning.summary,
        sourceTarget: "/dashboard/decision-intelligence",
      });
    }
  }

  events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : a.id.localeCompare(b.id)));
  return events.slice(0, MAX_TIMELINE_EVENTS);
}

export async function getDecisionHistoryForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  options: { start?: string; end?: string; limit?: number } = {},
): Promise<MarketingDirectorDecisionSnapshot[]> {
  return listDecisionSnapshotsForBusiness(supabase, userId, businessProfileId, options);
}

export async function compareDecisionsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  currentDecisionId: string,
  previousDecisionId: string | null,
  deps: DecisionIntelligenceDeps = {},
) {
  const now = deps.now ?? new Date();
  const current = await getDecisionSnapshotForUser(supabase, userId, businessProfileId, currentDecisionId);
  if (!current) return null;

  const previous = previousDecisionId
    ? await getDecisionSnapshotForUser(supabase, userId, businessProfileId, previousDecisionId)
    : await getPreviousDecisionSnapshot(supabase, userId, businessProfileId, current.evaluated_at);

  const [currentTraces, previousTraces] = await Promise.all([
    buildEvidenceTraceForSnapshot(supabase, userId, businessProfileId, current, { now }),
    previous ? buildEvidenceTraceForSnapshot(supabase, userId, businessProfileId, previous, { now }) : Promise.resolve([]),
  ]);

  return compareDecisionSnapshots(current, previous, currentTraces, previousTraces);
}

export type GetDecisionIntelligenceForCurrentUserResult =
  | { ok: true; summary: DecisionIntelligenceSummary }
  | { ok: false; status: number; error: string };

export async function getDecisionIntelligenceSummaryForCurrentUser(): Promise<GetDecisionIntelligenceForCurrentUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return { ok: false, status: 404, error: "Business profile not found" };
  }

  const summary = await getDecisionIntelligenceSummaryForBusiness(supabase, user.id, profile.id);
  return { ok: true, summary };
}

export async function getEvidenceForDecision(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  decisionId: string,
  deps: DecisionIntelligenceDeps = {},
): Promise<DecisionEvidenceTrace[] | null> {
  const snapshot = await getDecisionSnapshotForUser(supabase, userId, businessProfileId, decisionId);
  if (!snapshot) return null;
  return buildEvidenceTraceForSnapshot(supabase, userId, businessProfileId, snapshot, { now: deps.now });
}
