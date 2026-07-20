import { NextResponse } from "next/server";
import { approveExperimentProposalForUser } from "@/lib/marketing-experimentation/proposal-service";
import { explainExperiment } from "@/lib/marketing-experimentation/experiment-engine";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Approve an already-persisted, server-authored experiment proposal, converting it into
 * exactly one experiment. The client submits no experiment definition of any kind — the
 * server copies every authoritative field (experiment type, hypothesis, control/
 * treatment definitions, primary KPI, measurement window) from the proposal row itself.
 * Idempotent: approving an already-converted proposal returns the same experiment.
 */
export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const { id } = await context.params;

  const result = await approveExperimentProposalForUser(supabase, user.id, profile.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    experiment: result.experiment,
    explanation: explainExperiment(result.experiment),
  });
}
