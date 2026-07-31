"use client";

import { useId, useMemo, useState } from "react";
import type { BusinessTimelineEntry, BusinessTimelineEntryType } from "@/lib/business-timeline/types";

const ENTRY_TYPE_LABELS: Record<BusinessTimelineEntryType, string> = {
  recommendation: "Recommendation",
  campaign: "Campaign",
  upload: "Document",
  search_milestone: "Search",
  customer_voice_milestone: "Customer Voice",
  learning_milestone: "Learning",
  opportunity_detected: "Opportunity",
  opportunity_completed: "Opportunity completed",
  opportunity_expired: "Opportunity expired",
  opportunity_learned_from: "Opportunity learned from",
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
 * Business Timeline (Part 8; readability improved in Project Magic Phase 2,
 * Part 5) — customer-friendly chronological view across recommendations,
 * campaigns, uploads, search milestones, Customer Voice milestones, and
 * learning milestones. A type filter lets a customer focus on one kind of
 * change at a time instead of scanning a long, undifferentiated list —
 * pure client-side filtering over the same entries, no new data fetch.
 */
export function BusinessTimelinePage({ entries }: { entries: BusinessTimelineEntry[] }) {
  const [filter, setFilter] = useState<"all" | BusinessTimelineEntryType>("all");
  const filtersId = useId();

  const typesPresent = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.type))),
    [entries],
  );

  const filteredEntries = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.type === filter)),
    [entries, filter],
  );

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
        <>
          {typesPresent.length > 1 ? (
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-labelledby={filtersId}>
              <span id={filtersId} className="sr-only">
                Filter timeline by type
              </span>
              <button
                type="button"
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
                className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                  filter === "all"
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                All
              </button>
              {typesPresent.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  aria-pressed={filter === type}
                  className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                    filter === type
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {ENTRY_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          ) : null}

          <section className="mt-4" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="sr-only">
              Timeline
            </h2>
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => <TimelineEntryCard key={entry.id} entry={entry} />)
            ) : (
              <p className="py-8 text-sm leading-7 text-text-muted">
                Nothing in this category yet.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="mt-8 text-sm leading-7 text-text-muted">
          Nothing to show yet — as recommendations, campaigns, uploads, and learning happen, they&apos;ll
          appear here.
        </p>
      )}
    </div>
  );
}
