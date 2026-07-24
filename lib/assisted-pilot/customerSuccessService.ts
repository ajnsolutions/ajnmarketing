import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAssistedPilotDashboard } from "@/lib/assisted-pilot/service";
import {
  composeAttentionCenter,
  composeCustomerSuccessCards,
  enrichCustomerSuccessCards,
  type AttentionItem,
  type CustomerSuccessCard,
} from "@/lib/assisted-pilot/customerSuccessCompose";
import { getCustomerSetupSnapshotForUser } from "@/lib/customer-setup/service";
import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import { buildOpsDashboardSummary } from "@/lib/ops-dashboard/service";
import { getTenantOperationalHealthPage } from "@/lib/ops-dashboard/tenantHealth";
import { findStuckBackgroundJobs } from "@/lib/ops-dashboard/jobLifecycle";
import { buildProductionReadinessSummary } from "@/lib/production-readiness/model";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import type { AssistedPilotDashboardData } from "@/lib/assisted-pilot/types";
import type { OpsDashboardSummary } from "@/lib/ops-dashboard/types";
import type { ProductionReadinessSummary } from "@/lib/production-readiness/types";

export type CustomerSuccessDashboardData = {
  generatedAt: string;
  scheduleGateOpen: boolean;
  cards: CustomerSuccessCard[];
  attention: AttentionItem[];
  pilot: AssistedPilotDashboardData | null;
  opsSummary: OpsDashboardSummary | null;
  readiness: ProductionReadinessSummary | null;
  stuckJobCount: number;
};

/**
 * Server composition for Phase 5 Customer Success — reuses existing builders only.
 */
export async function buildCustomerSuccessDashboard(
  serviceClient: SupabaseClient,
): Promise<CustomerSuccessDashboardData> {
  const [pilot, tenants, stuckJobs, opsSummary] = await Promise.all([
    buildAssistedPilotDashboard(serviceClient),
    getTenantOperationalHealthPage(serviceClient, { page: 1, pageSize: 50 }),
    findStuckBackgroundJobs(serviceClient),
    buildOpsDashboardSummary(serviceClient),
  ]);

  const setupEntries = await Promise.all(
    tenants.tenants.map(async (tenant) => {
      const setup = await getCustomerSetupSnapshotForUser(tenant.userId, {
        supabaseClient: serviceClient,
      }).catch(() => null);
      return [tenant.businessProfileId, setup] as const;
    }),
  );
  const setupByBusinessProfileId: Record<string, CustomerSetupSnapshot | null> =
    Object.fromEntries(setupEntries);

  const pilotsByProfileId = new Map(pilot.pilots.map((p) => [p.businessProfileId, p]));

  const baseCards = composeCustomerSuccessCards({
    pilot,
    tenants,
    setupByBusinessProfileId,
  });

  const cards = enrichCustomerSuccessCards(
    baseCards,
    setupByBusinessProfileId,
    tenants.tenants,
    pilotsByProfileId,
  );

  const attention = composeAttentionCenter({
    cards,
    openIssues: pilot.openIssues,
    stuckJobCount: stuckJobs.length,
  });

  const readiness = await buildProductionReadinessSummary({
    probeDatabase: async () => {
      const { error } = await serviceClient.from("business_profiles").select("id").limit(1);
      return {
        ok: !error,
        message: error ? error.message.slice(0, 200) : "Database probe succeeded.",
      };
    },
    migrationSupabase: serviceClient,
    pilotReadiness: {
      score: pilot.aggregateReadiness.total,
      recommendation: pilot.launchRecommendation,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    cards,
    attention,
    pilot,
    opsSummary,
    readiness,
    stuckJobCount: stuckJobs.length,
  };
}
