/**
 * Deterministic customer setup progress calculator.
 * Pure — no I/O. Facts + preferences in, snapshot out.
 */

import { listSetupStepDefinitions } from "@/lib/customer-setup/steps";
import { stripMagicGoalMarkers } from "@/lib/onboarding-storage";
import {
  SetupOverallStatuses,
  SetupStepKeys,
  SetupStepStatuses,
  type CustomerSetupFacts,
  type CustomerSetupPreferences,
  type CustomerSetupSnapshot,
  type SetupOverallStatus,
  type SetupStepKey,
  type SetupStepStatus,
  type SetupStepView,
} from "@/lib/customer-setup/types";

function hasBusinessBasics(facts: CustomerSetupFacts): boolean {
  const name = facts.businessName?.trim() ?? "";
  return facts.hasBusinessProfile && Boolean(name) && name !== "Your Business";
}

function hasCustomerGoals(facts: CustomerSetupFacts): boolean {
  // Traditional picker goals…
  if (stripMagicGoalMarkers(facts.marketingGoals).length > 0) return true;
  // …or Magic onboarding audience/origin markers (authoritative today).
  return facts.marketingGoals.some(
    (goal) => goal.startsWith("Audience:") || goal.startsWith("Customers:"),
  );
}

function hasBrandVoice(facts: CustomerSetupFacts): boolean {
  return Boolean(facts.brandVoiceTone?.trim() || facts.preferredWords?.trim());
}

function dependencyBlocked(
  dependencyKeys: SetupStepKey[],
  statusByKey: Map<SetupStepKey, SetupStepStatus>,
): boolean {
  return dependencyKeys.some((key) => {
    const status = statusByKey.get(key);
    return (
      status !== SetupStepStatuses.COMPLETE &&
      status !== SetupStepStatuses.SKIPPED &&
      status !== SetupStepStatuses.OPTIONAL
    );
  });
}

function evaluateStepStatus(input: {
  key: SetupStepKey;
  facts: CustomerSetupFacts;
  skipped: Set<SetupStepKey>;
  acknowledged: Set<SetupStepKey>;
}): { status: SetupStepStatus; statusReason: string; blockedReason: string | null; freshnessLabel: string | null; completionCriteria: string } {
  const { key, facts, skipped, acknowledged } = input;

  switch (key) {
    case SetupStepKeys.BUSINESS_INFO: {
      if (hasBusinessBasics(facts)) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Business basics are saved.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "A real business name is saved.",
        };
      }
      return {
        status: SetupStepStatuses.NOT_STARTED,
        statusReason: "Add your business name to get started.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "A real business name is saved.",
      };
    }
    case SetupStepKeys.WEBSITE: {
      if (facts.websiteUrl?.trim()) {
        if (facts.websiteAnalysis.failed) {
          return {
            status: SetupStepStatuses.NEEDS_ATTENTION,
            statusReason: "Website analysis did not finish. You can retry anytime.",
            blockedReason: null,
            freshnessLabel: null,
            completionCriteria: "Website URL saved, or confirmed no website.",
          };
        }
        return {
          status: facts.websiteAnalysis.exists
            ? SetupStepStatuses.COMPLETE
            : SetupStepStatuses.IN_PROGRESS,
          statusReason: facts.websiteAnalysis.exists
            ? "Website is on file."
            : "Website saved — analysis can continue in the background.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Website URL saved, or confirmed no website.",
        };
      }
      if (facts.noWebsiteConfirmed || skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Marked as no website for now.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Website URL saved, or confirmed no website.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional — add a website or skip if you do not have one.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Website URL saved, or confirmed no website.",
      };
    }
    case SetupStepKeys.MARKETING_GOALS: {
      if (hasCustomerGoals(facts)) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "At least one marketing goal is set.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "At least one customer-facing marketing goal is saved.",
        };
      }
      return {
        status: SetupStepStatuses.NOT_STARTED,
        statusReason: "Choose what success looks like for your marketing.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "At least one customer-facing marketing goal is saved.",
      };
    }
    case SetupStepKeys.BRAND_VOICE: {
      if (hasBrandVoice(facts)) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Brand voice guidance is saved.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Tone or preferred words are saved.",
        };
      }
      if (skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Skipped for now — you can add voice guidance later.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Tone or preferred words are saved.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Recommended before content drafting.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Tone or preferred words are saved.",
      };
    }
    case SetupStepKeys.GOOGLE_BUSINESS: {
      if (facts.gbp.setupRequired) {
        return {
          status: SetupStepStatuses.TEMPORARILY_UNAVAILABLE,
          statusReason: "Google connection is not available in this environment yet.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Google Business Profile connected and healthy.",
        };
      }
      if (facts.gbp.connected && facts.gbp.scopesValid) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Google Business Profile is connected.",
          blockedReason: null,
          freshnessLabel: facts.gbp.lastSyncedAt
            ? `Last synced ${new Date(facts.gbp.lastSyncedAt).toLocaleString()}`
            : "Connected — sync when you are ready",
          completionCriteria: "Google Business Profile connected and healthy.",
        };
      }
      // Only flag needs-attention when a prior connection has gone bad — never for first-time disconnect.
      const priorConnectionNeedsAttention =
        facts.gbp.connectionStatus === "expired" ||
        facts.gbp.connectionStatus === "revoked" ||
        facts.gbp.connectionStatus === "error" ||
        (Boolean(facts.gbp.connectionStatus) &&
          facts.gbp.connectionStatus !== "not_connected" &&
          !facts.gbp.scopesValid);
      if (priorConnectionNeedsAttention) {
        return {
          status: SetupStepStatuses.NEEDS_ATTENTION,
          statusReason: "Google needs to be reconnected before local features work again.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Google Business Profile connected and healthy.",
        };
      }
      if (skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Skipped for now — local Google features stay limited.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Google Business Profile connected and healthy.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional — unlocks posts, reviews, and local insights.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Google Business Profile connected and healthy.",
      };
    }
    case SetupStepKeys.NOTIFICATIONS: {
      if (acknowledged.has(key) || skipped.has(key)) {
        return {
          status: skipped.has(key) ? SetupStepStatuses.SKIPPED : SetupStepStatuses.COMPLETE,
          statusReason: "Notification preferences reviewed.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Notification preferences reviewed or deferred.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional — review how you want to be notified.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Notification preferences reviewed or deferred.",
      };
    }
    case SetupStepKeys.AI_MARKETING_PROFILE: {
      if (facts.aiMarketingProfileExists) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Marketing profile is available.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "A marketing profile record exists.",
        };
      }
      if (skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Skipped for now.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "A marketing profile record exists.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Recommended after business basics.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "A marketing profile record exists.",
      };
    }
    case SetupStepKeys.MARKETING_PLAN: {
      if (facts.marketingPlanExists) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "A marketing plan is available.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "A marketing plan exists for your business.",
        };
      }
      if (skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Skipped for now.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "A marketing plan exists for your business.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Recommended once basics are in place.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "A marketing plan exists for your business.",
      };
    }
    case SetupStepKeys.HEAD_OF_MARKETING: {
      const ready =
        facts.onboardingCompleted && hasBusinessBasics(facts) && hasCustomerGoals(facts);
      if (ready) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Head of Marketing is ready to use.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Onboarding complete with business basics and a marketing goal.",
        };
      }
      return {
        status: SetupStepStatuses.NOT_STARTED,
        statusReason: "Finish business basics and a marketing goal first.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Onboarding complete with business basics and a marketing goal.",
      };
    }
    case SetupStepKeys.APPROVAL_EDUCATION:
    case SetupStepKeys.PUBLISHING_EDUCATION: {
      if (acknowledged.has(key) || skipped.has(key)) {
        return {
          status: skipped.has(key) ? SetupStepStatuses.SKIPPED : SetupStepStatuses.COMPLETE,
          statusReason: "Acknowledged.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Educational step acknowledged.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional education — helps avoid confusion later.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Educational step acknowledged.",
      };
    }
    case SetupStepKeys.CONTENT_READY: {
      if (hasBrandVoice(facts) || facts.aiMarketingProfileExists) {
        return {
          status: SetupStepStatuses.COMPLETE,
          statusReason: "Enough context exists for useful drafts.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Brand voice or marketing profile is present.",
        };
      }
      if (skipped.has(key)) {
        return {
          status: SetupStepStatuses.SKIPPED,
          statusReason: "Skipped for now.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Brand voice or marketing profile is present.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional — add voice or profile before drafting.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Brand voice or marketing profile is present.",
      };
    }
    case SetupStepKeys.MARKETING_PREFERENCES: {
      if (acknowledged.has(key) || skipped.has(key)) {
        return {
          status: skipped.has(key) ? SetupStepStatuses.SKIPPED : SetupStepStatuses.COMPLETE,
          statusReason: "Preferences reviewed.",
          blockedReason: null,
          freshnessLabel: null,
          completionCriteria: "Preferences reviewed or deferred.",
        };
      }
      return {
        status: SetupStepStatuses.OPTIONAL,
        statusReason: "Optional enhancement.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Preferences reviewed or deferred.",
      };
    }
    default:
      return {
        status: SetupStepStatuses.NOT_STARTED,
        statusReason: "Status unavailable.",
        blockedReason: null,
        freshnessLabel: null,
        completionCriteria: "Complete this step.",
      };
  }
}

export function shouldShowDashboardSetupCard(snapshot: CustomerSetupSnapshot): boolean {
  const needsAttention = snapshot.needsAttentionStepKeys.length > 0;
  // Needs-attention always surfaces — dismissal cannot hide failures.
  if (needsAttention) return true;

  const requiredIncomplete = snapshot.requiredComplete < snapshot.requiredTotal;
  if (!requiredIncomplete) return false;

  // Soft dismiss: hide the card until setup regresses or needs attention.
  if (snapshot.preferences?.onboarding_dismissed_at) return false;
  return true;
}

export function missingRequiredSetupSteps(snapshot: CustomerSetupSnapshot): Array<{
  key: SetupStepKey;
  title: string;
  statusReason: string;
  href: string;
}> {
  return snapshot.steps
    .filter(
      (step) =>
        step.required &&
        step.status !== SetupStepStatuses.COMPLETE &&
        step.status !== SetupStepStatuses.SKIPPED,
    )
    .map((step) => ({
      key: step.key,
      title: step.title,
      statusReason: step.statusReason,
      href: step.destinationRoute,
    }));
}

export function computeCustomerSetupSnapshot(input: {
  businessProfileId: string;
  facts: CustomerSetupFacts;
  preferences: CustomerSetupPreferences | null;
  warnings?: string[];
}): CustomerSetupSnapshot {
  const skipped = new Set(input.preferences?.skipped_step_keys ?? []);
  const acknowledged = new Set(input.preferences?.acknowledged_step_keys ?? []);
  const definitions = listSetupStepDefinitions();

  const provisional = new Map<SetupStepKey, ReturnType<typeof evaluateStepStatus>>();
  for (const definition of definitions) {
    provisional.set(
      definition.key,
      evaluateStepStatus({
        key: definition.key,
        facts: input.facts,
        skipped,
        acknowledged,
      }),
    );
  }

  const statusByKey = new Map<SetupStepKey, SetupStepStatus>();
  for (const [key, value] of provisional) {
    statusByKey.set(key, value.status);
  }

  // Apply dependency blocking without inventing new completion.
  for (const definition of definitions) {
    const current = provisional.get(definition.key)!;
    if (
      current.status === SetupStepStatuses.COMPLETE ||
      current.status === SetupStepStatuses.SKIPPED ||
      current.status === SetupStepStatuses.NEEDS_ATTENTION ||
      current.status === SetupStepStatuses.TEMPORARILY_UNAVAILABLE
    ) {
      continue;
    }
    if (dependencyBlocked(definition.dependencyKeys, statusByKey)) {
      provisional.set(definition.key, {
        ...current,
        status: SetupStepStatuses.BLOCKED,
        blockedReason: "Finish the earlier required setup step first.",
        statusReason: "Waiting on an earlier setup step.",
      });
      statusByKey.set(definition.key, SetupStepStatuses.BLOCKED);
    }
  }

  const steps: SetupStepView[] = definitions.map((definition) => {
    const evaluated = provisional.get(definition.key)!;
    return {
      ...definition,
      status: evaluated.status,
      statusReason: evaluated.statusReason,
      blockedReason: evaluated.blockedReason,
      completionCriteria: evaluated.completionCriteria,
      freshnessLabel: evaluated.freshnessLabel,
    };
  });

  const requiredSteps = steps.filter((step) => step.required);
  const optionalSteps = steps.filter((step) => !step.required);
  const requiredComplete = requiredSteps.filter(
    (step) => step.status === SetupStepStatuses.COMPLETE,
  ).length;
  const optionalComplete = optionalSteps.filter(
    (step) =>
      step.status === SetupStepStatuses.COMPLETE || step.status === SetupStepStatuses.SKIPPED,
  ).length;
  const requiredTotal = requiredSteps.length;
  const requiredPercentComplete =
    requiredTotal === 0 ? 100 : Math.round((requiredComplete / requiredTotal) * 100);

  const blockedStepKeys = steps
    .filter((step) => step.status === SetupStepStatuses.BLOCKED)
    .map((step) => step.key);
  const needsAttentionStepKeys = steps
    .filter((step) => step.status === SetupStepStatuses.NEEDS_ATTENTION)
    .map((step) => step.key);

  const headOfMarketingReady =
    steps.find((step) => step.key === SetupStepKeys.HEAD_OF_MARKETING)?.status ===
    SetupStepStatuses.COMPLETE;
  const canEnterMainProduct = headOfMarketingReady;
  const publishingReady = Boolean(
    steps.find((step) => step.key === SetupStepKeys.GOOGLE_BUSINESS)?.status ===
      SetupStepStatuses.COMPLETE ||
      steps.find((step) => step.key === SetupStepKeys.PUBLISHING_EDUCATION)?.status ===
        SetupStepStatuses.COMPLETE,
  );
  const googleBusinessDataAvailable =
    steps.find((step) => step.key === SetupStepKeys.GOOGLE_BUSINESS)?.status ===
    SetupStepStatuses.COMPLETE;

  const nextStep =
    steps.find(
      (step) =>
        step.required &&
        step.status !== SetupStepStatuses.COMPLETE &&
        step.status !== SetupStepStatuses.SKIPPED,
    ) ??
    steps.find(
      (step) =>
        !step.required &&
        step.status !== SetupStepStatuses.COMPLETE &&
        step.status !== SetupStepStatuses.SKIPPED &&
        step.status !== SetupStepStatuses.TEMPORARILY_UNAVAILABLE,
    ) ??
    null;

  let overallStatus: SetupOverallStatus = SetupOverallStatuses.IN_PROGRESS;
  if (needsAttentionStepKeys.some((key) => requiredSteps.some((step) => step.key === key))) {
    overallStatus = SetupOverallStatuses.NEEDS_ATTENTION;
  } else if (requiredComplete === 0) {
    overallStatus = SetupOverallStatuses.NOT_STARTED;
  } else if (requiredComplete === requiredTotal) {
    overallStatus = SetupOverallStatuses.COMPLETE;
  } else if (headOfMarketingReady) {
    overallStatus = SetupOverallStatuses.READY_FOR_HOM;
  }

  const readinessExplanation = headOfMarketingReady
    ? "Required foundation is in place. Optional connections can wait."
    : nextStep
      ? `Next: ${nextStep.title}. ${nextStep.statusReason}`
      : "Continue setup when you have a moment.";

  return {
    businessProfileId: input.businessProfileId,
    overallStatus,
    readinessExplanation,
    requiredComplete,
    requiredTotal,
    optionalComplete,
    optionalTotal: optionalSteps.length,
    requiredPercentComplete,
    canEnterMainProduct,
    headOfMarketingReady,
    publishingReady,
    googleBusinessDataAvailable,
    nextStepKey: nextStep?.key ?? null,
    steps,
    blockedStepKeys,
    needsAttentionStepKeys,
    preferences: input.preferences,
    warnings: input.warnings ?? [],
  };
}
