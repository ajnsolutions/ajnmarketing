import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { checkRateLimit } from "@/lib/interactive-demo/rate-limit";
import { GROWTH_ADVISOR_EVENTS, trackGrowthAdvisorEvent, type GrowthAdvisorEvent } from "@/lib/growth-advisor/experienceAnalytics";

export const runtime = "nodejs";

const ALLOWED_METADATA_KEYS = new Set(["section", "recommendationId"]);
const MAX_METADATA_VALUE_LENGTH = 80;

/** Strips anything outside the tiny approved shape — the actual enforcement point for "never log conversation content." */
function sanitizeMetadata(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value !== "string") continue;
    out[key] = value.slice(0, MAX_METADATA_VALUE_LENGTH);
  }
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const limit = checkRateLimit({ key: `growth-advisor-events:${user.id}`, limit: 240, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { event?: string; metadata?: unknown };
  try {
    body = (await request.json()) as { event?: string; metadata?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.event || !GROWTH_ADVISOR_EVENTS.includes(body.event as GrowthAdvisorEvent)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const profile = await getBusinessProfileForUser();

  trackGrowthAdvisorEvent(
    body.event as GrowthAdvisorEvent,
    { tenantUserId: user.id, businessProfileId: profile?.id ?? null },
    sanitizeMetadata(body.metadata),
  );

  return NextResponse.json({ ok: true });
}
