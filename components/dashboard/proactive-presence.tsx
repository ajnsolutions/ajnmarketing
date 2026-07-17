import type { ProactivePresence } from "@/lib/head-of-marketing/proactiveTypes";

function purposeStyles(purpose: ProactivePresence["primary"]["purpose"]): string {
  switch (purpose) {
    case "celebrate":
      return "bg-growth-50 text-growth-700 ring-emerald-100";
    case "reassure":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "opportunity":
      return "bg-brand-50 text-brand-700 ring-brand-100";
    case "decision":
      return "bg-amber-50 text-amber-800 ring-amber-100";
  }
}

/**
 * Single primary proactive moment + progressive disclosure for celebrations / more updates.
 * Not a notification center.
 */
export function ProactivePresenceSection({ presence }: { presence: ProactivePresence }) {
  const hasMore =
    presence.celebrations.length > 0 || presence.moreUpdates.length > 0;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${purposeStyles(presence.primary.purpose)}`}
        >
          {presence.primary.label}
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          From your Head of Marketing
        </p>
      </div>
      <p className="mt-3 text-base leading-7 text-navy-900 sm:text-lg sm:leading-8">
        {presence.primary.message}
      </p>

      {hasMore && (
        <details className="mt-4 group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-600 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              More updates
              <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>

          {presence.celebrations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Worth celebrating
              </p>
              <ul className="mt-2 space-y-2">
                {presence.celebrations.map((item) => (
                  <li
                    key={item.message}
                    className="flex items-start gap-2 text-sm leading-6 text-navy-900"
                  >
                    <span className="mt-0.5 text-growth-600" aria-hidden>
                      ✓
                    </span>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {presence.moreUpdates.length > 0 && (
            <ul className="mt-4 space-y-2">
              {presence.moreUpdates.map((line) => (
                <li key={line} className="text-sm leading-6 text-text-muted">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
