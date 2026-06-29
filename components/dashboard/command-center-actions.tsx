"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncGoogleBusinessProfile } from "@/lib/google-business/client";
import type { CommandCenterRecommendedAction } from "@/lib/command-center/types";

export function actionHref(action: CommandCenterRecommendedAction): string {
  switch (action) {
    case "open_approval":
      return "/dashboard/approvals";
    case "open_publishing":
      return "/dashboard/publishing";
    case "open_marketing_plan":
    case "refresh_marketing_plan":
      return "/dashboard/marketing-plan";
    case "open_website_analysis":
    case "refresh_website_analysis":
      return "/dashboard/website-analysis";
    case "open_google_business":
    case "sync_google_business":
      return "/dashboard/google-business-profile";
    case "open_tasks":
      return "/dashboard/tasks";
    case "generate_content":
    default:
      return "/dashboard/content/generator";
  }
}

export function CommandCenterQuickActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runSyncGoogle() {
    setBusy("sync");
    setMessage(null);
    const { error } = await syncGoogleBusinessProfile();
    setBusy(null);
    if (error) {
      setMessage(error);
      return;
    }
    router.refresh();
  }

  async function runWebsiteAnalysisRefresh() {
    setBusy("analysis");
    setMessage(null);
    const response = await fetch("/api/website-analysis", { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? "Unable to refresh website analysis");
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  const actions = [
    { label: "Generate Content", href: "/dashboard/content/generator" },
    { label: "Refresh Website Analysis", onClick: runWebsiteAnalysisRefresh },
    { label: "Refresh Marketing Plan", href: "/dashboard/marketing-plan" },
    { label: "Sync Google Business", onClick: runSyncGoogle },
    { label: "Open Approval Center", href: "/dashboard/approvals" },
    { label: "Open Publishing Queue", href: "/dashboard/publishing" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              disabled={!!busy}
              onClick={() => void action.onClick?.()}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
            >
              {busy === "sync" && action.label === "Sync Google Business"
                ? "Syncing..."
                : busy === "analysis" && action.label === "Refresh Website Analysis"
                  ? "Refreshing..."
                  : action.label}
            </button>
          )
        )}
      </div>
      {message && <p className="mt-3 text-sm text-rose-600">{message}</p>}
    </div>
  );
}

export function CommandCenterTakeActionButton({
  action,
}: {
  action: CommandCenterRecommendedAction;
}) {
  return (
    <Link
      href={actionHref(action)}
      className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
    >
      Take Action
    </Link>
  );
}
