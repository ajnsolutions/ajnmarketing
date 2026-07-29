/**
 * Compose Guided Setup experience from customer-setup + Business Connections.
 * Pure — no I/O.
 */

import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import { SetupStepStatuses } from "@/lib/customer-setup/types";
import type { BusinessConnectionsSnapshot } from "@/lib/business-connections/types";
import { MILESTONE_DEFINITIONS } from "@/lib/guided-setup/milestones";
import { buildFirstWins } from "@/lib/guided-setup/firstWins";
import { buildGuidedEmptyStates } from "@/lib/guided-setup/emptyStates";
import { recommendGuidedNextStep } from "@/lib/guided-setup/recommend";
import {
  GuidedMilestoneKeys,
  KnowledgeStates,
  MilestoneStates,
  type GuidedMilestone,
  type GuidedSetupExperience,
  type KnowledgeSignal,
  type MilestoneState,
} from "@/lib/guided-setup/types";

function stepComplete(
  setup: CustomerSetupSnapshot,
  keys: string[],
): boolean {
  return keys.every((key) => {
    const step = setup.steps.find((s) => s.key === key);
    if (!step) return false;
    // OPTIONAL means "available to do later" — not unlocked yet.
    return (
      step.status === SetupStepStatuses.COMPLETE ||
      step.status === SetupStepStatuses.SKIPPED
    );
  });
}

function evaluateMilestones(setup: CustomerSetupSnapshot): GuidedMilestone[] {
  const evaluated: GuidedMilestone[] = MILESTONE_DEFINITIONS.map((def) => {
    let complete = stepComplete(setup, def.relatedSetupStepKeys);
    // Advisor-ready mirrors setup headOfMarketingReady.
    if (def.key === GuidedMilestoneKeys.ADVISOR_READY) {
      complete = setup.headOfMarketingReady;
    }

    return {
      key: def.key,
      title: def.title,
      knownSummary: def.knownSummary,
      brainImprovement: def.brainImprovement,
      state: complete ? MilestoneStates.COMPLETE : MilestoneStates.UPCOMING,
      relatedSetupStepKeys: [...def.relatedSetupStepKeys],
      relatedConnectionCategories: [...def.relatedConnectionCategories],
    };
  });

  // Mark exactly one CURRENT among incomplete required; optional waiting separately.
  let currentAssigned = false;
  for (const milestone of evaluated) {
    if (milestone.state === MilestoneStates.COMPLETE) continue;
    const def = MILESTONE_DEFINITIONS.find((d) => d.key === milestone.key)!;
    if (!def.requiredForAdvisor) {
      milestone.state = MilestoneStates.OPTIONAL_WAITING;
      continue;
    }
    if (!currentAssigned) {
      milestone.state = MilestoneStates.CURRENT;
      currentAssigned = true;
    } else {
      milestone.state = MilestoneStates.UPCOMING;
    }
  }

  return evaluated;
}

function knowledgeSignals(
  setup: CustomerSetupSnapshot,
  connections: BusinessConnectionsSnapshot | null,
): KnowledgeSignal[] {
  const signals: KnowledgeSignal[] = [];

  const business = setup.steps.find((s) => s.key === "business_info");
  signals.push({
    id: "ks_business",
    label: "Business basics",
    state:
      business?.status === SetupStepStatuses.COMPLETE
        ? KnowledgeStates.KNOWN
        : KnowledgeStates.WAITING,
    detail:
      business?.status === SetupStepStatuses.COMPLETE
        ? "I know how to refer to your business."
        : "Waiting for business information — nothing is broken; I'm just not ready to advise yet.",
  });

  const goals = setup.steps.find((s) => s.key === "marketing_goals");
  signals.push({
    id: "ks_goals",
    label: "Goals",
    state:
      goals?.status === SetupStepStatuses.COMPLETE
        ? KnowledgeStates.KNOWN
        : KnowledgeStates.WAITING,
    detail:
      goals?.status === SetupStepStatuses.COMPLETE
        ? "I know what success looks like for you."
        : "Waiting for goals so recommendations stay focused.",
  });

  const website = setup.steps.find((s) => s.key === "website");
  if (website?.status === SetupStepStatuses.COMPLETE) {
    signals.push({
      id: "ks_website",
      label: "Website understanding",
      state: KnowledgeStates.KNOWN,
      detail: "I've learned from your website setup.",
    });
  } else if (website?.status === SetupStepStatuses.IN_PROGRESS) {
    signals.push({
      id: "ks_website",
      label: "Website understanding",
      state: KnowledgeStates.LEARNING,
      detail: "I'm still learning from your website — insight improves as analysis finishes.",
    });
  } else {
    signals.push({
      id: "ks_website",
      label: "Website understanding",
      state: KnowledgeStates.WAITING,
      detail:
        "Waiting for website understanding — optional, but it improves SEO and content fit.",
    });
  }

  const gbp = setup.steps.find((s) => s.key === "google_business");
  const feedbackReady = connections?.readiness.find(
    (r) => r.id === "readiness_customer_feedback",
  );
  if (gbp?.status === SetupStepStatuses.COMPLETE || feedbackReady?.state === "available") {
    signals.push({
      id: "ks_voice",
      label: "Customer feedback",
      state: KnowledgeStates.KNOWN,
      detail: "Customer feedback is available for authentic recommendations.",
    });
  } else if (gbp?.status === SetupStepStatuses.NEEDS_ATTENTION) {
    signals.push({
      id: "ks_voice",
      label: "Customer feedback",
      state: KnowledgeStates.LEARNING,
      detail: "Your Google connection needs a quick reconnect — insight will return afterward.",
    });
  } else {
    signals.push({
      id: "ks_voice",
      label: "Customer feedback",
      state: KnowledgeStates.WAITING,
      detail:
        "Waiting for customer feedback — connect Google when ready for richer Customer Voice.",
    });
  }

  if (setup.headOfMarketingReady) {
    signals.push({
      id: "ks_advisor",
      label: "Weekly advice",
      state: KnowledgeStates.KNOWN,
      detail: "Enough is known for a trustworthy Growth Advisor meeting.",
    });
  } else {
    signals.push({
      id: "ks_advisor",
      label: "Weekly advice",
      state: KnowledgeStates.LEARNING,
      detail: "I'm learning your foundation before giving weekly recommendations.",
    });
  }

  return signals;
}

function headlineFor(milestones: GuidedMilestone[], advisorReady: boolean): {
  headline: string;
  lead: string;
} {
  if (advisorReady) {
    const optionalOpen = milestones.some(
      (m) => m.state === MilestoneStates.OPTIONAL_WAITING,
    );
    return {
      headline: optionalOpen
        ? "You're ready — deepen insight when you want"
        : "Setup is in a great place",
      lead: optionalOpen
        ? "Required foundation is done. One optional connection can unlock richer Customer Voice — never required to start."
        : "The Business Brain has enough to advise you weekly. Connect more only when it helps.",
    };
  }

  const current = milestones.find((m) => m.state === MilestoneStates.CURRENT);
  return {
    headline: current
      ? `Next milestone: ${current.title}`
      : "Let's get your first wins",
    lead: current
      ? `${current.brainImprovement} One step at a time — never a long checklist.`
      : "A few meaningful steps unlock trustworthy recommendations fast.",
  };
}

export function buildGuidedSetupExperience(input: {
  setup: CustomerSetupSnapshot;
  connections?: BusinessConnectionsSnapshot | null;
  businessName?: string | null;
  now?: Date;
}): GuidedSetupExperience {
  const milestones = evaluateMilestones(input.setup);
  const completedKeys = milestones
    .filter((m) => m.state === MilestoneStates.COMPLETE)
    .map((m) => m.key);
  const firstWins = buildFirstWins(completedKeys);
  const latestFirstWin = firstWins.length > 0 ? firstWins[firstWins.length - 1]! : null;
  const recommendedNext = recommendGuidedNextStep({
    setup: input.setup,
    milestones,
    connectionRecommendation: input.connections?.recommendedNext ?? null,
  });
  const emptyStates = buildGuidedEmptyStates({
    milestones,
    readiness: input.connections?.readiness ?? [],
  });
  const knowledge = knowledgeSignals(input.setup, input.connections ?? null);
  const advisorReady = input.setup.headOfMarketingReady;
  const { headline, lead } = headlineFor(milestones, advisorReady);

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    businessName: input.businessName?.trim() || "your business",
    milestones,
    firstWins,
    latestFirstWin,
    recommendedNext,
    emptyStates,
    knowledgeSignals: knowledge,
    advisorReady,
    headline,
    lead,
  };
}

/** Helper for tests — expose milestone state typing. */
export type { MilestoneState };
