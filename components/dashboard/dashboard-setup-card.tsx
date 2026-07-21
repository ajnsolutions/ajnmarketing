"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { setupOverallStatusPresentation } from "@/lib/customer-setup/statusLabels";
import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";

export function DashboardSetupCard({ snapshot }: { snapshot: CustomerSetupSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const overall = setupOverallStatusPresentation(snapshot.overallStatus);
  const nextStep = snapshot.steps.find((step) => step.key === snapshot.nextStepKey) ?? null;
  const needsAttention = snapshot.needsAttentionStepKeys.length > 0;

  if (hidden) return null;

  function dismiss() {
    startTransition(async () => {
      await fetch("/api/setup/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissOnboarding: true }),
      });
      setHidden(true);
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="dashboard-setup-card-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="dashboard-setup-card-heading" className="text-base font-bold text-navy-900">
              Setup progress
            </h2>
            <StatusBadge presentation={overall} />
          </div>
          <p className="mt-2 text-sm leading-6 text-text-muted">{snapshot.readinessExplanation}</p>
          <p className="mt-2 text-sm text-navy-900">
            {snapshot.requiredComplete}/{snapshot.requiredTotal} required ·{" "}
            {snapshot.requiredPercentComplete}%
          </p>
          {needsAttention && (
            <p className="mt-2 text-sm font-medium text-amber-800" role="status">
              Something needs your attention before related features work smoothly.
            </p>
          )}
          {nextStep && (
            <p className="mt-2 text-sm text-text-muted">
              Next: <span className="font-medium text-navy-900">{nextStep.title}</span>
            </p>
          )}
        </div>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={snapshot.requiredPercentComplete}
        aria-label="Required setup percent complete"
      >
        <div
          className="h-full rounded-full bg-brand-600"
          style={{ width: `${snapshot.requiredPercentComplete}%` }}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/dashboard/setup"
          className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Continue setup
        </Link>
        {nextStep && (
          <Link
            href={nextStep.destinationRoute}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          >
            {nextStep.primaryActionLabel}
          </Link>
        )}
        {!needsAttention && (
          <button
            type="button"
            disabled={pending}
            onClick={dismiss}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60"
          >
            Remind me later
          </button>
        )}
      </div>
    </section>
  );
}
