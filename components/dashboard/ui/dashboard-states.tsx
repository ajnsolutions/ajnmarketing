import Link from "next/link";

export type EmptyStateKind =
  | "no_data_yet"
  | "not_configured"
  | "no_activity"
  | "no_filter_results"
  | "source_unavailable"
  | "permission"
  | "stale"
  | "error";

const KIND_HINT: Record<EmptyStateKind, string> = {
  no_data_yet: "Nothing here yet — that can be normal for a new account.",
  not_configured: "A quick setup step is needed before this can fill in.",
  no_activity: "Configured and waiting — activity will show up here when it happens.",
  no_filter_results: "Nothing matches these filters. Try widening them.",
  source_unavailable: "An optional source was unavailable. Everything else can still be useful.",
  permission: "You may not have access to this information right now.",
  stale: "This view may be out of date. Refresh when you can.",
  error: "Something went wrong loading this section.",
};

export function DashboardEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  kind = "no_data_yet",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  kind?: EmptyStateKind;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-8 text-center ring-1 ring-slate-200/60 sm:px-8 sm:py-10">
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-text-muted">{description}</p>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">{KIND_HINT[kind]}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="hom-focusable mt-5 inline-flex min-h-11 items-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function PartialDataNotice({
  message = "Some optional sources were unavailable. What you see may be incomplete.",
}: {
  message?: string;
}) {
  return (
    <p
      role="status"
      className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-800 ring-1 ring-amber-100"
    >
      {message}
    </p>
  );
}

export function DashboardErrorState({
  title = "I couldn't complete that just now",
  description = "I'll try again shortly, or let you know if I need your help. Nothing is wrong on your side.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-100 bg-rose-50 px-5 py-10 text-center ring-1 ring-rose-100 sm:px-8"
    >
      <h3 className="text-base font-semibold text-rose-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-rose-600">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="hom-focusable mt-5 inline-flex rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function DashboardLoadingState({
  label = "Preparing your Head of Marketing briefing…",
}: {
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/[0.03]"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 motion-reduce:animate-none"
        aria-hidden
      />
      <p className="mt-4 text-sm font-medium text-text-muted">{label}</p>
    </div>
  );
}

export function DashboardLoadingSkeleton({
  label = "Preparing this week's briefing…",
}: {
  label?: string;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-slate-100 bg-white ring-1 ring-slate-900/[0.03] motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-slate-100 bg-white ring-1 ring-slate-900/[0.03] motion-reduce:animate-none" />
    </div>
  );
}
