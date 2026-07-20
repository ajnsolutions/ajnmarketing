import { NextResponse } from "next/server";
import {
  advanceExperimentForUser,
  completeExperimentForUser,
  measureExperimentForUser,
} from "@/lib/marketing-experimentation/experiment-service";
import { getMarketingExperimentForUser } from "@/lib/marketing-experimentation/experiment-persistence";
import { explainExperiment } from "@/lib/marketing-experimentation/experiment-engine";
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
  const experiment = await getMarketingExperimentForUser(supabase, user.id, id);
  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  return NextResponse.json({
    experiment,
    explanation: explainExperiment(experiment),
  });
}

/**
 * Progress an experiment: advance lifecycle, measure outcomes, or complete.
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
    const result = await advanceExperimentForUser(user.id, id, { supabaseClient: supabase });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      experiment: result.experiment,
      explanation: explainExperiment(result.experiment),
    });
  }

  if (action === "measure") {
    const result = await measureExperimentForUser(user.id, id, { supabaseClient: supabase });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      experiment: result.experiment,
      explanation: explainExperiment(result.experiment),
    });
  }

  if (action === "complete") {
    const result = await completeExperimentForUser(user.id, id, { supabaseClient: supabase });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      experiment: result.experiment,
      explanation: explainExperiment(result.experiment),
    });
  }

  return NextResponse.json(
    { error: "action must be advance, measure, or complete" },
    { status: 400 },
  );
}
