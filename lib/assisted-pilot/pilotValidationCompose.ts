/**
 * Phase 6 — pure composition for Pilot Validation & Production Go-Live Readiness.
 * Aggregates existing CS / ops / readiness facts. No new engines or health inventions.
 */

import type {
  AttentionItem,
  CustomerSuccessCard,
} from "@/lib/assisted-pilot/customerSuccessCompose";
import { GUIDED_RECOVERY_ACTIONS } from "@/lib/assisted-pilot/recoveryLinks";
import type { AssistedPilotDashboardData, PilotIssue } from "@/lib/assisted-pilot/types";
import type { OpsDashboardSummary } from "@/lib/ops-dashboard/types";
import { TenantHealthStates } from "@/lib/ops-dashboard/tenantHealthClassify";
import type { ProductionReadinessSummary } from "@/lib/production-readiness/types";
import { ReadinessStatuses } from "@/lib/production-readiness/types";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

export type ValidationTone = "ready" | "warning" | "blocked" | "info" | "unknown";

export type PilotReadinessAuditItem = {
  id: string;
  label: string;
  tone: ValidationTone;
  detail: string;
  href: string | null;
};

export type OperationalValidationItem = {
  id: string;
  label: string;
  path: string;
  tone: ValidationTone;
  detail: string;
  inconsistent: boolean;
};

export type JourneyValidationItem = {
  id: string;
  label: string;
  description: string;
  tone: ValidationTone;
  detail: string;
  href: string;
};

export type ProductionReadinessReport = {
  generatedAt: string;
  scheduleGateOpen: boolean;
  overallStatus: string;
  outstandingBlockers: Array<{ label: string; detail: string }>;
  warnings: Array<{ label: string; detail: string }>;
  recoveredIssues: Array<{ label: string; detail: string }>;
  healthySystems: Array<{ label: string; detail: string }>;
  requiredManualActions: Array<{ label: string; detail: string; href: string }>;
};

export type AdminObservabilitySnapshot = {
  customersRequiringAttention: number;
  customersInactive: number;
  customersFullyOnboarded: number;
  customersBlocked: number;
  recentRecoveries: number;
  recentPublishes: number;
  recentApprovals: number;
  stuckJobs: number;
  openPilotIssues: number;
};

function section(ops: OpsDashboardSummary | null, id: string) {
  return ops?.sections.find((s) => s.id === id) ?? null;
}

function readinessItem(readiness: ProductionReadinessSummary | null, key: string) {
  return readiness?.items.find((i) => i.key === key) ?? null;
}

function toneFromReadinessStatus(status: string | undefined): ValidationTone {
  if (!status) return "unknown";
  if (status === ReadinessStatuses.READY || status === ReadinessStatuses.INTENTIONALLY_DISABLED) {
    return "ready";
  }
  if (
    status === ReadinessStatuses.READY_WITH_WARNINGS ||
    status === ReadinessStatuses.NEEDS_ATTENTION ||
    status === ReadinessStatuses.DEGRADED ||
    status === ReadinessStatuses.NOT_CONFIGURED
  ) {
    return "warning";
  }
  if (status === ReadinessStatuses.BLOCKED) return "blocked";
  return "unknown";
}

function aggregateCardFlag(
  cards: CustomerSuccessCard[],
  predicate: (card: CustomerSuccessCard) => boolean,
): { ready: number; total: number } {
  const total = cards.length;
  const ready = cards.filter(predicate).length;
  return { ready, total };
}

function cardTone(ready: number, total: number, anyBlocked = false): ValidationTone {
  if (total === 0) return "unknown";
  if (anyBlocked) return "blocked";
  if (ready === total) return "ready";
  if (ready === 0) return "warning";
  return "warning";
}

/** Part 1 — Pilot Readiness Audit from existing platform state. */
export function composePilotReadinessAudit(input: {
  cards: CustomerSuccessCard[];
  readiness: ProductionReadinessSummary | null;
  opsSummary: OpsDashboardSummary | null;
  scheduleGateOpen: boolean;
}): PilotReadinessAuditItem[] {
  const { cards, readiness, opsSummary, scheduleGateOpen } = input;
  const setup = aggregateCardFlag(cards, (c) => c.onboardingCompleted || (c.setupPercent ?? 0) >= 100);
  const google = aggregateCardFlag(cards, (c) => c.googleConnected);
  const website = aggregateCardFlag(cards, (c) => c.websiteConnected);
  const ai = aggregateCardFlag(cards, (c) => c.aiProfileComplete);
  const plan = aggregateCardFlag(cards, (c) => c.marketingPlanGenerated);
  const brand = aggregateCardFlag(cards, (c) => c.brandVoiceComplete);
  const publishingReady = aggregateCardFlag(
    cards,
    (c) => c.publishFailures === 0 && !c.attentionKinds.includes("publishing"),
  );
  const approvalReady = aggregateCardFlag(
    cards,
    (c) => c.pendingApprovals === 0 && !c.attentionKinds.includes("approvals"),
  );

  const trigger = readinessItem(readiness, "trigger_dev") ?? readinessItem(readiness, "trigger");
  const publishingSection = section(opsSummary, "publishing_failures");
  const oauthSection = section(opsSummary, "oauth_health");

  return [
    {
      id: "setup",
      label: "Setup completion",
      tone: cardTone(setup.ready, setup.total),
      detail:
        setup.total === 0
          ? "No tenant health rows loaded."
          : `${setup.ready}/${setup.total} customers with completed onboarding or 100% required setup.`,
      href: "/dashboard/setup",
    },
    {
      id: "google",
      label: "Google Business status",
      tone: cardTone(google.ready, google.total, (oauthSection?.counts.failed ?? 0) > 0),
      detail:
        google.total === 0
          ? "No customers loaded."
          : `${google.ready}/${google.total} connected · OAuth non-connected: ${oauthSection?.counts.failed ?? 0}`,
      href: "/dashboard/google-business-profile/connect",
    },
    {
      id: "website",
      label: "Website analysis status",
      tone: cardTone(website.ready, website.total),
      detail:
        website.total === 0
          ? "No customers loaded."
          : `${website.ready}/${website.total} with website analyzed/connected signals.`,
      href: "/dashboard/website-analysis",
    },
    {
      id: "ai_profile",
      label: "AI Marketing Profile status",
      tone: cardTone(ai.ready, ai.total),
      detail: ai.total === 0 ? "No customers loaded." : `${ai.ready}/${ai.total} complete.`,
      href: "/dashboard/ai-profile",
    },
    {
      id: "marketing_plan",
      label: "Marketing Plan status",
      tone: cardTone(plan.ready, plan.total),
      detail: plan.total === 0 ? "No customers loaded." : `${plan.ready}/${plan.total} generated.`,
      href: "/dashboard/marketing-plan",
    },
    {
      id: "brand_voice",
      label: "Brand Voice status",
      tone: cardTone(brand.ready, brand.total),
      detail: brand.total === 0 ? "No customers loaded." : `${brand.ready}/${brand.total} complete.`,
      href: "/dashboard/brand-voice",
    },
    {
      id: "publishing",
      label: "Publishing readiness",
      tone:
        (publishingSection?.counts.failed ?? 0) > 0
          ? "blocked"
          : cardTone(publishingReady.ready, publishingReady.total),
      detail: `Customers without publish attention: ${publishingReady.ready}/${publishingReady.total || 0} · failed jobs: ${publishingSection?.counts.failed ?? 0}`,
      href: "/dashboard/publishing",
    },
    {
      id: "approvals",
      label: "Approval readiness",
      tone: cardTone(approvalReady.ready, approvalReady.total),
      detail: `Customers without approval attention: ${approvalReady.ready}/${approvalReady.total || 0}`,
      href: "/dashboard/approvals",
    },
    {
      id: "cron_gate",
      label: "Cron gate status",
      tone: scheduleGateOpen || ATTACH_DECLARATIVE_PRODUCTION_CRONS ? "blocked" : "ready",
      detail: scheduleGateOpen
        ? "OPEN — production schedules must not be treated as pilot-safe."
        : "CLOSED (ATTACH_DECLARATIVE_PRODUCTION_CRONS=false).",
      href: "/dashboard/admin/ops",
    },
    {
      id: "trigger",
      label: "Trigger.dev status",
      tone: toneFromReadinessStatus(trigger?.status),
      detail: trigger?.reason ?? "Trigger readiness item not present in current summary.",
      href: "/dashboard/admin/ops",
    },
    {
      id: "overall",
      label: "Overall readiness checklist",
      tone: toneFromReadinessStatus(readiness?.overallStatus),
      detail: readiness
        ? `Overall ${readiness.overallStatus.replace(/_/g, " ")} · ${readiness.blockers.length} blocker(s) · pilot score ${readiness.pilotReadiness.score ?? "—"}`
        : "Production readiness summary unavailable.",
      href: "/dashboard/admin/ops",
    },
  ];
}

/** Part 2 — Operational path validation + inconsistent-state highlights. */
export function composeOperationalValidation(input: {
  cards: CustomerSuccessCard[];
  readiness: ProductionReadinessSummary | null;
  opsSummary: OpsDashboardSummary | null;
  stuckJobCount: number;
  scheduleGateOpen: boolean;
}): OperationalValidationItem[] {
  const { cards, readiness, opsSummary, stuckJobCount, scheduleGateOpen } = input;
  const publishingFailed = section(opsSummary, "publishing_failures")?.counts.failed ?? 0;
  const oauthFailed = section(opsSummary, "oauth_health")?.counts.failed ?? 0;
  const retrying = section(opsSummary, "publishing_queue")?.counts.retrying ?? 0;

  const inconsistentOnboarding = cards.filter(
    (c) => c.onboardingCompleted && (c.setupPercent != null && c.setupPercent < 100),
  );
  const inconsistentGoogle = cards.filter(
    (c) => c.googleConnected && c.attentionKinds.includes("google_business"),
  );
  const inconsistentPublish = cards.filter(
    (c) => c.firstPublishCompleted && c.publishFailures > 0,
  );

  return [
    {
      id: "retry_actions",
      label: "Retry actions",
      path: "/dashboard/admin/ops",
      tone: stuckJobCount > 0 ? "warning" : "ready",
      detail:
        stuckJobCount > 0
          ? `${stuckJobCount} stuck job(s) — retry only when classified safe on Ops.`
          : "No stuck jobs detected for operator retry.",
      inconsistent: false,
    },
    {
      id: "manual_recovery",
      label: "Manual recovery",
      path: "/dashboard/admin/customer-success",
      tone: GUIDED_RECOVERY_ACTIONS.length > 0 ? "ready" : "unknown",
      detail: `${GUIDED_RECOVERY_ACTIONS.length} guided recovery routes available (existing product actions only).`,
      inconsistent: false,
    },
    {
      id: "approval_workflows",
      label: "Approval workflows",
      path: "/dashboard/approvals",
      tone: cards.some((c) => c.attentionKinds.includes("approvals")) ? "warning" : "ready",
      detail: `${cards.filter((c) => c.attentionKinds.includes("approvals")).length} customer(s) with approval attention.`,
      inconsistent: false,
    },
    {
      id: "publishing_lifecycle",
      label: "Publishing lifecycle",
      path: "/dashboard/publishing",
      tone: publishingFailed > 0 ? "blocked" : retrying > 0 ? "warning" : "ready",
      detail: `Failed ${publishingFailed} · retrying ${retrying}.`,
      inconsistent: inconsistentPublish.length > 0,
    },
    {
      id: "google_reconnect",
      label: "Google reconnect",
      path: "/dashboard/google-business-profile/connect",
      tone: oauthFailed > 0 || cards.some((c) => c.attentionKinds.includes("google_business"))
        ? "warning"
        : "ready",
      detail: `OAuth non-connected ${oauthFailed} · customers needing Google attention ${cards.filter((c) => c.attentionKinds.includes("google_business")).length}.`,
      inconsistent: inconsistentGoogle.length > 0,
    },
    {
      id: "website_reanalysis",
      label: "Website re-analysis",
      path: "/dashboard/website-analysis",
      tone: cards.some((c) => c.checklist.some((item) => item.id === "website" && item.blocked))
        ? "warning"
        : "ready",
      detail: `${cards.filter((c) => c.checklist.some((item) => item.id === "website" && item.blocked)).length} website blocker(s) on operator checklists.`,
      inconsistent: false,
    },
    {
      id: "recommendation_regeneration",
      label: "Recommendation regeneration",
      path: "/dashboard/marketing-recommendations",
      tone: "info",
      detail:
        "Use existing customer recommendations / assisted-pilot manual actions — Phase 6 does not change ranking or scoring.",
      inconsistent: false,
    },
    {
      id: "onboarding_consistency",
      label: "Onboarding consistency",
      path: "/dashboard/setup",
      tone: inconsistentOnboarding.length > 0 ? "warning" : "ready",
      detail:
        inconsistentOnboarding.length > 0
          ? `${inconsistentOnboarding.length} customer(s) marked onboarding complete with required setup < 100%.`
          : "No onboarding/setup percentage contradictions detected.",
      inconsistent: inconsistentOnboarding.length > 0,
    },
    {
      id: "schedule_gate",
      label: "Schedule gate safety",
      path: "/dashboard/admin/ops",
      tone: scheduleGateOpen ? "blocked" : "ready",
      detail: scheduleGateOpen
        ? "Cron gate OPEN — do not treat automation as enabled for pilot."
        : "Cron gate CLOSED — assisted pilot remains manual/gated.",
      inconsistent: Boolean(scheduleGateOpen && readiness?.scheduleGateOpen === false),
    },
  ];
}

/** Part 3 — Operator-only guided customer journey validation checklist. */
export function composeJourneyValidationChecklist(input: {
  cards: CustomerSuccessCard[];
}): JourneyValidationItem[] {
  const cards = input.cards;
  const hasNewish = cards.some((c) => !c.onboardingCompleted);
  const hasReturning = cards.some((c) => c.onboardingCompleted);
  const hasGbpConnected = cards.some((c) => c.googleConnected);
  const hasGbpDisconnected = cards.some((c) => !c.googleConnected || c.attentionKinds.includes("google_business"));
  const websiteIssues = cards.some((c) => c.checklist.some((i) => i.id === "website" && (i.blocked || !i.complete)));
  const hasApprovals = cards.some((c) => c.firstApprovalCompleted || c.pendingApprovals > 0);
  const hasPublishes = cards.some((c) => c.firstPublishCompleted);
  const hasRecovery = cards.some(
    (c) =>
      c.publishFailures > 0 ||
      c.attentionKinds.includes("publishing") ||
      c.attentionKinds.includes("google_business"),
  );
  const fullyComplete = cards.filter(
    (c) =>
      c.onboardingCompleted &&
      c.googleConnected &&
      c.firstApprovalCompleted &&
      c.firstPublishCompleted,
  );

  return [
    {
      id: "new_customer",
      label: "New customer",
      description: "Walk setup → profile → first recommendation without schedule reliance.",
      tone: hasNewish ? "warning" : cards.length === 0 ? "unknown" : "ready",
      detail: hasNewish
        ? `${cards.filter((c) => !c.onboardingCompleted).length} customer(s) still onboarding.`
        : "No incomplete onboarding customers in current page.",
      href: "/dashboard/setup",
    },
    {
      id: "returning_customer",
      label: "Returning customer",
      description: "Confirm Head of Marketing, This Week, and continuity after login.",
      tone: hasReturning ? "ready" : "info",
      detail: hasReturning
        ? `${cards.filter((c) => c.onboardingCompleted).length} onboarded customer(s) to spot-check.`
        : "No fully onboarded customers loaded yet.",
      href: "/dashboard",
    },
    {
      id: "gbp_connected",
      label: "Google Business connected",
      description: "Verify connected state, sync detail, and publishing eligibility.",
      tone: hasGbpConnected ? "ready" : "warning",
      detail: `${cards.filter((c) => c.googleConnected).length} connected.`,
      href: "/dashboard/google-business-profile",
    },
    {
      id: "gbp_disconnected",
      label: "Google Business disconnected",
      description: "Exercise reconnect path and customer-safe messaging.",
      tone: hasGbpDisconnected ? "warning" : "ready",
      detail: hasGbpDisconnected
        ? "At least one customer needs Google reconnect or attention."
        : "No disconnected Google signals in current set.",
      href: "/dashboard/google-business-profile/connect",
    },
    {
      id: "website_unavailable",
      label: "Website unavailable",
      description: "Confirm analysis failure/empty states and retry path.",
      tone: websiteIssues ? "warning" : "ready",
      detail: websiteIssues
        ? "Website checklist incomplete or blocked for one or more customers."
        : "No website blockers on current operator checklists.",
      href: "/dashboard/website-analysis",
    },
    {
      id: "content_approval",
      label: "Content approval",
      description: "Approve or leave pending — never auto-approve.",
      tone: hasApprovals ? "ready" : "info",
      detail: hasApprovals
        ? "Approval activity or pending items present for validation."
        : "No approval activity recorded yet — validate with a draft when available.",
      href: "/dashboard/approvals",
    },
    {
      id: "publishing",
      label: "Publishing",
      description: "Publish or retry using existing controls only.",
      tone: hasPublishes ? "ready" : "info",
      detail: hasPublishes
        ? `${cards.filter((c) => c.firstPublishCompleted).length} customer(s) with first publish recorded.`
        : "No first-publish milestones yet.",
      href: "/dashboard/publishing",
    },
    {
      id: "recovery",
      label: "Recovery",
      description: "Walk guided recovery for publish/Google/website failures.",
      tone: hasRecovery ? "warning" : "ready",
      detail: hasRecovery
        ? "Recovery scenarios present — validate Attention Center actions."
        : "No active recovery signals; still walk links once before go-live.",
      href: "/dashboard/admin/customer-success",
    },
    {
      id: "completion",
      label: "Completion",
      description: "Customer reached onboarded + Google + first approval + first publish.",
      tone: fullyComplete.length > 0 ? "ready" : "info",
      detail: `${fullyComplete.length} customer(s) meet the completion signal set.`,
      href: "/dashboard/admin/customer-success",
    },
  ];
}

/** Part 4 — Production readiness report from existing readiness + ops + CS. */
export function composeProductionReadinessReport(input: {
  readiness: ProductionReadinessSummary | null;
  opsSummary: OpsDashboardSummary | null;
  attention: AttentionItem[];
  cards: CustomerSuccessCard[];
  openIssues: PilotIssue[];
  stuckJobCount: number;
  scheduleGateOpen: boolean;
  generatedAt: string;
}): ProductionReadinessReport {
  const { readiness, opsSummary, attention, cards, openIssues, stuckJobCount, scheduleGateOpen, generatedAt } =
    input;

  const outstandingBlockers = [
    ...(readiness?.blockers ?? []).map((b) => ({
      label: b.label,
      detail: b.reason,
    })),
    ...attention
      .filter((a) => a.severity === "critical")
      .map((a) => ({ label: a.title, detail: a.detail })),
  ];

  if (scheduleGateOpen) {
    outstandingBlockers.unshift({
      label: "Cron gate is OPEN",
      detail: "Close or explicitly approve schedule activation before treating automation as intentional.",
    });
  }

  const warnings = [
    ...(readiness?.items ?? [])
      .filter(
        (i) =>
          i.status === ReadinessStatuses.NEEDS_ATTENTION ||
          i.status === ReadinessStatuses.READY_WITH_WARNINGS ||
          i.status === ReadinessStatuses.DEGRADED ||
          i.status === ReadinessStatuses.NOT_CONFIGURED,
      )
      .map((i) => ({ label: i.label, detail: i.reason })),
    ...attention
      .filter((a) => a.severity === "warning")
      .slice(0, 12)
      .map((a) => ({ label: a.title, detail: a.detail })),
    ...openIssues
      .filter((i) => i.status === "open" || i.status === "in_progress")
      .map((i) => ({
        label: `Pilot issue (${i.category})`,
        detail: i.description,
      })),
  ];

  const publishingCompleted = section(opsSummary, "publishing_queue")?.counts.completed ?? 0;
  const recoveredIssues = [
    ...openIssues
      .filter((i) => i.status === "resolved")
      .map((i) => ({
        label: `Resolved pilot issue (${i.category})`,
        detail: i.resolution ?? i.description,
      })),
  ];
  if (publishingCompleted > 0) {
    recoveredIssues.push({
      label: "Publishing completions",
      detail: `${publishingCompleted} completed publishing job signal(s) in ops aggregation.`,
    });
  }

  const healthySystems = (readiness?.items ?? [])
    .filter(
      (i) =>
        i.status === ReadinessStatuses.READY || i.status === ReadinessStatuses.INTENTIONALLY_DISABLED,
    )
    .map((i) => ({ label: i.label, detail: i.reason }));

  if (!scheduleGateOpen) {
    healthySystems.unshift({
      label: "Declarative production cron gate",
      detail: "CLOSED — schedules not attached.",
    });
  }

  const requiredManualActions: ProductionReadinessReport["requiredManualActions"] = [];
  if (stuckJobCount > 0) {
    requiredManualActions.push({
      label: "Triage stuck jobs",
      detail: `${stuckJobCount} stuck background job(s) need safe retry or acceptance.`,
      href: "/dashboard/admin/ops",
    });
  }
  if (cards.some((c) => c.attentionKinds.includes("google_business"))) {
    requiredManualActions.push({
      label: "Reconnect Google Business for affected customers",
      detail: "Use customer reconnect flow — do not invent admin OAuth bypass.",
      href: "/dashboard/google-business-profile/connect",
    });
  }
  if ((section(opsSummary, "publishing_failures")?.counts.failed ?? 0) > 0) {
    requiredManualActions.push({
      label: "Clear publishing failures",
      detail: "Retry or discard failed publishes via existing Publishing controls.",
      href: "/dashboard/publishing",
    });
  }
  if ((readiness?.scheduleActivationBlockers.length ?? 0) > 0) {
    requiredManualActions.push({
      label: "Resolve schedule-activation blockers before enabling automation",
      detail: `${readiness!.scheduleActivationBlockers.length} readiness item(s) still block schedule activation.`,
      href: "/dashboard/admin/ops",
    });
  }
  requiredManualActions.push({
    label: "Keep ATTACH_DECLARATIVE_PRODUCTION_CRONS=false until go-live criteria met",
    detail: "Schedule activation is a separate approved change — not part of Phase 6.",
    href: "/dashboard/admin/ops",
  });

  return {
    generatedAt,
    scheduleGateOpen,
    overallStatus: readiness?.overallStatus ?? "unknown",
    outstandingBlockers,
    warnings,
    recoveredIssues,
    healthySystems,
    requiredManualActions,
  };
}

/** Part 5 — Admin observability aggregates (no new APIs). */
export function composeAdminObservability(input: {
  cards: CustomerSuccessCard[];
  opsSummary: OpsDashboardSummary | null;
  stuckJobCount: number;
  openIssues: PilotIssue[];
}): AdminObservabilitySnapshot {
  const { cards, opsSummary, stuckJobCount, openIssues } = input;
  const recentPublishes =
    (section(opsSummary, "publishing_queue")?.counts.completed ?? 0) +
    cards.filter((c) => Boolean(c.firstPublishCompleted)).length;
  const recentApprovals =
    (section(opsSummary, "approval_activity")?.counts.completed ?? 0) +
    cards.filter((c) => Boolean(c.firstApprovalCompleted)).length;
  const recentRecoveries =
    (section(opsSummary, "publishing_queue")?.counts.completed ?? 0) +
    openIssues.filter((i) => i.status === "resolved").length;

  return {
    customersRequiringAttention: cards.filter(
      (c) =>
        c.attentionKinds.includes("attention_needed") ||
        c.overallHealth === TenantHealthStates.WARNING ||
        c.overallHealth === TenantHealthStates.BLOCKED,
    ).length,
    customersInactive: cards.filter((c) => c.attentionKinds.includes("inactive")).length,
    customersFullyOnboarded: cards.filter((c) => c.onboardingCompleted).length,
    customersBlocked: cards.filter((c) => c.overallHealth === TenantHealthStates.BLOCKED).length,
    recentRecoveries,
    recentPublishes,
    recentApprovals,
    stuckJobs: stuckJobCount,
    openPilotIssues: openIssues.filter((i) => i.status === "open" || i.status === "in_progress")
      .length,
  };
}

export type PilotValidationDashboardView = {
  audit: PilotReadinessAuditItem[];
  operational: OperationalValidationItem[];
  journey: JourneyValidationItem[];
  report: ProductionReadinessReport;
  observability: AdminObservabilitySnapshot;
};

export function composePilotValidationView(input: {
  cards: CustomerSuccessCard[];
  attention: AttentionItem[];
  readiness: ProductionReadinessSummary | null;
  opsSummary: OpsDashboardSummary | null;
  pilot: AssistedPilotDashboardData | null;
  stuckJobCount: number;
  scheduleGateOpen: boolean;
  generatedAt: string;
}): PilotValidationDashboardView {
  const openIssues = input.pilot?.openIssues ?? [];
  return {
    audit: composePilotReadinessAudit({
      cards: input.cards,
      readiness: input.readiness,
      opsSummary: input.opsSummary,
      scheduleGateOpen: input.scheduleGateOpen,
    }),
    operational: composeOperationalValidation({
      cards: input.cards,
      readiness: input.readiness,
      opsSummary: input.opsSummary,
      stuckJobCount: input.stuckJobCount,
      scheduleGateOpen: input.scheduleGateOpen,
    }),
    journey: composeJourneyValidationChecklist({ cards: input.cards }),
    report: composeProductionReadinessReport({
      readiness: input.readiness,
      opsSummary: input.opsSummary,
      attention: input.attention,
      cards: input.cards,
      openIssues,
      stuckJobCount: input.stuckJobCount,
      scheduleGateOpen: input.scheduleGateOpen,
      generatedAt: input.generatedAt,
    }),
    observability: composeAdminObservability({
      cards: input.cards,
      opsSummary: input.opsSummary,
      stuckJobCount: input.stuckJobCount,
      openIssues,
    }),
  };
}
