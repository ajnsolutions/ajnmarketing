import { NextResponse } from "next/server";
import {
  generateMarketingPlanForCurrentUser,
  getLatestMarketingPlanForCurrentUser,
} from "@/lib/marketing-planner/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getLatestMarketingPlanForCurrentUser();
  return NextResponse.json({ plan });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, error } = await generateMarketingPlanForCurrentUser();

  if (error || !plan) {
    return NextResponse.json(
      { error: error ?? "Marketing plan generation failed" },
      { status: error === "Unauthorized" ? 401 : 502 }
    );
  }

  return NextResponse.json({ plan });
}
