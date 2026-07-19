import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { parseDeactivatePreferenceRequestBody } from "@/lib/marketing-memory/preferenceRequest";
import {
  deactivatePreferenceForBusiness,
  getPreferencesForBusiness,
  upsertPreferenceForBusiness,
} from "@/lib/marketing-memory/preferenceService";
import { createClient } from "@/lib/supabase/server";

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

  const result = await getPreferencesForBusiness(user.id, profile.id, {
    supabaseClient: supabase,
  });

  return NextResponse.json({
    preferences: result.preferences,
    summaries: result.summaries,
    disabledContextCategories: result.disabledContextCategories,
  });
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

  const result = await upsertPreferenceForBusiness(user.id, profile.id, body, {
    supabaseClient: supabase,
    actorUserId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ preference: result.value });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseDeactivatePreferenceRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await deactivatePreferenceForBusiness(user.id, parsed.preferenceId, {
    supabaseClient: supabase,
    actorUserId: user.id,
    activeUntil: parsed.activeUntil,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ preference: result.value });
}
