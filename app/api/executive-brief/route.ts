import { NextResponse } from "next/server";
import { getExecutiveBriefForCurrentUser } from "@/lib/executive-briefing/service";
import {
  ExecutiveBriefTypes,
  type ExecutiveBriefType,
} from "@/lib/executive-briefing/types";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<string>(Object.values(ExecutiveBriefTypes));

function parseBriefType(value: string | null): ExecutiveBriefType {
  if (value && ALLOWED_TYPES.has(value)) {
    return value as ExecutiveBriefType;
  }
  return ExecutiveBriefTypes.MORNING;
}

/**
 * Manual refresh for the Executive Brief card. No background schedule — callers
 * invoke on demand. Reuses the Head of Marketing composition path.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const briefType = parseBriefType(searchParams.get("briefType"));
  const brief = await getExecutiveBriefForCurrentUser(briefType);

  if (!brief) {
    return NextResponse.json({ error: "Brief not available" }, { status: 404 });
  }

  return NextResponse.json({ brief });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let briefType: ExecutiveBriefType = ExecutiveBriefTypes.MORNING;
  try {
    const body = (await request.json()) as { briefType?: string };
    briefType = parseBriefType(body.briefType ?? null);
  } catch {
    // empty body → morning brief
  }

  const brief = await getExecutiveBriefForCurrentUser(briefType);
  if (!brief) {
    return NextResponse.json({ error: "Brief not available" }, { status: 404 });
  }

  return NextResponse.json({ brief });
}
