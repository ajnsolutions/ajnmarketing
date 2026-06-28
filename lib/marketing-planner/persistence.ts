import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingPlan,
  MarketingPlanJson,
  MarketingPlanStatus,
} from "@/lib/marketing-planner/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMarketingPlanStatus(status: MarketingPlanStatus | null | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "generating":
      return "Generating";
    case "failed":
      return "Failed";
    default:
      return "Not Generated";
  }
}

export function formatMarketingPlanMonth(month: number, year: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? "Month";
  return `${monthName} ${year}`;
}

export function formatMarketingPlanDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export async function getLatestMarketingPlanForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MarketingPlan | null> {
  const { data, error } = await supabase
    .from("marketing_plans")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as MarketingPlan;
}

export async function getMarketingPlanForUserMonth(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MarketingPlan | null> {
  const { data, error } = await supabase
    .from("marketing_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (error || !data) return null;
  return data as MarketingPlan;
}

export async function upsertMarketingPlanGenerating(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    month: number;
    year: number;
  }
): Promise<MarketingPlan | null> {
  const { data, error } = await supabase
    .from("marketing_plans")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        month: input.month,
        year: input.year,
        status: "generating",
        plan_json: {},
      },
      { onConflict: "user_id,year,month" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return data as MarketingPlan;
}

export async function saveMarketingPlanResult(
  supabase: SupabaseClient,
  input: {
    userId: string;
    month: number;
    year: number;
    planJson: MarketingPlanJson;
  }
): Promise<MarketingPlan | null> {
  const { data, error } = await supabase
    .from("marketing_plans")
    .update({
      status: "active",
      plan_json: input.planJson,
    })
    .eq("user_id", input.userId)
    .eq("month", input.month)
    .eq("year", input.year)
    .select("*")
    .single();

  if (error || !data) return null;
  return data as MarketingPlan;
}

export async function markMarketingPlanFailed(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MarketingPlan | null> {
  const { data, error } = await supabase
    .from("marketing_plans")
    .update({ status: "failed" })
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .select("*")
    .single();

  if (error || !data) return null;
  return data as MarketingPlan;
}
