"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { confidenceExplanation, confidenceLabelText } from "@/lib/competitor-observations/confidenceLabels";
import {
  ObservationConfidenceFilters,
  buildWhatChangedItems,
  filterObservationsByConfidence,
  type ObservationConfidenceFilter,
  type WhatChangedItem,
} from "@/lib/competitor-observations/display";
import type { CompetitorObservation } from "@/lib/competitor-observations/types";
import { MarketRadarEntryKinds, type MarketRadarEntry } from "@/lib/market-radar/types";

const FILTER_OPTIONS: { value: ObservationConfidenceFilter; label: string }[] = [
  { value: ObservationConfidenceFilters.ALL, label: "All" },
  { value: ObservationConfidenceFilters.MEDIUM_AND_ABOVE, label: "Medium and up" },
  { value: ObservationConfidenceFilters.HIGH_ONLY, label: "High only" },
];

function formatOccurredAt(occurredAt: string | null): string | null {
  if (!occurredAt) return null;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;
  return `as of ${date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
}

function WhatChangedCard({ item }: { item: WhatChangedItem }) {
  const asOf = formatOccurredAt(item.occurredAt);

  return (
    <li className="border-b border-slate-100 pb-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-navy-900">{item.competitorName}</p>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {confidenceLabelText(item.confidence)}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-navy-900">{item.summary}</p>
      <p className="mt-2 text-xs text-text-muted">{confidenceExplanation(item.confidence)}</p>
      <p className="mt-2 text-xs text-text-muted">
        Source: {item.sourceLabel}
        {asOf ? ` · ${asOf}` : ""}
      </p>
    </li>
  );
}

export function BusinessPulsePage({
  observations,
  entries,
}: {
  observations: CompetitorObservation[];
  entries: MarketRadarEntry[];
}) {
  const [filter, setFilter] = useState<ObservationConfidenceFilter>(ObservationConfidenceFilters.ALL);
  const filtersId = useId();

  const trackedCompetitorCount = useMemo(
    () => entries.filter((entry) => entry.kind === MarketRadarEntryKinds.COMPETITOR).length,
    [entries],
  );

  const whatChangedItems = useMemo(() => buildWhatChangedItems(observations, entries), [observations, entries]);
  const filteredItems = useMemo(
    () => filterObservationsByConfidence(whatChangedItems, filter),
    [whatChangedItems, filter],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Business Pulse</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">What changed</h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          This is the first piece of Business Pulse: verified, source-backed changes among the competitors you&apos;re
          tracking in Market Radar. The fuller Business Pulse -- Marketing Health plus Growth Momentum, drawing on
          Customer Voice, Market Radar, and Seasonal Intelligence together -- is still being built.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">What Changed</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={filtersId}>
              <span id={filtersId} className="sr-only">
                Filter by confidence
              </span>
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                    filter === option.value
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Each entry links back to what we actually saw and how confident we are in it.
          </p>
        </div>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          {filteredItems.length > 0 ? (
            <ul className="space-y-4">
              {filteredItems.map((item) => (
                <WhatChangedCard key={item.id} item={item} />
              ))}
            </ul>
          ) : trackedCompetitorCount === 0 ? (
            <p className="text-sm text-text-muted">
              You aren&apos;t tracking any competitors yet.{" "}
              <Link
                href="/dashboard/market-radar"
                className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
              >
                Add one in Market Radar
              </Link>{" "}
              to start seeing what changes here.
            </p>
          ) : whatChangedItems.length === 0 ? (
            <p className="text-sm text-text-muted">
              No verified observations yet. As we notice real, source-backed changes among the competitors
              you&apos;re tracking, they&apos;ll show up here -- nothing to worry about, there simply isn&apos;t
              anything meaningful to report yet.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Nothing at this confidence level right now. Try widening the filter above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
