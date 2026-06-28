import type {
  AiMarketingTaskWithMeta,
  MarketingAgentTaskPatchInput,
  MarketingAgentTasksPageData,
} from "@/lib/marketing-agent/types";

export async function fetchMarketingAgentTasks(): Promise<{
  data: MarketingAgentTasksPageData;
  error?: string;
}> {
  const response = await fetch("/api/marketing-agent/tasks", { method: "GET" });
  const payload = (await response.json()) as MarketingAgentTasksPageData & { error?: string };

  if (!response.ok) {
    return {
      data: {
        tasks: [],
        stats: { dueToday: 0, completedToday: 0, highPriorityPending: 0, topPriority: null },
      },
      error: payload.error ?? "Unable to load marketing tasks",
    };
  }

  return { data: payload };
}

export async function refreshMarketingAgentTasks(): Promise<{
  data: MarketingAgentTasksPageData;
  error?: string;
}> {
  const response = await fetch("/api/marketing-agent/tasks", { method: "POST" });
  const payload = (await response.json()) as MarketingAgentTasksPageData & { error?: string };

  if (!response.ok) {
    return {
      data: {
        tasks: [],
        stats: { dueToday: 0, completedToday: 0, highPriorityPending: 0, topPriority: null },
      },
      error: payload.error ?? "Unable to refresh marketing tasks",
    };
  }

  return { data: payload };
}

export async function patchMarketingAgentTask(
  input: MarketingAgentTaskPatchInput
): Promise<{ task: AiMarketingTaskWithMeta | null; error?: string }> {
  const response = await fetch("/api/marketing-agent/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    task?: AiMarketingTaskWithMeta | null;
    error?: string;
  };

  if (!response.ok) {
    return { task: null, error: payload.error ?? "Unable to update task" };
  }

  return { task: payload.task ?? null };
}
