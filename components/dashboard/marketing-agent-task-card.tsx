"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatTaskPriority,
  formatTaskStatus,
} from "@/lib/marketing-agent/persistence";
import { patchMarketingAgentTask } from "@/lib/marketing-agent-client";
import type { AiMarketingTaskWithMeta } from "@/lib/marketing-agent/types";

function PriorityBadge({ priority }: { priority: AiMarketingTaskWithMeta["priority"] }) {
  const styles = {
    high: "bg-rose-50 text-rose-600 ring-rose-100",
    medium: "bg-amber-50 text-amber-700 ring-amber-100",
    low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {formatTaskPriority(priority)} Priority
    </span>
  );
}

function actionHref(action: AiMarketingTaskWithMeta["meta"]): string {
  switch (action?.recommended_action) {
    case "open_approval":
      return "/dashboard/approvals";
    case "open_publishing":
      return "/dashboard/publishing";
    case "open_marketing_plan":
    case "refresh_marketing_plan":
      return "/dashboard/marketing-plan";
    case "open_website_analysis":
      return "/dashboard/website-analysis";
    case "generate_content":
    case "review_content":
    default:
      return "/dashboard/content/generator";
  }
}

function actionLabel(action: AiMarketingTaskWithMeta["meta"]): string {
  switch (action?.recommended_action) {
    case "open_approval":
      return "Open Approval";
    case "open_publishing":
      return "Open Publishing Queue";
    case "open_marketing_plan":
      return "Open Marketing Plan";
    case "refresh_marketing_plan":
      return "Open Marketing Plan";
    case "open_website_analysis":
      return "Open Website Analysis";
    case "review_content":
      return "Review Content";
    case "generate_content":
    default:
      return "Generate Content";
  }
}

export function MarketingAgentTaskCard({ task }: { task: AiMarketingTaskWithMeta }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function runAction(action: "complete" | "dismiss" | "start") {
    setBusy(action);
    await patchMarketingAgentTask({ id: task.id, action });
    setBusy(null);
    router.refresh();
  }

  const isClosed = task.status === "completed" || task.status === "dismissed";

  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <span className="rounded-full bg-[#081426]/5 px-2.5 py-1 text-[11px] font-semibold text-navy-900 ring-1 ring-slate-200">
          {task.task_type.replace(/_/g, " ")}
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
          {formatTaskStatus(task.status)}
        </span>
        {task.meta && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            ~{task.meta.estimated_minutes} min
          </span>
        )}
      </div>

      <h3 className="mt-3 font-semibold text-navy-900">{task.title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{task.description}</p>

      {task.meta?.reason && (
        <p className="mt-3 text-sm leading-6 text-text-muted">
          <span className="font-semibold text-navy-900">Reason:</span> {task.meta.reason}
        </p>
      )}

      {task.meta?.recommended_action && (
        <p className="mt-2 text-sm leading-6 text-text-muted">
          <span className="font-semibold text-navy-900">Recommended Action:</span>{" "}
          {actionLabel(task.meta)}
        </p>
      )}

      {!isClosed && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={actionHref(task.meta)}
            className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            {actionLabel(task.meta)}
          </Link>
          <Link
            href="/dashboard/approvals"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Open Approval
          </Link>
          <Link
            href="/dashboard/publishing"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Open Publishing Queue
          </Link>
          <Link
            href="/dashboard/marketing-plan"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Open Marketing Plan
          </Link>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void runAction("complete")}
            className="rounded-full border border-emerald-200 bg-growth-50 px-3.5 py-2 text-sm font-semibold text-growth-600 transition-colors hover:bg-emerald-100 disabled:opacity-60"
          >
            {busy === "complete" ? "Updating..." : "Mark Complete"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void runAction("dismiss")}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
          >
            {busy === "dismiss" ? "Updating..." : "Dismiss"}
          </button>
        </div>
      )}
    </article>
  );
}
