import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiMarketingTask,
  AiMarketingTaskWithMeta,
  GeneratedMarketingTask,
  MarketingAgentTaskStats,
  MarketingTaskPlanMeta,
  MarketingTaskPriority,
  MarketingTaskRecommendedAction,
  MarketingTaskStatus,
} from "@/lib/marketing-agent/types";

export function formatTaskPriority(priority: MarketingTaskPriority | null | undefined): string {
  switch (priority) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Medium";
  }
}

export function formatTaskStatus(status: MarketingTaskStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "dismissed":
      return "Dismissed";
    default:
      return "Unknown";
  }
}

export function getTodayDateString(referenceDate = new Date()): string {
  return referenceDate.toISOString().slice(0, 10);
}

export function encodeTaskMeta(meta: MarketingTaskPlanMeta): string {
  return JSON.stringify(meta);
}

export function decodeTaskMeta(raw: string | null | undefined): MarketingTaskPlanMeta | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as MarketingTaskPlanMeta;
    if (!parsed.reason || !parsed.recommended_action) return null;
    return {
      reason: parsed.reason,
      recommended_action: parsed.recommended_action,
      estimated_minutes: Number(parsed.estimated_minutes) || 15,
    };
  } catch {
    return null;
  }
}

export function toTaskWithMeta(task: AiMarketingTask): AiMarketingTaskWithMeta {
  return {
    ...task,
    meta: decodeTaskMeta(task.related_plan_item),
  };
}

const PRIORITY_ORDER: Record<MarketingTaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortTasks(tasks: AiMarketingTaskWithMeta[]): AiMarketingTaskWithMeta[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.created_at.localeCompare(b.created_at);
  });
}

export async function getMarketingTasksForUserOnDate(
  supabase: SupabaseClient,
  userId: string,
  dueDate: string
): Promise<AiMarketingTask[]> {
  const { data, error } = await supabase
    .from("ai_marketing_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("due_date", dueDate)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as AiMarketingTask[];
}

export async function getMarketingTaskById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<AiMarketingTask | null> {
  const { data, error } = await supabase
    .from("ai_marketing_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AiMarketingTask;
}

export async function dismissPendingTasksForDate(
  supabase: SupabaseClient,
  userId: string,
  dueDate: string
): Promise<void> {
  await supabase
    .from("ai_marketing_tasks")
    .update({ status: "dismissed" })
    .eq("user_id", userId)
    .eq("due_date", dueDate)
    .in("status", ["pending", "in_progress"]);
}

export async function insertMarketingTasks(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    marketingPlanId: string | null;
    dueDate: string;
    tasks: GeneratedMarketingTask[];
  }
): Promise<AiMarketingTask[]> {
  if (input.tasks.length === 0) return [];

  const rows = input.tasks.map((task) => ({
    user_id: input.userId,
    business_profile_id: input.businessProfileId,
    marketing_plan_id: input.marketingPlanId,
    task_type: task.task_type,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: "pending" as MarketingTaskStatus,
    due_date: input.dueDate,
    related_content_id: task.related_content_id ?? null,
    related_plan_item: encodeTaskMeta({
      reason: task.reason,
      recommended_action: task.recommended_action,
      estimated_minutes: task.estimated_minutes,
    }),
  }));

  const { data, error } = await supabase.from("ai_marketing_tasks").insert(rows).select("*");

  if (error || !data) return [];
  return data as AiMarketingTask[];
}

export async function updateMarketingTaskStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  status: MarketingTaskStatus
): Promise<AiMarketingTask | null> {
  const updates: Partial<AiMarketingTask> = { status };

  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("ai_marketing_tasks")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return null;
  return data as AiMarketingTask;
}

export function buildTaskStats(tasks: AiMarketingTaskWithMeta[]): MarketingAgentTaskStats {
  const pendingOrInProgress = tasks.filter(
    (task) => task.status === "pending" || task.status === "in_progress"
  );
  const completedToday = tasks.filter((task) => task.status === "completed").length;
  const highPriorityPending = pendingOrInProgress.filter((task) => task.priority === "high").length;
  const topPriority = sortTasks(pendingOrInProgress)[0] ?? null;

  return {
    dueToday: pendingOrInProgress.length,
    completedToday,
    highPriorityPending,
    topPriority,
  };
}

export function normalizeRecommendedAction(value: string): MarketingTaskRecommendedAction {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes("approval")) return "open_approval";
  if (normalized.includes("publish")) return "open_publishing";
  if (normalized.includes("marketing plan") || normalized.includes("marketing_plan")) {
    return "open_marketing_plan";
  }
  if (normalized.includes("website")) return "open_website_analysis";
  if (normalized.includes("refresh") && normalized.includes("plan")) return "refresh_marketing_plan";
  if (normalized.includes("review")) return "review_content";
  return "generate_content";
}

export function normalizePriority(value: string): MarketingTaskPriority {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  return "medium";
}
