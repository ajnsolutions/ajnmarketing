export function DashboardSectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm ring-1 ring-slate-900/[0.03] sm:p-14">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
        Coming soon
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900">{title}</h1>
      <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-text-muted">
        This section is part of the AJN Marketing customer dashboard shell. Functionality
        will be added in a future release.
      </p>
    </div>
  );
}
