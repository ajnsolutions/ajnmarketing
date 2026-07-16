import type { HeadOfMarketingJournal } from "@/lib/head-of-marketing/journalTypes";

export function HeadOfMarketingJournalSection({
  journal,
}: {
  journal: HeadOfMarketingJournal;
}) {
  return (
    <details className="mt-8 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm ring-1 ring-slate-900/[0.03] open:pb-6">
      <summary className="cursor-pointer list-none font-semibold text-navy-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          While you were busy
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Journal
          </span>
        </span>
      </summary>

      <p className="mt-4 text-sm leading-7 text-text-muted">{journal.intro}</p>

      <ol className="mt-6 space-y-6">
        {journal.entries.map((entry) => (
          <li key={`${entry.dayLabel}-${entry.category}`}>
            <p className="text-sm font-semibold text-navy-900">{entry.dayLabel}</p>
            <div className="mt-2 space-y-2">
              {entry.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-text-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {journal.closing && (
        <p className="mt-6 text-sm font-medium leading-7 text-navy-900">{journal.closing}</p>
      )}
    </details>
  );
}
