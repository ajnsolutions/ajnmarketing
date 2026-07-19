import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { EVALUATION_WINDOW_DAYS } from "@/lib/marketing-memory/learningConfig";
import { evaluateRecommendationActionOutcome, evaluateTimingPerformance } from "@/lib/marketing-memory/learningEvaluation";
import {
  fetchActionOutcomeEvidenceRows,
  fetchPerformanceEvidenceRows,
  getLiveLearningByKey,
  insertLearning,
  linkLearningEvidence,
  supersedeLearning,
  updateLearningInPlace,
} from "@/lib/marketing-memory/learningPersistence";
import { LearningDirections, type EvaluateLearningsSummary, type LearningEvaluationResult } from "@/lib/marketing-memory/learningTypes";
import { classifyError } from "@/lib/marketing-memory/metadata";

function logLearningEvaluationEvent(line: {
  event: string;
  businessProfileId: string;
  learningFamily?: string;
  learningKey?: string;
  confidenceLevel?: string;
  status?: string;
  result?: "success" | "error";
  errorClass?: string;
}): void {
  if (line.result === "error") {
    console.error("[MarketingMemoryLearnings]", line);
  } else {
    console.info("[MarketingMemoryLearnings]", line);
  }
}

/** A genuine sign reversal ("this used to help, now it hurts" or vice versa) is the
 * only case that supersedes rather than reconciles in place — matching the
 * architecture's "supersede rather than silently overwrite materially changed
 * conclusions" rule. Any other transition (into/out of neutral or inconclusive, a
 * confidence-level change, a status change) is an in-place update: it's the same
 * observed pattern, just re-measured. */
function isMeaningfulDirectionFlip(previousDirection: string, nextDirection: string): boolean {
  return (
    (previousDirection === LearningDirections.POSITIVE && nextDirection === LearningDirections.NEGATIVE) ||
    (previousDirection === LearningDirections.NEGATIVE && nextDirection === LearningDirections.POSITIVE)
  );
}

async function reconcileLearning(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  result: LearningEvaluationResult
): Promise<"created" | "updated" | "superseded" | "failed"> {
  try {
    const existing = await getLiveLearningByKey(supabase, userId, businessProfileId, result.learningKey);

    if (!existing) {
      const created = await insertLearning(supabase, userId, businessProfileId, result);
      if (!created) return "failed";
      await linkLearningEvidence(supabase, userId, businessProfileId, created.id, result);
      return "created";
    }

    if (isMeaningfulDirectionFlip(existing.direction, result.direction)) {
      const created = await insertLearning(supabase, userId, businessProfileId, result);
      if (!created) return "failed";
      await supersedeLearning(supabase, userId, existing.id, created.id);
      await linkLearningEvidence(supabase, userId, businessProfileId, created.id, result);
      return "superseded";
    }

    const updated = await updateLearningInPlace(supabase, userId, existing.id, result);
    if (!updated) return "failed";
    await linkLearningEvidence(supabase, userId, businessProfileId, existing.id, result);
    return "updated";
  } catch (err) {
    logLearningEvaluationEvent({
      event: "reconciliation_failed",
      businessProfileId,
      learningKey: result.learningKey,
      result: "error",
      errorClass: classifyError(err),
    });
    return "failed";
  }
}

/**
 * Evaluates every supported Phase 2 learning family for one business and reconciles
 * the results into marketing_memory_learnings. Bounded (EVALUATION_WINDOW_DAYS,
 * MAX_OBSERVATIONS_PER_EVALUATION — see learningConfig.ts), tenant-scoped, idempotent
 * (repeated calls with unchanged evidence update existing rows to the same values
 * rather than duplicating them). Never throws — every failure is caught, logged, and
 * reflected in the returned summary's counts rather than propagated.
 *
 * This function has exactly one caller path in this PR: a manually-invoked admin route
 * (app/api/admin/trigger-marketing-memory-learning-evaluation/route.ts). It is not
 * wired into Phase 1's observation-ingestion hooks — see
 * docs/MARKETING_MEMORY_LEARNINGS.md for why (avoiding added latency/risk on the
 * already-sensitive approval/publish/analytics hot paths).
 */
export async function evaluateLearningsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  asOf: Date = new Date()
): Promise<EvaluateLearningsSummary> {
  const windowStartIso = new Date(asOf.getTime() - EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const summary: EvaluateLearningsSummary = {
    businessProfileId,
    cohortsEvaluated: 0,
    learningsCreated: 0,
    learningsUpdated: 0,
    learningsSuperseded: 0,
    learningsSkipped: 0,
  };

  try {
    const [performanceRows, actionOutcomeRows] = await Promise.all([
      fetchPerformanceEvidenceRows(supabase, userId, businessProfileId, windowStartIso),
      fetchActionOutcomeEvidenceRows(supabase, userId, businessProfileId, windowStartIso),
    ]);

    const results: LearningEvaluationResult[] = [
      ...evaluateTimingPerformance(businessProfileId, performanceRows, asOf),
      ...evaluateRecommendationActionOutcome(businessProfileId, actionOutcomeRows, asOf),
    ];

    summary.cohortsEvaluated = results.length;

    for (const result of results) {
      const outcome = await reconcileLearning(supabase, userId, businessProfileId, result);

      if (outcome === "created") summary.learningsCreated += 1;
      else if (outcome === "updated") summary.learningsUpdated += 1;
      else if (outcome === "superseded") summary.learningsSuperseded += 1;
      else summary.learningsSkipped += 1;

      logLearningEvaluationEvent({
        event: `learning_${outcome}`,
        businessProfileId,
        learningFamily: result.learningFamily,
        learningKey: result.learningKey,
        confidenceLevel: result.confidenceLevel,
        status: result.status,
      });
    }
  } catch (err) {
    logLearningEvaluationEvent({
      event: "evaluation_failed",
      businessProfileId,
      result: "error",
      errorClass: classifyError(err),
    });
  }

  return summary;
}
