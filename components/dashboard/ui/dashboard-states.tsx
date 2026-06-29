import Link from "next/link";

export function DashboardEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-10 text-center ring-1 ring-slate-200/60 sm:px-8">
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-text-muted">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function DashboardErrorState({
  title = "Something went wrong",
  description = "We couldn't load this section. Please try again in a moment.",
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
          className="mt-5 inline-flex rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function DashboardLoadingState({ label = "Loading dashboard..." }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/[0.03]"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      <p className="mt-4 text-sm font-medium text-text-muted">{label}</p>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-slate-100 bg-white ring-1 ring-slate-900/[0.03]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-slate-100 bg-white ring-1 ring-slate-900/[0.03]" />
    </div>
  );
}
