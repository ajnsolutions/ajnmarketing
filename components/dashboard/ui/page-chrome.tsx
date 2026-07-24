import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref = "/dashboard",
  backLabel = "Back to Head of Marketing",
  showBack = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
}) {
  return (
    <header className="max-w-3xl">
      {showBack && (
        <p className="mb-3">
          <Link
            href={backHref}
            className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← {backLabel}
          </Link>
        </p>
      )}
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
      )}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{description}</p>
          )}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  headingId,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  headingId?: string;
  level?: 2 | 3;
}) {
  const HeadingTag = level === 3 ? "h3" : "h2";
  return (
    <div>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
      )}
      <HeadingTag
        id={headingId}
        className={`${eyebrow ? "mt-2" : ""} text-xl font-bold text-navy-900`}
      >
        {title}
      </HeadingTag>
      {description && <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p>}
    </div>
  );
}

export function ReadOnlyNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs leading-5 text-text-muted"
    >
      {children}
    </p>
  );
}

export function LastUpdatedIndicator({
  isoDate,
  prefix = "Updated",
}: {
  isoDate: string | null | undefined;
  prefix?: string;
}) {
  if (!isoDate) return null;
  const formatted = new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <p className="text-xs text-text-muted" aria-live="polite">
      {prefix} {formatted}
    </p>
  );
}

export function InlineHelp({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs leading-5 text-text-muted">{children}</p>;
}

export function PrimaryActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:flex-row sm:items-center sm:p-5">
      {children}
    </div>
  );
}

/**
 * Lightweight orientation for pilot customers — answers where / why / what next
 * without adding dashboard chrome noise.
 */
export function OrientationNote({
  whyItMatters,
  whatHappensNext,
}: {
  whyItMatters: string;
  whatHappensNext?: string;
}) {
  return (
    <div
      className="mt-4 space-y-2 rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-text-muted ring-1 ring-slate-900/[0.02]"
      role="note"
    >
      <p>
        <span className="font-semibold text-navy-900">Why this page matters: </span>
        {whyItMatters}
      </p>
      {whatHappensNext ? (
        <p>
          <span className="font-semibold text-navy-900">What happens next: </span>
          {whatHappensNext}
        </p>
      ) : null}
    </div>
  );
}

export type WorkflowStep = {
  label: string;
  href?: string;
  current?: boolean;
};

/** Connected workflow trail (e.g. Draft → Approve → Publish). */
export function WorkflowTrail({
  steps,
  ariaLabel = "Workflow steps",
}: {
  steps: WorkflowStep[];
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="mt-4">
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {steps.map((step, index) => {
          const content = step.current ? (
            <span
              aria-current="step"
              className="inline-flex min-h-11 items-center rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100"
            >
              {step.label}
            </span>
          ) : step.href ? (
            <Link
              href={step.href}
              className="hom-focusable inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              {step.label}
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center px-3 py-1.5 text-sm font-medium text-text-muted">
              {step.label}
            </span>
          );

          return (
            <li key={`${step.label}-${index}`} className="flex items-center gap-2">
              {content}
              {index < steps.length - 1 ? (
                <span className="hidden text-slate-300 sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const CONTENT_WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "Create draft", href: "/dashboard/content/generator" },
  { label: "Review & approve", href: "/dashboard/approvals" },
  { label: "Publish", href: "/dashboard/publishing" },
];

/** Recommendations sit upstream of drafting — used on the recommendations page. */
export const RECOMMENDATION_WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "Choose a recommendation", href: "/dashboard/marketing-recommendations" },
  ...CONTENT_WORKFLOW_STEPS,
];

/** Full everyday journey including results (Phase 4B continuity). */
export const FULL_CUSTOMER_JOURNEY_STEPS: WorkflowStep[] = [
  { label: "Recommendation", href: "/dashboard/marketing-recommendations" },
  { label: "Content", href: "/dashboard/library" },
  { label: "Approval", href: "/dashboard/approvals" },
  { label: "Publishing", href: "/dashboard/publishing" },
  { label: "Results", href: "/dashboard/results" },
];

/** Attention callout — “what needs me today?” */
export function AttentionBanner({
  headline,
  detail,
  href,
  ctaLabel,
  tone = "info",
}: {
  headline: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
  tone?: "info" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/60"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/50"
        : "border-slate-200/80 bg-[#F8FAFC]";

  return (
    <div
      role="status"
      className={`mt-4 flex flex-col gap-3 rounded-xl border px-4 py-3 ring-1 ring-slate-900/[0.02] sm:flex-row sm:items-center sm:justify-between ${toneClass}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy-900">{headline}</p>
        <p className="mt-1 text-sm leading-6 text-text-muted">{detail}</p>
      </div>
      {href && ctaLabel ? (
        <Link
          href={href}
          className="hom-focusable inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#081426] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B1426]"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

/** Calm loading / processing copy — reduces uncertainty without polling. */
export function ProcessingNotice({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <p className="text-sm text-text-muted" aria-live="polite" role="status">
      <span className="font-medium text-navy-900">{label}</span>
      {hint ? <span className="mt-1 block text-xs leading-5">{hint}</span> : null}
    </p>
  );
}

/** Continuity footer — what you finished / what happens next. */
export function NextStepHint({
  finished,
  next,
  href,
  ctaLabel,
}: {
  finished: string;
  next: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <aside
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:p-5"
      aria-label="What happens next"
    >
      <p className="text-sm leading-6 text-slate-600">
        <span className="font-semibold text-navy-900">Just finished: </span>
        {finished}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        <span className="font-semibold text-navy-900">Next: </span>
        {next}
      </p>
      {href && ctaLabel ? (
        <Link
          href={href}
          className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {ctaLabel} →
        </Link>
      ) : null}
    </aside>
  );
}

/** Success state — what changed, where to find it, what next. */
export function SuccessNotice({
  title,
  whatChanged,
  whereToFind,
  whatNext,
  href,
  ctaLabel,
}: {
  title: string;
  whatChanged: string;
  whereToFind: string;
  whatNext: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 ring-1 ring-emerald-100 sm:p-5"
    >
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        <li>
          <span className="font-semibold text-navy-900">What changed: </span>
          {whatChanged}
        </li>
        <li>
          <span className="font-semibold text-navy-900">Where to find it: </span>
          {whereToFind}
        </li>
        <li>
          <span className="font-semibold text-navy-900">What to do next: </span>
          {whatNext}
        </li>
      </ul>
      {href && ctaLabel ? (
        <Link
          href={href}
          className="hom-focusable mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {ctaLabel} →
        </Link>
      ) : null}
    </div>
  );
}

/** Failure recovery — calm, work-preserving, no engineering internals. */
export function RecoveryNotice({
  title,
  whatHappened,
  workSafe,
  whatYouCanDo,
  whatYouCanIgnore,
  href,
  ctaLabel,
  onRetry,
}: {
  title: string;
  whatHappened: string;
  workSafe: string;
  whatYouCanDo: string;
  whatYouCanIgnore: string;
  href?: string;
  ctaLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 ring-1 ring-amber-100 sm:p-5"
    >
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        <li>
          <span className="font-semibold text-navy-900">What happened: </span>
          {whatHappened}
        </li>
        <li>
          <span className="font-semibold text-navy-900">Is your work safe? </span>
          {workSafe}
        </li>
        <li>
          <span className="font-semibold text-navy-900">What you can do: </span>
          {whatYouCanDo}
        </li>
        <li>
          <span className="font-semibold text-navy-900">What you can ignore: </span>
          {whatYouCanIgnore}
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-[#081426] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        ) : null}
        {href && ctaLabel ? (
          <Link
            href={href}
            className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Plain-language awareness chip (waiting / processing / caught up). */
export function AwarenessChip({
  label,
  detail,
  tone = "neutral",
}: {
  label: string;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "bg-growth-50 text-growth-700 ring-emerald-100"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : tone === "info"
          ? "bg-brand-50 text-brand-700 ring-brand-100"
          : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex min-h-11 flex-col justify-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${toneClass}`}
      title={detail}
    >
      <span>{label}</span>
      {detail ? <span className="sr-only">{detail}</span> : null}
    </span>
  );
}

/** Real timestamps only — omit when data is missing. */
export function TrustSignalList({
  signals,
}: {
  signals: Array<{ label: string; isoDate: string }>;
}) {
  if (signals.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted" aria-label="Trust signals">
      {signals.map((signal) => {
        const formatted = new Date(signal.isoDate).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        return (
          <li key={`${signal.label}-${signal.isoDate}`}>
            <span className="font-semibold text-navy-900">{signal.label}: </span>
            {formatted}
          </li>
        );
      })}
    </ul>
  );
}

/** Calm milestone celebration — not a distracting confetti moment. */
export function MilestoneNotice({
  title,
  detail,
  href,
  ctaLabel,
}: {
  title: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 ring-1 ring-brand-100 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Milestone</p>
      <p className="mt-2 text-sm font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">{detail}</p>
      {href && ctaLabel ? (
        <Link
          href={href}
          className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {ctaLabel} →
        </Link>
      ) : null}
    </div>
  );
}
