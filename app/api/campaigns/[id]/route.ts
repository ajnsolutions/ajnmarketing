import { NextResponse } from "next/server";
import {
  advanceCampaignForUser,
  completeCampaignStepForUser,
  skipCampaignStepForUser,
} from "@/lib/campaign-intelligence/campaign-service";
import { getMarketingCampaignForUser } from "@/lib/campaign-intelligence/campaign-persistence";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const campaign = await getMarketingCampaignForUser(supabase, user.id, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

/**
 * Progress a campaign: advance lifecycle, complete a step, or skip a step.
 * Never creates recommendations. Never publishes or approves content.
 */
export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const action = record.action;

  if (action === "advance") {
    const result = await advanceCampaignForUser(user.id, id, { supabaseClient: supabase });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ campaign: result.campaign });
  }

  if (action === "complete_step") {
    if (typeof record.stepKey !== "string" || !record.stepKey.trim()) {
      return NextResponse.json({ error: "stepKey is required" }, { status: 400 });
    }
    const result = await completeCampaignStepForUser(user.id, id, record.stepKey.trim(), {
      supabaseClient: supabase,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ campaign: result.campaign });
  }

  if (action === "skip_step") {
    if (typeof record.stepKey !== "string" || !record.stepKey.trim()) {
      return NextResponse.json({ error: "stepKey is required" }, { status: 400 });
    }
    const result = await skipCampaignStepForUser(user.id, id, record.stepKey.trim(), {
      supabaseClient: supabase,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ campaign: result.campaign });
  }

  return NextResponse.json(
    { error: "action must be advance, complete_step, or skip_step" },
    { status: 400 },
  );
}
