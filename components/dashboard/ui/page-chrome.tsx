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
