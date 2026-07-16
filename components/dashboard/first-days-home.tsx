import Link from "next/link";
import type { FirstDaysHomeModel } from "@/lib/dashboard/first-days-home";

export function FirstDaysHome({ model }: { model: FirstDaysHomeModel }) {
  const completedCount = model.setupItems.filter((item) => item.complete).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          {model.greeting}
        </h1>
        <p className="mt-4 text-lg leading-8 text-navy-900">{model.lead}</p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          I&apos;m already learning your business and preparing your first marketing plan.
        </p>
      </header>

      <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Setup progress</h2>
            <p className="mt-1 text-sm text-text-muted">
              {completedCount} of {model.setupItems.length} underway or complete
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {model.setupItems.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.complete
                    ? "bg-growth-50 text-growth-600 ring-1 ring-emerald-100"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                }`}
                aria-hidden
              >
                {item.complete ? "✓" : "·"}
              </span>
              <span className="text-sm font-medium text-navy-900">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            Happening next
          </h3>
          <p className="mt-2 text-sm leading-7 text-navy-900">{model.happeningNext}</p>
        </div>

        <div className="mt-8">
          {model.primaryAction.kind === "none" ? (
            <div className="rounded-xl border border-emerald-200 bg-growth-50/60 px-5 py-4">
              <p className="text-base font-semibold text-navy-900">Nothing.</p>
              <p className="mt-1 text-sm leading-7 text-text-muted">
                Everything is underway. I&apos;ll let you know when I need you.
              </p>
            </div>
          ) : (
            <Link
              href={model.primaryAction.href}
              className="inline-flex rounded-full bg-[#081426] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
            >
              {model.primaryAction.label}
            </Link>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-sm text-text-muted">
        Prefer the full workspace?{" "}
        <Link
          href="/dashboard/command-center"
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Open Command Center
        </Link>
      </p>
    </div>
  );
}
