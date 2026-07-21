import Link from "next/link";
import { missingRequiredSetupSteps } from "@/lib/customer-setup/progress";
import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";

/**
 * Shown when Head of Marketing cannot honestly load — never invents strategy.
 */
export function SetupHomReadinessPanel({ snapshot }: { snapshot: CustomerSetupSnapshot }) {
  const missing = missingRequiredSetupSteps(snapshot);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">
          A little more setup first
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-text-muted">
          I need a few basics before I can give you a trustworthy briefing. Nothing strategic is
          invented while setup is incomplete.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
        <h2 className="text-lg font-bold text-navy-900">What is still needed</h2>
        <p className="mt-2 text-sm text-text-muted">
          {snapshot.requiredComplete} of {snapshot.requiredTotal} required steps complete.
        </p>
        <ul className="mt-4 space-y-3">
          {missing.map((item) => (
            <li key={item.key} className="rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/70">
              <p className="font-semibold text-navy-900">{item.title}</p>
              <p className="mt-1 text-sm text-text-muted">{item.statusReason}</p>
              <Link
                href={item.href}
                className="hom-focusable mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Complete this step
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard/setup"
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open setup checklist
          </Link>
          <Link
            href="/dashboard/command-center"
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          >
            Browse Command Center
          </Link>
        </div>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          Optional steps like Google Business do not block this page once required foundation is
          complete.
        </p>
      </section>
    </div>
  );
}
