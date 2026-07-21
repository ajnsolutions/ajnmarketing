"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { PageHeader, SectionHeader } from "@/components/dashboard/ui/page-chrome";
import {
  setupOverallStatusPresentation,
  setupStepStatusPresentation,
} from "@/lib/customer-setup/statusLabels";
import {
  SetupOverallStatuses,
  SetupStepCategories,
  SetupStepStatuses,
  type CustomerSetupSnapshot,
  type SetupStepView,
} from "@/lib/customer-setup/types";

function categoryLabel(category: SetupStepView["category"]): string {
  switch (category) {
    case SetupStepCategories.FOUNDATION:
      return "Foundation";
    case SetupStepCategories.CONNECTIONS:
      return "Connections";
    case SetupStepCategories.STRATEGY:
      return "Strategy readiness";
    case SetupStepCategories.EXECUTION:
      return "Execution readiness";
    case SetupStepCategories.OPTIONAL:
      return "Optional enhancements";
    default:
      return "Setup";
  }
}

function StepRow({
  step,
  onSkip,
  onAcknowledge,
  busy,
}: {
  step: SetupStepView;
  onSkip: (key: string) => void;
  onAcknowledge: (key: string) => void;
  busy: boolean;
}) {
  const presentation = setupStepStatusPresentation(step.status);
  const showSkip =
    step.canSkip &&
    step.status !== SetupStepStatuses.COMPLETE &&
    step.status !== SetupStepStatuses.SKIPPED;
  const showAcknowledge =
    (step.educationalOnly ||
      step.key === "notifications" ||
      step.key === "marketing_preferences") &&
    step.status !== SetupStepStatuses.COMPLETE &&
    step.status !== SetupStepStatuses.SKIPPED;

  return (
    <li className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-navy-900">{step.title}</h3>
            <StatusBadge presentation={presentation} />
            {!step.required && (
              <span className="text-xs font-medium text-text-muted">Optional</span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>
          <p className="mt-2 text-sm leading-6 text-navy-900">
            <span className="font-medium">Why it matters:</span> {step.whyItMatters}
          </p>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            <span className="font-medium text-navy-900">Done when:</span>{" "}
            {step.completionCriteria}
          </p>
          <p className="mt-1 text-sm leading-6 text-text-muted" role="status">
            {step.statusReason}
          </p>
          {step.blockedReason && (
            <p className="mt-2 text-sm font-medium text-amber-800" role="status">
              Blocked: {step.blockedReason}
            </p>
          )}
          {step.freshnessLabel && (
            <p className="mt-1 text-xs text-text-muted">{step.freshnessLabel}</p>
          )}
          <p className="mt-1 text-xs text-text-muted">{step.estimatedEffort}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={step.destinationRoute}
          className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          {step.primaryActionLabel}
        </Link>
        {showSkip && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSkip(step.key)}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Skip for now
          </button>
        )}
        {showAcknowledge && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAcknowledge(step.key)}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Mark as understood
          </button>
        )}
      </div>
    </li>
  );
}

export function SetupChecklist({ initialSnapshot }: { initialSnapshot: CustomerSetupSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const overall = setupOverallStatusPresentation(snapshot.overallStatus);
  const nextStep = snapshot.steps.find((step) => step.key === snapshot.nextStepKey) ?? null;

  const requiredSteps = useMemo(
    () => snapshot.steps.filter((step) => step.required),
    [snapshot.steps],
  );
  const recommendedSteps = useMemo(
    () =>
      snapshot.steps.filter(
        (step) =>
          !step.required &&
          (step.category === SetupStepCategories.FOUNDATION ||
            step.category === SetupStepCategories.CONNECTIONS ||
            step.category === SetupStepCategories.STRATEGY ||
            step.category === SetupStepCategories.EXECUTION) &&
          !step.educationalOnly,
      ),
    [snapshot.steps],
  );
  const educationalSteps = useMemo(
    () => snapshot.steps.filter((step) => step.educationalOnly),
    [snapshot.steps],
  );
  const optionalEnhancements = useMemo(
    () =>
      snapshot.steps.filter(
        (step) => step.category === SetupStepCategories.OPTIONAL && !step.educationalOnly,
      ),
    [snapshot.steps],
  );

  function refreshFromResponse(data: { setup?: CustomerSetupSnapshot; error?: string }) {
    if (data.setup) {
      setSnapshot(data.setup);
      setError(null);
      router.refresh();
      return;
    }
    setError(data.error ?? "Something went wrong. Please try again.");
  }

  function onSkip(key: string) {
    startTransition(async () => {
      const response = await fetch(`/api/setup/steps/${key}/skip`, { method: "POST" });
      const data = (await response.json()) as { setup?: CustomerSetupSnapshot; error?: string };
      refreshFromResponse(data);
    });
  }

  function onAcknowledge(key: string) {
    startTransition(async () => {
      const response = await fetch(`/api/setup/steps/${key}/acknowledge`, { method: "POST" });
      const data = (await response.json()) as { setup?: CustomerSetupSnapshot; error?: string };
      refreshFromResponse(data);
    });
  }

  function onDismissCard() {
    startTransition(async () => {
      const response = await fetch("/api/setup/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissOnboarding: true }),
      });
      const data = (await response.json()) as { setup?: CustomerSetupSnapshot; error?: string };
      refreshFromResponse(data);
    });
  }

  function onAcknowledgeCompletion() {
    startTransition(async () => {
      const response = await fetch("/api/setup/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeCompletion: true, dismissOnboarding: true }),
      });
      const data = (await response.json()) as { setup?: CustomerSetupSnapshot; error?: string };
      refreshFromResponse(data);
    });
  }

  const isComplete = snapshot.overallStatus === SetupOverallStatuses.COMPLETE;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow="Setup"
        title="Get AJN Marketing ready for your business"
        description="See what is required, what is optional, and what to do next. You can leave anytime and pick up where you left off."
        backHref="/dashboard"
        backLabel="Back to Head of Marketing"
      />

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="setup-readiness-heading"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="setup-readiness-heading" className="text-lg font-bold text-navy-900">
            Setup progress
          </h2>
          <StatusBadge presentation={overall} />
        </div>
        <p className="mt-3 text-sm leading-7 text-text-muted">{snapshot.readinessExplanation}</p>
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={snapshot.requiredPercentComplete}
            aria-label="Required setup percent complete"
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${snapshot.requiredPercentComplete}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-navy-900">
            {snapshot.requiredComplete} of {snapshot.requiredTotal} required steps complete (
            {snapshot.requiredPercentComplete}%)
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Optional: {snapshot.optionalComplete} of {snapshot.optionalTotal} addressed
          </p>
        </div>
        {nextStep && !isComplete && (
          <div className="mt-5 rounded-xl bg-brand-50/70 px-4 py-3 ring-1 ring-brand-100">
            <p className="text-sm font-semibold text-navy-900">Next recommended step</p>
            <p className="mt-1 text-sm text-text-muted">
              {nextStep.title} — {nextStep.estimatedEffort}
            </p>
            <Link
              href={nextStep.destinationRoute}
              className="hom-focusable mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {nextStep.primaryActionLabel}
            </Link>
          </div>
        )}
        {isComplete && (
          <div className="mt-5 space-y-3 rounded-xl bg-growth-50/80 px-4 py-4 ring-1 ring-emerald-100">
            <p className="text-sm font-semibold text-growth-700">Required setup is complete</p>
            <p className="text-sm leading-6 text-text-muted">
              Head of Marketing is ready. Optional connections can wait — they unlock more local
              features when you want them.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/dashboard"
                className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Open Head of Marketing
              </Link>
              <Link
                href="/dashboard/command-center"
                className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
              >
                Review Command Center
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={onAcknowledgeCompletion}
                className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Continue without reminders
              </button>
            </div>
          </div>
        )}
        {!isComplete && (
          <button
            type="button"
            disabled={pending}
            onClick={onDismissCard}
            className="hom-focusable mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60"
          >
            Hide dashboard reminder for now
          </button>
        )}
      </section>

      {error && (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}

      {snapshot.warnings.length > 0 && (
        <p className="text-sm text-amber-800" role="status">
          Some optional status checks could not refresh. You can still continue setup.
        </p>
      )}

      <section aria-labelledby="required-setup-heading" className="space-y-4">
        <SectionHeader
          headingId="required-setup-heading"
          title="Required setup"
          description="The minimum foundation for a useful Head of Marketing experience."
        />
        <ol className="space-y-3">
          {requiredSteps.map((step) => (
            <StepRow
              key={step.key}
              step={step}
              onSkip={onSkip}
              onAcknowledge={onAcknowledge}
              busy={pending}
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby="recommended-setup-heading" className="space-y-4">
        <SectionHeader
          headingId="recommended-setup-heading"
          title="Recommended next"
          description="Strongly helpful, but not required to enter the product."
        />
        <ul className="space-y-3">
          {recommendedSteps.map((step) => (
            <StepRow
              key={step.key}
              step={step}
              onSkip={onSkip}
              onAcknowledge={onAcknowledge}
              busy={pending}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="education-setup-heading" className="space-y-4">
        <SectionHeader
          headingId="education-setup-heading"
          title="Approvals and publishing"
          description="Short education only — you do not need to approve or publish anything to finish setup."
        />
        <ul className="space-y-3">
          {educationalSteps.map((step) => (
            <StepRow
              key={step.key}
              step={step}
              onSkip={onSkip}
              onAcknowledge={onAcknowledge}
              busy={pending}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="optional-setup-heading" className="space-y-4">
        <SectionHeader
          headingId="optional-setup-heading"
          title="Optional enhancements"
          description="Skip freely. Skipped items stay discoverable here."
        />
        <ul className="space-y-3">
          {optionalEnhancements.map((step) => (
            <StepRow
              key={step.key}
              step={step}
              onSkip={onSkip}
              onAcknowledge={onAcknowledge}
              busy={pending}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-5 py-5">
        <h2 className="text-lg font-bold text-navy-900">What becomes available</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-text-muted">
          <li>
            After required setup:{" "}
            {snapshot.headOfMarketingReady
              ? "Head of Marketing is ready."
              : "Head of Marketing unlocks once business basics and goals are in place."}
          </li>
          <li>
            Google Business:{" "}
            {snapshot.googleBusinessDataAvailable
              ? "Connected — local posts and reviews can sync."
              : "Optional. Other product areas still work without it."}
          </li>
          <li>
            Publishing: stays explicit and user-controlled. Approval is not the same as publishing.
          </li>
        </ul>
        <p className="text-sm leading-6 text-text-muted">
          Need help? Return here anytime from Settings → Setup checklist. Categories currently
          covered: {categoryLabel(SetupStepCategories.FOUNDATION)},{" "}
          {categoryLabel(SetupStepCategories.CONNECTIONS)}, and strategy/execution readiness.
        </p>
      </section>
    </div>
  );
}
