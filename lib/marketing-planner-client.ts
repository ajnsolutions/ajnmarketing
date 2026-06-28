import type { MarketingPlan } from "@/lib/marketing-planner/types";
import type {
  MarketingPlanCreateContentInput,
  MarketingPlanCreateContentResult,
} from "@/lib/marketing-planner/types";

export async function fetchMarketingPlan(): Promise<{
  plan: MarketingPlan | null;
  error?: string;
}> {
  const response = await fetch("/api/marketing-plan", { method: "GET" });
  const payload = (await response.json()) as {
    plan?: MarketingPlan | null;
    error?: string;
  };

  if (!response.ok) {
    return { plan: null, error: payload.error ?? "Unable to load marketing plan" };
  }

  return { plan: payload.plan ?? null };
}

export async function refreshMarketingPlan(): Promise<{
  plan: MarketingPlan | null;
  error?: string;
}> {
  const response = await fetch("/api/marketing-plan", { method: "POST" });
  const payload = (await response.json()) as {
    plan?: MarketingPlan | null;
    error?: string;
  };

  if (!response.ok) {
    return { plan: null, error: payload.error ?? "Unable to generate marketing plan" };
  }

  return { plan: payload.plan ?? null };
}

export async function createMarketingPlanContent(
  input: MarketingPlanCreateContentInput
): Promise<{ result: MarketingPlanCreateContentResult | null; error?: string }> {
  const response = await fetch("/api/marketing-plan/create-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as MarketingPlanCreateContentResult & { error?: string };

  if (!response.ok) {
    return {
      result: null,
      error: payload.error ?? "Unable to create content from marketing plan item",
    };
  }

  return {
    result: {
      content_approval_id: payload.content_approval_id,
      title: payload.title,
      status: payload.status,
    },
  };
}
