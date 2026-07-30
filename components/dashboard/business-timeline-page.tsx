import type { BusinessTimelineEntry, BusinessTimelineEntryType } from "@/lib/business-timeline/types";

const ENTRY_TYPE_LABELS: Record<BusinessTimelineEntryType, string> = {
  recommendation: "Recommendation",
  campaign: "Campaign",
  upload: "Document",
  search_milestone: "Search",
  customer_voice_milestone: "Customer Voice",
  learning_milestone: "Learning",
};

function TimelineEntryCard({ entry }: { entry: BusinessTimelineEntry }) {
  return (
    <article className="border-b border-slate-100 py-5 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">
        {ENTRY_TYPE_LABELS[entry.type]}
      </p>
      <p className="mt-1 text-sm leading-6 text-navy-900">{entry.whatChanged}</p>
      {entry.whatDidAILearn ? (
        <p className="mt-1 text-sm leading-6 text-text-muted">
          <span className="font-medium text-slate-600">What I learned. </span>
          {entry.whatDidAILearn}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-text-muted">
        {new Date(entry.occurredAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </article>
  );
}

/**
 * Business Timeline (Part 8) — customer-friendly chronological view across
 * recommendations, campaigns, uploads, search milestones, Customer Voice
 * milestones, and learning milestones. Every entry answers "what changed"
 * and, when genuinely applicable, "what did the AI learn."
 */
export function BusinessTimelinePage({ entries }: { entries: BusinessTimelineEntry[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Business Timeline
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Everything that&apos;s happened, in one place
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          A running history of recommendations, campaigns, uploads, and what the Business Brain has
          learned along the way.
        </p>
      </header>

      {entries.length > 0 ? (
        <section className="mt-8" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="sr-only">
            Timeline
          </h2>
          {entries.map((entry) => (
            <TimelineEntryCard key={entry.id} entry={entry} />
          ))}
        </section>
      ) : (
        <p className="mt-8 text-sm leading-7 text-text-muted">
          Nothing to show yet — as recommendations, campaigns, uploads, and learning happen, they&apos;ll
          appear here.
        </p>
      )}
    </div>
  );
}
