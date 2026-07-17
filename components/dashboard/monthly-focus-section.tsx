import type { MonthlyFocus } from "@/lib/head-of-marketing/monthlyFocusTypes";

export function MonthlyFocusSection({ focus }: { focus: MonthlyFocus }) {
  return (
    <section className="hom-disclose-content mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
        What we&apos;re working toward
      </p>
      <h2 className="mt-2 text-xl font-bold text-navy-900">{focus.title}</h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">{focus.intro}</p>

      <ul className="mt-5 space-y-3">
        {focus.priorities.map((priority) => (
          <li key={priority.label} className="flex items-start gap-3 text-sm leading-6 text-navy-900">
            <span className="mt-0.5 text-growth-600" aria-hidden>
              ✓
            </span>
            <span>
              <span className="font-medium">{priority.label}</span>
              {priority.why && (
                <span className="mt-1 block text-text-muted">{priority.why}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm font-medium leading-7 text-navy-900">{focus.reinforcement}</p>
      <p className="mt-2 text-sm leading-7 text-text-muted">{focus.successLooksLike}</p>
      {focus.magicMoment && (
        <p className="mt-4 text-sm leading-7 text-text-muted">{focus.magicMoment}</p>
      )}
    </section>
  );
}
