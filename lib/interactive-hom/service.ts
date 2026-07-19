/**
 * Interactive Head of Marketing service — loads existing intelligence and answers.
 * Presentation only: no mutations, no recommendation creation, no schedules.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { askInteractiveHom } from "@/lib/interactive-hom/answerQuestion";
import { buildInteractiveHomContext } from "@/lib/interactive-hom/buildContext";
import { INTERACTIVE_HOM_SUGGESTED_PROMPTS } from "@/lib/interactive-hom/prompts";
import type {
  InteractiveHomAnswer,
  InteractiveHomSuggestedPrompt,
} from "@/lib/interactive-hom/types";
import { loadCommandCenterContextForCurrentUser } from "@/lib/command-center/context";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import { buildMarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidencePackage";
import { createClient } from "@/lib/supabase/server";

export type InteractiveHomServiceDeps = {
  supabaseClient?: SupabaseClient;
  loadBriefing?: typeof getHeadOfMarketingBriefingForCurrentUser;
  loadCommandCenter?: typeof loadCommandCenterContextForCurrentUser;
  loadProfile?: typeof getBusinessProfileForUser;
  buildMemory?: typeof buildMarketingMemoryEvidencePackage;
};

export type InteractiveHomAskResult =
  | {
      ok: true;
      answer: InteractiveHomAnswer;
      suggestedPrompts: readonly InteractiveHomSuggestedPrompt[];
    }
  | { ok: false; status: number; error: string };

/**
 * Answer a customer question using Marketing Director + existing engines only.
 */
export async function askInteractiveHomForCurrentUser(
  question: string,
  deps?: InteractiveHomServiceDeps,
): Promise<InteractiveHomAskResult> {
  const trimmed = question?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, status: 400, error: "Question is required" };
  }
  if (trimmed.length > 500) {
    return { ok: false, status: 400, error: "Question is too long" };
  }

  const loadBriefing = deps?.loadBriefing ?? getHeadOfMarketingBriefingForCurrentUser;
  const loadCommandCenter = deps?.loadCommandCenter ?? loadCommandCenterContextForCurrentUser;
  const loadProfile = deps?.loadProfile ?? getBusinessProfileForUser;
  const buildMemory = deps?.buildMemory ?? buildMarketingMemoryEvidencePackage;
  const supabase = deps?.supabaseClient ?? (await createClient());

  const [briefing, context, profile] = await Promise.all([
    loadBriefing(),
    loadCommandCenter(),
    loadProfile(),
  ]);

  if (!briefing || !profile) {
    return { ok: false, status: 404, error: "Head of Marketing briefing not available" };
  }

  const planJson = context?.planData.plan?.plan_json;
  const businessGoals = (planJson?.businessGoals ?? [])
    .map((goal) => goal.trim())
    .filter(Boolean);
  const profileGoals = (profile.marketing_goals ?? [])
    .map((goal) => goal.trim())
    .filter(Boolean);
  const activeGoals = [...new Set([...businessGoals, ...profileGoals])];

  const memoryEvidence = await buildMemory(supabase, profile.user_id, profile.id, {
    activeGoals,
  });

  const groundedContext = buildInteractiveHomContext({
    briefing,
    memoryEvidence,
    pendingApprovals: context?.approvalStats.pending ?? 0,
    openRecommendations: briefing.recommendation ? 1 : 0,
    unansweredReviews: context?.gbpData.reviewSummary.unansweredCount ?? 0,
    publishFailures: context?.publishingStats.failed ?? 0,
  });

  const answer = askInteractiveHom(trimmed, groundedContext);

  console.info("[InteractiveHom]", {
    scope: "interactive-hom",
    category: answer.category,
    grounded: answer.grounded,
    insufficientData: answer.insufficientData,
    evidenceCount: answer.evidenceLabels.length,
  });

  return {
    ok: true,
    answer,
    suggestedPrompts: INTERACTIVE_HOM_SUGGESTED_PROMPTS,
  };
}

export function getInteractiveHomSuggestedPrompts(): readonly InteractiveHomSuggestedPrompt[] {
  return INTERACTIVE_HOM_SUGGESTED_PROMPTS;
}
