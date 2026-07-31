/**
 * Admin Executive Overview (Part 8) — reuses the exact same orchestrator
 * building blocks and already-persisted data every other admin dashboard in
 * this repo reuses (see lib/ops-dashboard/tenantHealth.ts,
 * lib/assisted-pilot/customerSuccessService.ts): the already-computed
 * per-tenant operational health page, and each business's already-persisted
 * active opportunities. No provider is rerun per tenant, and no business's
 * Business Discovery / Customer Voice / External Intelligence is
 * recomputed — that would violate Part 10's "avoid duplicate computation"
 * at exactly the scale (every business, every admin page load) where it
 * would matter most.
 */

import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { TenantHealthStates, type TenantHealthSnapshot } from "@/lib/ops-dashboard/tenantHealth";

/** An active opportunity sitting this long without being acted on is
 * treated as stalled — a plain, non-fabricated signal read directly off
 * persisted timestamps. */
const STALLED_OPPORTUNITY_DAYS = 14;
const MAX_STALLED_OPPORTUNITIES = 10;
const MAX_BUSINESSES_PER_BUCKET = 20;

export type AdminBusinessSignal = {
  businessProfileId: string;
  businessName: string;
  reason: string;
};

export type StalledOpportunitySignal = {
  businessProfileId: string;
  businessName: string;
  opportunityId: string;
  statement: string;
  daysActive: number;
};

export type AdminExecutiveOverview = {
  generatedAt: string;
  businessesNeedingAttention: AdminBusinessSignal[];
  businessesDoingWell: AdminBusinessSignal[];
  confidenceGaps: AdminBusinessSignal[];
  stalledOpportunities: StalledOpportunitySignal[];
};

function worstDimensionDetail(tenant: TenantHealthSnapshot): string {
  const worst = tenant.dimensions.find(
    (d) => d.state === TenantHealthStates.BLOCKED || d.state === TenantHealthStates.WARNING,
  );
  return worst ? `${worst.label}: ${worst.detail}` : "Needs a closer look.";
}

function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildAdminExecutiveOverview(input: {
  tenants: TenantHealthSnapshot[];
  opportunitiesByBusinessProfileId: Map<string, DetectedOpportunity[]>;
  now?: Date;
}): AdminExecutiveOverview {
  const now = input.now ?? new Date();

  const businessesNeedingAttention: AdminBusinessSignal[] = [];
  const businessesDoingWell: AdminBusinessSignal[] = [];
  const confidenceGaps: AdminBusinessSignal[] = [];
  const stalledOpportunities: StalledOpportunitySignal[] = [];

  for (const tenant of input.tenants) {
    if (tenant.overallState === TenantHealthStates.BLOCKED || tenant.overallState === TenantHealthStates.WARNING) {
      businessesNeedingAttention.push({
        businessProfileId: tenant.businessProfileId,
        businessName: tenant.businessName,
        reason: worstDimensionDetail(tenant),
      });
    } else if (tenant.overallState === TenantHealthStates.HEALTHY) {
      businessesDoingWell.push({
        businessProfileId: tenant.businessProfileId,
        businessName: tenant.businessName,
        reason: "Every tracked operational dimension is healthy.",
      });
    }

    const opportunities = input.opportunitiesByBusinessProfileId.get(tenant.businessProfileId) ?? [];
    if (opportunities.length === 0) {
      confidenceGaps.push({
        businessProfileId: tenant.businessProfileId,
        businessName: tenant.businessName,
        reason: "No active opportunities have been detected yet — not enough evidence to form a confident view.",
      });
    } else if (opportunities.every((o) => o.confidence === "low")) {
      confidenceGaps.push({
        businessProfileId: tenant.businessProfileId,
        businessName: tenant.businessName,
        reason: `${opportunities.length} active opportunit${opportunities.length === 1 ? "y is" : "ies are"} low-confidence — more evidence would help.`,
      });
    }

    for (const opportunity of opportunities) {
      const daysActive = daysSince(opportunity.firstDetectedAt, now);
      if (daysActive >= STALLED_OPPORTUNITY_DAYS) {
        stalledOpportunities.push({
          businessProfileId: tenant.businessProfileId,
          businessName: tenant.businessName,
          opportunityId: opportunity.id,
          statement: opportunity.statement,
          daysActive,
        });
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    businessesNeedingAttention: businessesNeedingAttention.slice(0, MAX_BUSINESSES_PER_BUCKET),
    businessesDoingWell: businessesDoingWell.slice(0, MAX_BUSINESSES_PER_BUCKET),
    confidenceGaps: confidenceGaps.slice(0, MAX_BUSINESSES_PER_BUCKET),
    stalledOpportunities: stalledOpportunities
      .sort((a, b) => b.daysActive - a.daysActive)
      .slice(0, MAX_STALLED_OPPORTUNITIES),
  };
}
