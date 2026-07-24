import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCustomerSuccessDashboard,
  type CustomerSuccessDashboardData,
} from "@/lib/assisted-pilot/customerSuccessService";
import {
  composePilotValidationView,
  type PilotValidationDashboardView,
} from "@/lib/assisted-pilot/pilotValidationCompose";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

export type PilotValidationDashboardData = {
  generatedAt: string;
  scheduleGateOpen: boolean;
  customerSuccess: CustomerSuccessDashboardData;
  view: PilotValidationDashboardView;
};

/**
 * Phase 6 server composition — reuses Customer Success dashboard builders (no duplicate engines).
 */
export async function buildPilotValidationDashboard(
  serviceClient: SupabaseClient,
): Promise<PilotValidationDashboardData> {
  const customerSuccess = await buildCustomerSuccessDashboard(serviceClient);
  const scheduleGateOpen = ATTACH_DECLARATIVE_PRODUCTION_CRONS;
  const generatedAt = new Date().toISOString();

  const view = composePilotValidationView({
    cards: customerSuccess.cards,
    attention: customerSuccess.attention,
    readiness: customerSuccess.readiness,
    opsSummary: customerSuccess.opsSummary,
    pilot: customerSuccess.pilot,
    stuckJobCount: customerSuccess.stuckJobCount,
    scheduleGateOpen,
    generatedAt,
  });

  return {
    generatedAt,
    scheduleGateOpen,
    customerSuccess,
    view,
  };
}
