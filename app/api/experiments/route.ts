import { NextResponse } from "next/server";
import {
  getExperimentDashboardForBusiness,
  listExperimentsForBusiness,
} from "@/lib/marketing-experimentation/experiment-service";
import { listExperimentProposalsForBusiness } from "@/lib/marketing-experimentation/proposal-service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Experimentation Engine API — read-only listing.
 *
 * [Claude review, follow-up] POST (free-form creation via a client-supplied,
 * unverified decision-provenance string) removed entirely — Next.js rejects any other
 * method on this route automatically since only GET is exported. Experiments may only
 * be created by approving a persisted proposal: see POST /api/experiment-proposals/[id].
 */
export async function GET() {
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

  const [dashboard, experiments, pendingProposals] = await Promise.all([
    getExperimentDashboardForBusiness(user.id, profile.id, { supabaseClient: supabase }),
    listExperimentsForBusiness(user.id, profile.id, { supabaseClient: supabase }),
    listExperimentProposalsForBusiness(supabase, user.id, profile.id),
  ]);

  return NextResponse.json({ dashboard, experiments, pendingProposals });
}
