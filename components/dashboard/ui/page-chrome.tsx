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
