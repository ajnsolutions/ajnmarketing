import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import type { BusinessProfile } from "@/lib/business-profile";
import { runWebsiteAnalysisForUser } from "@/lib/website-analysis/service";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import {
  generateAiMarketingProfileForUser,
  type GenerateAiMarketingProfileResult,
} from "@/lib/ai-marketing-profile/service";
import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import { generateWeeklyMarketContextBrief } from "@/lib/market-context/marketContextService";
import { getLatestMarketContextBriefWithItemsForUser } from "@/lib/market-context/persistence";
import type { MarketContextBriefWithItems } from "@/lib/market-context/types";
import {
  evaluateOpportunitiesForUser,
  type OpportunityDetectionResult,
} from "@/lib/marketing-opportunities/detectionEngine";
import {
  runMarketingDecisionEngineForUser,
  type MarketingDecisionResult,
} from "@/lib/marketing-decisions/service";
import {
  executeEligibleRecommendationsForUser,
  type RecommendationExecutionDeps,
} from "@/lib/recommendation-execution/engine";
import type { RecommendationExecutionBatchResult } from "@/lib/recommendation-execution/types";
import { logAuditEvent } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import {
  PIPELINE_STAGE_ORDER,
  buildPipelineAuditMetadata,
  buildPipelineStageSummary,
  derivePipelineOverallStatus,
  mapPipelineStatusToAuditStatus,
  PipelineOverallStatuses,
  type PipelineStageName,
  type PipelineStageResult,
  type PipelineStageStatus,
  type RecommendationPipelineResult,
} from "@/lib/recommendation-pipeline/types";

// A brief refreshed within this window is left alone rather than re-fetched. Phase 2D
// daily autonomous cadence: refresh Market Context when the latest active brief is at
// least 24 hours old. Opportunity Detection + Decision Engine still run on the daily
// schedule even when this stage is skipped as fresh.
export const MARKET_CONTEXT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Fixed, hand-authored failure reasons — never a caught exception's message or a
 * returned `error` string interpolated directly. The stage functions this orchestrator
 * calls each already have their own SafeContentDraftError-equivalent or audit-logged
 * failure handling internally (see e.g. AiMarketingProfileGenerationError,
 * markWebsiteAnalysisFailed); a returned `error` string from one of them is not
 * guaranteed to be free of raw provider text (e.g. AiMarketingProfileFailureDetails.message
 * can carry a raw OpenAI error message through). Rather than re-deriving which fields are
 * safe to surface from each dependency, this orchestrator applies the same unconditional
 * fallback guarantee PR #15's SafeContentDraftError pattern established: every failure
 * this file itself reports is one fixed string, full stop. Diagnostic detail remains
 * available through each real stage function's own audit-log trail
 * (WEBSITE_ANALYSIS_FAILED, AI_MARKETING_PROFILE_GENERATION_FAILED,
 * MARKETING_OPPORTUNITIES_DETECTION_FAILED, etc.), not through this return value.
 */
const GENERIC_STAGE_FAILURE_MESSAGES: Record<PipelineStageName, string> = {
  website_analysis: "Website analysis failed.",
  ai_marketing_profile: "AI marketing profile generation failed.",
  market_context: "Market context refresh failed.",
  opportunity_detection: "Opportunity detection failed.",
  decision_engine: "Decision engine failed.",
  content_execution: "Recommendation content execution failed.",
};

/**
 * Every stage-calling function is independently overridable, defaulting to the real
 * implementation. Lets tests exercise the orchestrator's own control flow (skip
 * conditions, ordering, error containment) without invoking real OpenAI/network calls —
 * each real stage function already has its own dedicated test coverage elsewhere.
 * Mirrors the `deps` pattern already established in
 * lib/marketing-decisions/create-content.ts.
 */
export type RecommendationPipelineDeps = {
  runWebsiteAnalysis?: (
    userId: string,
    supabase: SupabaseClient
  ) => Promise<WebsiteAnalysis | null>;
  generateAiMarketingProfile?: (
    userId: string,
    supabase: SupabaseClient
  ) => Promise<GenerateAiMarketingProfileResult>;
  refreshMarketContext?: (input: {
    userId: string;
    businessProfileId: string;
    referenceDate?: Date;
    supabaseClient?: SupabaseClient;
  }) => Promise<{ briefWithItems: MarketContextBriefWithItems | null; error?: string }>;
  evaluateOpportunities?: (
    userId: string,
    supabase: SupabaseClient,
    now?: Date
  ) => Promise<OpportunityDetectionResult | null>;
  runDecisionEngine?: (
    userId: string,
    businessProfileId: string,
    supabase: SupabaseClient,
    now?: Date
  ) => Promise<MarketingDecisionResult>;
  executeEligibleRecommendations?: (
    userId: string,
    supabase: SupabaseClient,
    deps?: RecommendationExecutionDeps
  ) => Promise<RecommendationExecutionBatchResult>;
};

async function runWebsiteAnalysisStage(
  supabase: SupabaseClient,
  userId: string,
  businessProfile: BusinessProfile,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "website_analysis";

  if (!businessProfile.website?.trim()) {
    return { stage, status: "skipped", reason: "No website configured for this business profile." };
  }

  const existing = await getWebsiteAnalysisForUser(supabase, userId);
  if (existing?.analysis_status === "completed") {
    return {
      stage,
      status: "skipped",
      reason: "Website analysis already completed. Use the dashboard's Refresh Analysis action to force a rerun.",
    };
  }
  if (existing?.analysis_status === "running") {
    return { stage, status: "skipped", reason: "Website analysis is already running." };
  }

  try {
    const runWebsiteAnalysis = deps.runWebsiteAnalysis ?? runWebsiteAnalysisForUser;
    const result = await runWebsiteAnalysis(userId, supabase);
    if (!result) {
      return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.website_analysis };
    }
    return {
      stage,
      status: "completed",
      reason: "Website analysis completed.",
      details: { analysisId: result.id, analysisStatus: result.analysis_status },
    };
  } catch {
    return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.website_analysis };
  }
}

/**
 * True when a completed Website Analysis is demonstrably newer than the current AI
 * profile — the only scheduled path that may regenerate an already-active profile.
 * Avoids unnecessary OpenAI calls when analysis has not changed.
 */
export function shouldRegenerateAiProfileForWebsiteAnalysis(
  profileUpdatedAt: string | null | undefined,
  websiteAnalysis: { analysis_status: string; updated_at?: string | null } | null | undefined
): boolean {
  if (!websiteAnalysis || websiteAnalysis.analysis_status !== "completed") return false;
  if (!websiteAnalysis.updated_at) return false;
  if (!profileUpdatedAt) return true;
  return new Date(websiteAnalysis.updated_at).getTime() > new Date(profileUpdatedAt).getTime();
}

async function runAiMarketingProfileStage(
  supabase: SupabaseClient,
  userId: string,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "ai_marketing_profile";

  const existing = await getAiMarketingProfileForUser(supabase, userId);
  if (existing?.profile_status === "generating") {
    return { stage, status: "skipped", reason: "AI marketing profile generation is already in progress." };
  }

  if (existing?.profile_status === "active") {
    const websiteAnalysis = await getWebsiteAnalysisForUser(supabase, userId);
    if (!shouldRegenerateAiProfileForWebsiteAnalysis(existing.updated_at, websiteAnalysis)) {
      return {
        stage,
        status: "skipped",
        reason:
          "AI marketing profile already active and Website Analysis is not newer. Use the dashboard's Refresh AI Profile action to force a rerun.",
      };
    }
  }

  try {
    const generateAiMarketingProfile = deps.generateAiMarketingProfile ?? generateAiMarketingProfileForUser;
    const { profile, error } = await generateAiMarketingProfile(userId, supabase);
    if (error || !profile) {
      return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.ai_marketing_profile };
    }
    return {
      stage,
      status: "completed",
      reason: "AI marketing profile generated.",
      details: { profileId: profile.id, profileStatus: profile.profile_status },
    };
  } catch {
    return {
      stage,
      status: "failed",
      reason: GENERIC_STAGE_FAILURE_MESSAGES.ai_marketing_profile,
    };
  }
}

async function runMarketContextStage(
  supabase: SupabaseClient,
  userId: string,
  businessProfile: BusinessProfile,
  now: Date,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "market_context";

  const existing = await getLatestMarketContextBriefWithItemsForUser(supabase, userId);
  // Generating-in-progress is enforced inside generateWeeklyMarketContextBrief /
  // upsertMarketContextBriefGenerating (unique week key + alreadyGenerating). Keep only
  // the product cadence skip here: don't force a refresh more often than weekly.
  if (existing?.brief.status === "active") {
    const ageMs = now.getTime() - new Date(existing.brief.created_at).getTime();
    if (ageMs < MARKET_CONTEXT_STALE_AFTER_MS) {
      return {
        stage,
        status: "skipped",
        reason: "Market context brief is recent (refreshed within the last 24 hours).",
      };
    }
  }

  try {
    const refreshMarketContext = deps.refreshMarketContext ?? generateWeeklyMarketContextBrief;
    const { briefWithItems, error } = await refreshMarketContext({
      userId,
      businessProfileId: businessProfile.id,
      referenceDate: now,
      supabaseClient: supabase,
    });
    if (error || !briefWithItems) {
      if (error?.includes("already in progress")) {
        return {
          stage,
          status: "skipped",
          reason: "Market context brief generation is already in progress.",
        };
      }
      return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.market_context };
    }
    return {
      stage,
      status: "completed",
      reason: "Market context brief refreshed.",
      details: { briefId: briefWithItems.brief.id, itemCount: briefWithItems.items.length },
    };
  } catch {
    return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.market_context };
  }
}

async function runOpportunityDetectionStage(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "opportunity_detection";

  try {
    const evaluateOpportunities = deps.evaluateOpportunities ?? evaluateOpportunitiesForUser;
    const detection = await evaluateOpportunities(userId, supabase, now);
    if (!detection) {
      return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.opportunity_detection };
    }
    return {
      stage,
      status: "completed",
      reason: "Opportunity detection completed.",
      details: { opportunityCount: detection.opportunities.length, expiredCount: detection.expiredCount },
    };
  } catch {
    return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.opportunity_detection };
  }
}

async function runDecisionEngineStage(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  opportunityStageStatus: PipelineStageStatus,
  now: Date,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "decision_engine";

  // Opportunity Detection failing (a real error, not merely "detected nothing") means
  // marketing_opportunities may be in an unknown state for this run -- running the
  // decision engine against it isn't unsafe (it only ever reads already-persisted rows,
  // never this run's in-memory result), but there's no reason to attempt a second stage
  // whose most likely failure mode (DB/connectivity) would just repeat the first one.
  if (opportunityStageStatus === "failed") {
    return { stage, status: "skipped", reason: "Skipped because opportunity_detection failed." };
  }

  try {
    const runDecisionEngine = deps.runDecisionEngine ?? runMarketingDecisionEngineForUser;
    const decision = await runDecisionEngine(userId, businessProfileId, supabase, now);
    return {
      stage,
      status: "completed",
      reason: "Decision engine completed.",
      details: {
        recommendationCount: decision.recommendations.length,
        supersededCount: decision.supersededCount,
        evaluatedOpportunityCount: decision.evaluatedOpportunityCount,
      },
    };
  } catch {
    return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.decision_engine };
  }
}

async function runContentExecutionStage(
  supabase: SupabaseClient,
  userId: string,
  decisionEngineStatus: PipelineStageStatus,
  deps: RecommendationPipelineDeps
): Promise<PipelineStageResult> {
  const stage: PipelineStageName = "content_execution";

  // Same dependency shape as decision_engine's own reliance on opportunity_detection:
  // a hard failure in the prior stage (not "produced nothing", an actual thrown error)
  // signals the same DB/connectivity problem would likely just repeat here.
  if (decisionEngineStatus === "failed") {
    return { stage, status: "skipped", reason: "Skipped because decision_engine failed." };
  }

  try {
    const executeEligibleRecommendations =
      deps.executeEligibleRecommendations ?? executeEligibleRecommendationsForUser;
    const { summary, results } = await executeEligibleRecommendations(userId, supabase, {});

    if (summary.evaluated === 0) {
      return {
        stage,
        status: "skipped",
        reason: "No eligible recommendations to execute.",
      };
    }

    return {
      stage,
      status: "completed",
      reason: `Evaluated ${summary.evaluated} recommendation(s): ${summary.executed} executed, ${summary.alreadyExecuted} already executed, ${summary.skipped} skipped, ${summary.unsupported} unsupported, ${summary.failed} failed.`,
      details: {
        evaluated: summary.evaluated,
        executed: summary.executed,
        alreadyExecuted: summary.alreadyExecuted,
        skipped: summary.skipped,
        unsupported: summary.unsupported,
        failed: summary.failed,
        recommendationIds: results.map((r) => r.recommendationId),
      },
    };
  } catch {
    return { stage, status: "failed", reason: GENERIC_STAGE_FAILURE_MESSAGES.content_execution };
  }
}

/**
 * Runs the full recommendation pipeline for one user:
 *   Website Analysis (if applicable) -> AI Marketing Profile -> Market Context refresh
 *   -> Opportunity Detection -> Marketing Decision Engine -> Recommendation Execution
 *
 * This is orchestration only -- every stage's own persistence layer already guarantees
 * idempotency (upsert-by-user for Website Analysis/AI Marketing Profile, dedupe-key
 * upsert + status-preservation for opportunities/recommendations, a partial unique index
 * on content_approvals.marketing_recommendation_id for drafts); this function adds skip
 * conditions on top so a rerun doesn't redundantly repeat expensive, already-fresh work
 * (see each stage helper above for its specific skip rule).
 *
 * A stage failing never prevents a later, independent stage from running -- only
 * Decision Engine (on Opportunity Detection not having failed) and Content Execution
 * (on Decision Engine not having failed) have a real dependency on the stage before them.
 * Every stage catches its own errors and returns a PipelineStageResult rather than
 * throwing, so one bad stage can never abort the rest of the run.
 *
 * Accepts an optional injected Supabase client — omitted, it defaults to the
 * request-scoped cookie client exactly like every other *ForUser function in this
 * codebase; pass a service-role client (lib/supabase/service.ts) to run this for any
 * tenant from background-job, admin, or future Trigger.dev execution with no cookies or
 * session. No stage in this file constructs its own client independently of the one
 * passed through.
 */
export async function runRecommendationPipelineForUser(
  userId: string,
  supabaseClient?: SupabaseClient,
  deps: RecommendationPipelineDeps = {},
  now: Date = new Date()
): Promise<RecommendationPipelineResult> {
  const supabase = supabaseClient ?? (await createClient());
  const startedAt = now;
  const startedAtIso = startedAt.toISOString();

  const businessProfile = await getBusinessProfileForUserId(supabase, userId);

  if (!businessProfile) {
    const reason = "No business profile exists for this user yet.";
    const stages = PIPELINE_STAGE_ORDER.map((stage) => ({
      stage,
      status: "skipped" as const,
      reason,
    }));
    const status = derivePipelineOverallStatus(stages);
    const summary = buildPipelineStageSummary(stages, status);
    const finishedAt = new Date();
    return {
      userId,
      businessProfileId: null,
      status,
      stages,
      summary,
      startedAt: startedAtIso,
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  await logAuditEvent(supabase, {
    userId,
    businessProfileId: businessProfile.id,
    action: AuditActions.RECOMMENDATION_PIPELINE_STARTED,
    entityType: "recommendation_pipeline",
    status: "started",
  });

  const stages: PipelineStageResult[] = [];

  stages.push(await runWebsiteAnalysisStage(supabase, userId, businessProfile, deps));
  stages.push(await runAiMarketingProfileStage(supabase, userId, deps));
  stages.push(await runMarketContextStage(supabase, userId, businessProfile, now, deps));

  const opportunityStage = await runOpportunityDetectionStage(supabase, userId, now, deps);
  stages.push(opportunityStage);

  const decisionEngineStage = await runDecisionEngineStage(
    supabase,
    userId,
    businessProfile.id,
    opportunityStage.status,
    now,
    deps
  );
  stages.push(decisionEngineStage);

  stages.push(await runContentExecutionStage(supabase, userId, decisionEngineStage.status, deps));

  const status = derivePipelineOverallStatus(stages);
  const summary = buildPipelineStageSummary(stages, status);
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const result: RecommendationPipelineResult = {
    userId,
    businessProfileId: businessProfile.id,
    status,
    stages,
    summary,
    startedAt: startedAtIso,
    finishedAt: finishedAt.toISOString(),
    durationMs,
  };

  const auditStatus = mapPipelineStatusToAuditStatus(status);
  await logAuditEvent(supabase, {
    userId,
    businessProfileId: businessProfile.id,
    action:
      status === PipelineOverallStatuses.FAILURE
        ? AuditActions.RECOMMENDATION_PIPELINE_FAILED
        : AuditActions.RECOMMENDATION_PIPELINE_COMPLETED,
    entityType: "recommendation_pipeline",
    status: auditStatus,
    metadata: buildPipelineAuditMetadata(result),
  });

  return result;
}

/** Cookie-bound convenience wrapper — resolves the signed-in user, then delegates. */
export async function runRecommendationPipelineForCurrentUser(
  deps: RecommendationPipelineDeps = {}
): Promise<RecommendationPipelineResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return runRecommendationPipelineForUser(user.id, supabase, deps);
}
