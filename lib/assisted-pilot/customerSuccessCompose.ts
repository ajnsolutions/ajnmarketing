/**
 * Phase 5 — pure composition for Customer Success / Attention / Timeline / Operator checklist.
 * Uses existing assisted-pilot + tenant-health + setup snapshot facts. No new engines.
 */

import type { AssistedPilotDashboardData, PilotBusinessSummary, PilotIssue } from "@/lib/assisted-pilot/types";
import { PilotStageStatuses } from "@/lib/assisted-pilot/types";
import type { TenantHealthPage, TenantHealthSnapshot } from "@/lib/ops-dashboard/tenantHealth";
import { TenantHealthStates } from "@/lib/ops-dashboard/tenantHealthClassify";
import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import { SetupStepStatuses } from "@/lib/customer-setup/types";
import { recoveryActionsForAttention, type GuidedRecoveryAction } from "@/lib/assisted-pilot/recoveryLinks";

export type CustomerSuccessFilter =
  | "all"
  | "onboarding"
  | "attention_needed"
  | "recently_active"
  | "inactive"
  | "google_issue"
  | "publishing_issue";

export type OperatorChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  blocked: boolean;
  detail: string;
  href: string;
};

export type CustomerTimelineEvent = {
  id: string;
  at: string;
  label: string;
  detail: string | null;
};

export type AttentionItem = {
  id: string;
  kind: string;
  severity: "warning" | "critical" | "info";
  title: string;
  detail: string;
  businessName: string;
  businessProfileId: string | null;
  pilotBusinessId: string | null;
  recovery: GuidedRecoveryAction[];
};

export type CustomerSuccessCard = {
  businessProfileId: string;
  userId: string;
  businessName: string;
  onboardingCompleted: boolean;
  overallHealth: string;
  websiteConnected: boolean;
  googleConnected: boolean;
  googleDetail: string;
  aiProfileComplete: boolean;
  brandVoiceComplete: boolean;
  marketingPlanGenerated: boolean;
  firstContentGenerated: boolean;
  firstApprovalCompleted: boolean;
  firstPublishCompleted: boolean;
  latestActivityAt: string | null;
  lastSuccessfulSyncAt: string | null;
  pendingApprovals: number;
  publishFailures: number;
  pilotBusinessId: string | null;
  pilotStatus: string | null;
  completionPercentage: number | null;
  checklist: OperatorChecklistItem[];
  timeline: CustomerTimelineEvent[];
  attentionKinds: string[];
  setupPercent: number | null;
};

function dim(snapshot: TenantHealthSnapshot | null, key: string) {
  return snapshot?.dimensions.find((d) => d.key === key) ?? null;
}

function setupStepComplete(setup: CustomerSetupSnapshot | null, key: string): boolean {
  if (!setup) return false;
  const step = setup.steps.find((s) => s.key === key);
  if (!step) return false;
  return (
    step.status === SetupStepStatuses.COMPLETE ||
    step.status === SetupStepStatuses.SKIPPED ||
    step.status === SetupStepStatuses.OPTIONAL
  );
}

function buildOperatorChecklist(
  setup: CustomerSetupSnapshot | null,
  pilot: PilotBusinessSummary | null,
  tenant: TenantHealthSnapshot | null,
): OperatorChecklistItem[] {
  const gbp = dim(tenant, "google_business");
  const publishing = dim(tenant, "publishing");
  const approvals = dim(tenant, "approvals");

  const items: OperatorChecklistItem[] = [
    {
      id: "website",
      label: "Website analyzed",
      complete: setupStepComplete(setup, "website"),
      blocked: setup?.steps.find((s) => s.key === "website")?.status === SetupStepStatuses.NEEDS_ATTENTION,
      detail: setup?.steps.find((s) => s.key === "website")?.statusReason ?? "Check website analysis.",
      href: "/dashboard/website-analysis",
    },
    {
      id: "business_info",
      label: "Business profile complete",
      complete: setupStepComplete(setup, "business_info"),
      blocked: false,
      detail: setup?.steps.find((s) => s.key === "business_info")?.statusReason ?? "Confirm business basics.",
      href: "/dashboard/setup/business",
    },
    {
      id: "google",
      label: "Google Business connected",
      complete: gbp?.state === TenantHealthStates.HEALTHY || gbp?.state === TenantHealthStates.INTENTIONALLY_UNUSED,
      blocked: gbp?.state === TenantHealthStates.BLOCKED || gbp?.state === TenantHealthStates.WARNING,
      detail: gbp?.detail ?? "Google status unavailable.",
      href: "/dashboard/google-business-profile/connect",
    },
    {
      id: "plan",
      label: "Marketing Plan generated",
      complete: setupStepComplete(setup, "marketing_plan"),
      blocked: false,
      detail: setup?.steps.find((s) => s.key === "marketing_plan")?.statusReason ?? "Generate when ready.",
      href: "/dashboard/marketing-plan",
    },
    {
      id: "brand_voice",
      label: "Brand Voice confirmed",
      complete: setupStepComplete(setup, "brand_voice"),
      blocked: false,
      detail: setup?.steps.find((s) => s.key === "brand_voice")?.statusReason ?? "Confirm tone.",
      href: "/dashboard/brand-voice",
    },
    {
      id: "ai_profile",
      label: "AI Marketing Profile complete",
      complete: setupStepComplete(setup, "ai_marketing_profile"),
      blocked: false,
      detail:
        setup?.steps.find((s) => s.key === "ai_marketing_profile")?.statusReason ?? "Profile derived from setup.",
      href: "/dashboard/ai-profile",
    },
    {
      id: "first_approval",
      label: "First content approved",
      complete: Boolean(pilot?.lastApprovalAt) || (pilot?.metrics.recommendationsApproved ?? 0) > 0,
      blocked: (approvals?.state === TenantHealthStates.WARNING || approvals?.state === TenantHealthStates.BLOCKED),
      detail: approvals?.detail ?? (pilot?.lastApprovalAt ? `Last approval ${pilot.lastApprovalAt}` : "No approval yet."),
      href: "/dashboard/approvals",
    },
    {
      id: "first_publish",
      label: "First content published",
      complete: Boolean(pilot?.lastPublishAt) || (pilot?.metrics.publishSuccess ?? 0) > 0,
      blocked: publishing?.state === TenantHealthStates.WARNING || publishing?.state === TenantHealthStates.BLOCKED,
      detail: publishing?.detail ?? (pilot?.lastPublishAt ? `Last publish ${pilot.lastPublishAt}` : "No publish yet."),
      href: "/dashboard/publishing",
    },
    {
      id: "reviews",
      label: "Reviews synchronized",
      complete: Boolean(setup?.googleBusinessDataAvailable && gbp?.state === TenantHealthStates.HEALTHY),
      blocked: false,
      detail: setup?.googleBusinessDataAvailable
        ? "Google data available for reviews."
        : "Connect and sync Google to load reviews.",
      href: "/dashboard/reviews",
    },
    {
      id: "briefing",
      label: "Weekly briefing reviewed",
      complete:
        pilot?.checklist.find((c) => c.stageKey === "email_review" || c.stageKey === "approvals")?.status ===
          PilotStageStatuses.COMPLETED || Boolean(pilot?.lastApprovalPackageAt),
      blocked: false,
      detail: pilot?.lastApprovalPackageAt
        ? `Package activity ${pilot.lastApprovalPackageAt}`
        : "Review Head of Marketing / weekly package when available.",
      href: "/dashboard",
    },
  ];

  return items;
}

function buildTimeline(pilot: PilotBusinessSummary | null): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];

  if (!pilot) return events;

  for (const stage of pilot.checklist) {
    if (stage.finishedAt && stage.status === PilotStageStatuses.COMPLETED) {
      events.push({
        id: `stage-${stage.stageKey}-${stage.finishedAt}`,
        at: stage.finishedAt,
        label: stage.label,
        detail: "Checklist stage completed",
      });
    }
  }

  for (const run of pilot.recentManualRuns) {
    events.push({
      id: `run-${run.id}`,
      at: run.finishedAt ?? run.startedAt,
      label: `Operator action: ${String(run.actionKey).replace(/_/g, " ")}`,
      detail: run.result === "failure" ? run.errorMessage : `Result: ${run.result}`,
    });
  }

  const stamps: Array<{ label: string; at: string | null }> = [
    { label: "Last recommendation run", at: pilot.lastRecommendationRunAt },
    { label: "Approval package generated", at: pilot.lastApprovalPackageAt },
    { label: "Content approved", at: pilot.lastApprovalAt },
    { label: "Content published", at: pilot.lastPublishAt },
    { label: "Analytics captured", at: pilot.lastAnalyticsCaptureAt },
  ];
  for (const stamp of stamps) {
    if (!stamp.at) continue;
    events.push({
      id: `stamp-${stamp.label}-${stamp.at}`,
      at: stamp.at,
      label: stamp.label,
      detail: null,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, 20);
}

function latestActivity(pilot: PilotBusinessSummary | null, tenant: TenantHealthSnapshot | null): string | null {
  const candidates = [
    pilot?.lastPublishAt,
    pilot?.lastApprovalAt,
    pilot?.lastApprovalPackageAt,
    pilot?.lastRecommendationRunAt,
    pilot?.lastAnalyticsCaptureAt,
    pilot?.recentManualRuns[0]?.finishedAt ?? pilot?.recentManualRuns[0]?.startedAt,
    tenant?.createdAt,
  ].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

export function composeCustomerSuccessCards(input: {
  pilot: AssistedPilotDashboardData | null;
  tenants: TenantHealthPage | null;
  /** Optional map of setup snapshots keyed by businessProfileId when preloaded. */
  setupByBusinessProfileId?: Record<string, CustomerSetupSnapshot | null>;
}): CustomerSuccessCard[] {
  const pilotsByProfile = new Map(
    (input.pilot?.pilots ?? []).map((p) => [p.businessProfileId, p] as const),
  );
  const tenants = input.tenants?.tenants ?? [];

  return tenants.map((tenant) => {
    const pilot = pilotsByProfile.get(tenant.businessProfileId) ?? null;
    const setup = input.setupByBusinessProfileId?.[tenant.businessProfileId] ?? null;
    // Tenant health already embeds setup-derived dimensions; prefer those when snapshot map absent.
    const websiteDim = dim(tenant, "setup");
    const gbpDim = dim(tenant, "google_business");
    const publishingDim = dim(tenant, "publishing");
    const approvalsDim = dim(tenant, "approvals");

    const checklist = buildOperatorChecklist(setup, pilot, tenant);
    const attentionKinds: string[] = [];
    if (!tenant.onboardingCompleted || (setup && setup.requiredComplete < setup.requiredTotal)) {
      attentionKinds.push("onboarding");
    }
    if (
      gbpDim &&
      gbpDim.state !== TenantHealthStates.HEALTHY &&
      gbpDim.state !== TenantHealthStates.INTENTIONALLY_UNUSED
    ) {
      attentionKinds.push("google_business");
    }
    if (publishingDim && publishingDim.state !== TenantHealthStates.HEALTHY) {
      attentionKinds.push("publishing");
    }
    if (approvalsDim && approvalsDim.state !== TenantHealthStates.HEALTHY) {
      attentionKinds.push("approvals");
    }
    if (
      tenant.overallState === TenantHealthStates.WARNING ||
      tenant.overallState === TenantHealthStates.BLOCKED
    ) {
      attentionKinds.push("attention_needed");
    }

    const activityAt = latestActivity(pilot, tenant);
    const inactiveDays =
      activityAt != null
        ? (Date.now() - new Date(activityAt).getTime()) / (1000 * 60 * 60 * 24)
        : Number.POSITIVE_INFINITY;
    if (inactiveDays >= 7) attentionKinds.push("inactive");

    return {
      businessProfileId: tenant.businessProfileId,
      userId: tenant.userId,
      businessName: tenant.businessName || "Unnamed business",
      onboardingCompleted: tenant.onboardingCompleted,
      overallHealth: tenant.overallState,
      websiteConnected: Boolean(setup?.steps.find((s) => s.key === "website" && s.status === SetupStepStatuses.COMPLETE)) ||
        Boolean(websiteDim && websiteDim.state === TenantHealthStates.HEALTHY),
      googleConnected: gbpDim?.state === TenantHealthStates.HEALTHY,
      googleDetail: gbpDim?.detail ?? "Unknown",
      aiProfileComplete: setupStepComplete(setup, "ai_marketing_profile"),
      brandVoiceComplete: setupStepComplete(setup, "brand_voice"),
      marketingPlanGenerated: setupStepComplete(setup, "marketing_plan"),
      firstContentGenerated: (pilot?.metrics.recommendationsCreated ?? 0) > 0 || Boolean(pilot?.lastRecommendationRunAt),
      firstApprovalCompleted: Boolean(pilot?.lastApprovalAt) || (pilot?.metrics.recommendationsApproved ?? 0) > 0,
      firstPublishCompleted: Boolean(pilot?.lastPublishAt) || (pilot?.metrics.publishSuccess ?? 0) > 0,
      latestActivityAt: activityAt,
      // Prefer persisted analytics-capture timestamp — the closest existing "successful sync" signal.
      lastSuccessfulSyncAt: pilot?.lastAnalyticsCaptureAt ?? null,
      pendingApprovals: 0,
      publishFailures: 0,
      pilotBusinessId: pilot?.id ?? null,
      pilotStatus: pilot?.status ?? null,
      completionPercentage: pilot?.completionPercentage ?? null,
      checklist,
      timeline: buildTimeline(pilot),
      attentionKinds: [...new Set(attentionKinds)],
      setupPercent: setup?.requiredPercentComplete ?? null,
    };
  });
}

/** Enrich cards with setup snapshots while preserving pilot-derived flags/timeline. */
export function enrichCustomerSuccessCards(
  cards: CustomerSuccessCard[],
  setupByBusinessProfileId: Record<string, CustomerSetupSnapshot | null>,
  tenants: TenantHealthSnapshot[],
  pilotsByProfileId: Map<string, PilotBusinessSummary>,
): CustomerSuccessCard[] {
  const tenantById = new Map(tenants.map((t) => [t.businessProfileId, t]));
  return cards.map((card) => {
    const setup = setupByBusinessProfileId[card.businessProfileId] ?? null;
    const tenant = tenantById.get(card.businessProfileId) ?? null;
    const pilot = pilotsByProfileId.get(card.businessProfileId) ?? null;
    const checklist = buildOperatorChecklist(setup, pilot, tenant);

    const approvalsDim = dim(tenant, "approvals");
    const publishingDim = dim(tenant, "publishing");
    const pendingMatch = approvalsDim?.detail.match(/(\d+)\s+pending/i);
    const failMatch = publishingDim?.detail.match(/(\d+)\s+failed/i);
    const gbpFreshness = setup?.steps.find((s) => s.key === "google_business")?.freshnessLabel ?? null;

    return {
      ...card,
      websiteConnected: setupStepComplete(setup, "website") || card.websiteConnected,
      aiProfileComplete: setupStepComplete(setup, "ai_marketing_profile") || card.aiProfileComplete,
      brandVoiceComplete: setupStepComplete(setup, "brand_voice") || card.brandVoiceComplete,
      marketingPlanGenerated: setupStepComplete(setup, "marketing_plan") || card.marketingPlanGenerated,
      checklist,
      timeline: buildTimeline(pilot),
      setupPercent: setup?.requiredPercentComplete ?? card.setupPercent,
      pendingApprovals: pendingMatch ? Number(pendingMatch[1]) : card.pendingApprovals,
      publishFailures: failMatch ? Number(failMatch[1]) : card.publishFailures,
      googleDetail: gbpFreshness ? `${card.googleDetail} · ${gbpFreshness}` : card.googleDetail,
      completionPercentage: pilot?.completionPercentage ?? card.completionPercentage,
      pilotBusinessId: pilot?.id ?? card.pilotBusinessId,
      pilotStatus: pilot?.status ?? card.pilotStatus,
      firstContentGenerated:
        card.firstContentGenerated || (pilot?.metrics.recommendationsCreated ?? 0) > 0,
      firstApprovalCompleted: card.firstApprovalCompleted || Boolean(pilot?.lastApprovalAt),
      firstPublishCompleted: card.firstPublishCompleted || Boolean(pilot?.lastPublishAt),
      latestActivityAt: latestActivity(pilot, tenant) ?? card.latestActivityAt,
      lastSuccessfulSyncAt: pilot?.lastAnalyticsCaptureAt ?? card.lastSuccessfulSyncAt,
    };
  });
}

export function filterCustomerSuccessCards(
  cards: CustomerSuccessCard[],
  filter: CustomerSuccessFilter,
): CustomerSuccessCard[] {
  switch (filter) {
    case "onboarding":
      return cards.filter((c) => !c.onboardingCompleted || c.attentionKinds.includes("onboarding"));
    case "attention_needed":
      return cards.filter(
        (c) =>
          c.attentionKinds.includes("attention_needed") ||
          c.overallHealth === TenantHealthStates.WARNING ||
          c.overallHealth === TenantHealthStates.BLOCKED,
      );
    case "recently_active":
      return cards.filter((c) => {
        if (!c.latestActivityAt) return false;
        const days = (Date.now() - new Date(c.latestActivityAt).getTime()) / (1000 * 60 * 60 * 24);
        return days <= 3;
      });
    case "inactive":
      return cards.filter((c) => c.attentionKinds.includes("inactive"));
    case "google_issue":
      return cards.filter((c) => c.attentionKinds.includes("google_business") || !c.googleConnected);
    case "publishing_issue":
      return cards.filter((c) => c.attentionKinds.includes("publishing") || c.publishFailures > 0);
    default:
      return cards;
  }
}

export function composeAttentionCenter(input: {
  cards: CustomerSuccessCard[];
  openIssues: PilotIssue[];
  stuckJobCount: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const card of input.cards) {
    if (card.attentionKinds.includes("onboarding")) {
      items.push({
        id: `onboarding-${card.businessProfileId}`,
        kind: "onboarding",
        severity: "warning",
        title: `${card.businessName} needs onboarding help`,
        detail: "Required setup steps are incomplete or need attention.",
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("onboarding"),
      });
    }
    if (card.attentionKinds.includes("inactive")) {
      items.push({
        id: `inactive-${card.businessProfileId}`,
        kind: "inactive",
        severity: "info",
        title: `${card.businessName} looks inactive`,
        detail: "No recent publish/approval/package activity in about a week.",
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("inactive"),
      });
    }
    if (card.attentionKinds.includes("google_business")) {
      items.push({
        id: `gbp-${card.businessProfileId}`,
        kind: "google_business",
        severity: "warning",
        title: `${card.businessName}: Google Business needs attention`,
        detail: card.googleDetail,
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("google_business"),
      });
    }
    if (card.attentionKinds.includes("publishing") || card.publishFailures > 0) {
      items.push({
        id: `pub-${card.businessProfileId}`,
        kind: "publishing",
        severity: card.publishFailures > 0 ? "critical" : "warning",
        title: `${card.businessName}: publishing needs recovery`,
        detail: card.publishFailures > 0 ? `${card.publishFailures} failed publish signal(s).` : "Publishing health warning.",
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("publishing"),
      });
    }
    if (card.attentionKinds.includes("approvals") || card.pendingApprovals > 0) {
      items.push({
        id: `appr-${card.businessProfileId}`,
        kind: "approvals",
        severity: "warning",
        title: `${card.businessName}: approvals waiting`,
        detail: card.pendingApprovals > 0 ? `${card.pendingApprovals} pending.` : "Approval queue needs a look.",
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("approvals"),
      });
    }
    const websiteBlocked = card.checklist.find((c) => c.id === "website" && c.blocked);
    if (websiteBlocked) {
      items.push({
        id: `web-${card.businessProfileId}`,
        kind: "website_analysis",
        severity: "warning",
        title: `${card.businessName}: website analysis issue`,
        detail: websiteBlocked.detail,
        businessName: card.businessName,
        businessProfileId: card.businessProfileId,
        pilotBusinessId: card.pilotBusinessId,
        recovery: recoveryActionsForAttention("website_analysis"),
      });
    }
  }

  for (const issue of input.openIssues) {
    items.push({
      id: `issue-${issue.id}`,
      kind: issue.category,
      severity: issue.severity === "critical" || issue.severity === "high" ? "critical" : "warning",
      title: `Pilot issue: ${issue.category.replace(/_/g, " ")}`,
      detail: issue.description,
      businessName: "Pilot feedback",
      businessProfileId: null,
      pilotBusinessId: issue.pilotBusinessId,
      recovery: recoveryActionsForAttention(issue.category === "oauth" ? "oauth" : issue.category),
    });
  }

  if (input.stuckJobCount > 0) {
    items.push({
      id: "stuck-jobs",
      kind: "retry_available",
      severity: "critical",
      title: `${input.stuckJobCount} stuck background job(s)`,
      detail: "Review stuck jobs on Ops and retry only when classified safe.",
      businessName: "System",
      businessProfileId: null,
      pilotBusinessId: null,
      recovery: [
        {
          id: "ops_jobs",
          label: "Open Ops stuck jobs",
          description: "Use the existing stuck-jobs retry controls.",
          href: "/dashboard/admin/ops",
        },
      ],
    });
  }

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return items;
}

export const PILOT_FEEDBACK_TYPES = [
  { id: "question", label: "Question", category: "operational" },
  { id: "suggestion", label: "Suggestion", category: "ux" },
  { id: "bug", label: "Bug", category: "operational" },
  { id: "confusing_workflow", label: "Confusing workflow", category: "ux" },
  { id: "feature_request", label: "Feature request", category: "documentation" },
  { id: "general_note", label: "General note", category: "operational" },
] as const;

export type PilotFeedbackTypeId = (typeof PILOT_FEEDBACK_TYPES)[number]["id"];
