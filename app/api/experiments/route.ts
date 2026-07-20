import { NextResponse } from "next/server";
import { parseProposeExperimentRequestBody } from "@/lib/marketing-experimentation/experiment-request";
import {
  getExperimentDashboardForBusiness,
  listExperimentsForBusiness,
  proposeExperimentForBusiness,
} from "@/lib/marketing-experimentation/experiment-service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Experimentation Engine API — list / propose.
 * Proposal requires Marketing Director gate (proposedBy + decision key + recommendation).
 * No schedules. No autonomous publishing/approval.
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

  const [dashboard, experiments] = await Promise.all([
    getExperimentDashboardForBusiness(user.id, profile.id, { supabaseClient: supabase }),
    listExperimentsForBusiness(user.id, profile.id, { supabaseClient: supabase }),
  ]);

  return NextResponse.json({ dashboard, experiments });
}

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseProposeExperimentRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await proposeExperimentForBusiness(user.id, profile.id, parsed.value, {
    supabaseClient: supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ experiment: result.experiment }, { status: 201 });
}
