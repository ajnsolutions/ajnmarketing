import { NextResponse } from "next/server";
import { parseInitiateCampaignRequestBody } from "@/lib/campaign-intelligence/campaign-request";
import {
  getCampaignDashboardForBusiness,
  initiateCampaignForBusiness,
  listCampaignsForBusiness,
} from "@/lib/campaign-intelligence/campaign-service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Campaign Intelligence API — list / initiate.
 * Initiation requires Marketing Director gate (initiatedBy + decision key).
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

  const [dashboard, campaigns] = await Promise.all([
    getCampaignDashboardForBusiness(user.id, profile.id, { supabaseClient: supabase }),
    listCampaignsForBusiness(user.id, profile.id, { supabaseClient: supabase }),
  ]);

  return NextResponse.json({ dashboard, campaigns });
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

  const parsed = parseInitiateCampaignRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await initiateCampaignForBusiness(user.id, profile.id, parsed.value, {
    supabaseClient: supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ campaign: result.campaign }, { status: 201 });
}
