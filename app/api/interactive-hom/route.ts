import { NextResponse } from "next/server";
import {
  askInteractiveHomForCurrentUser,
  getInteractiveHomSuggestedPrompts,
} from "@/lib/interactive-hom/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Interactive Head of Marketing — grounded Q&A over existing intelligence.
 * Presentation only. No schedules. No autonomous approve/publish.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    suggestedPrompts: getInteractiveHomSuggestedPrompts(),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { question?: unknown }).question
      : undefined;

  if (typeof question !== "string") {
    return NextResponse.json({ error: "question must be a string" }, { status: 400 });
  }

  const result = await askInteractiveHomForCurrentUser(question, {
    supabaseClient: supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    answer: result.answer,
    suggestedPrompts: result.suggestedPrompts,
  });
}
