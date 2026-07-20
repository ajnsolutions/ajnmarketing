"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ExecutiveBrief } from "@/lib/executive-briefing/types";
import { LastUpdatedIndicator, ReadOnlyNotice } from "@/components/dashboard/ui/page-chrome";

function ItemList({
  title,
  items,
  emphasizeFirst = false,
}: {
  title: string;
  items: { text: string }[];
  emphasizeFirst?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            key={item.text}
            className={
              emphasizeFirst && index === 0
                ? "text-sm font-medium leading-6 text-navy-900"
                : "text-sm leading-6 text-text-muted"
            }
          >
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Executive Brief card — scanable summary with expandable details.
 * Manual refresh only; no background schedule.
 */
export function ExecutiveBriefSection({ brief }: { brief: ExecutiveBrief }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [liveBrief, setLiveBrief] = useState(brief);

  function refresh() {
    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/executive-brief", { method: "POST" });
        if (!response.ok) {
          throw new Error("Could not refresh brief");
        }
        const data = (await response.json()) as { brief: ExecutiveBrief };
        setLiveBrief(data.brief);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  const topPriorities = liveBrief.topPriorities.slice(0, 3);
  const watchPreview = liveBrief.watchItems.slice(0, 2);

  return (
    <section
      className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="executive-brief-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Executive Brief
          </p>
          <h2
            id="executive-brief-heading"
            className="mt-2 text-xl font-bold tracking-tight text-navy-900 sm:text-2xl"
          >
            {liveBrief.headline}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{liveBrief.summary}</p>
          <div className="mt-2">
            <LastUpdatedIndicator isoDate={liveBrief.generatedAt} prefix="Last updated" />
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="hom-focusable min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {isPending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <ReadOnlyNotice>
        This is a summary of current priorities — not a full audit log and not a new recommendation
        engine.
      </ReadOnlyNotice>

      {error && (
        <p className="mt-3 text-sm text-amber-800" role="alert">
          {error}
        </p>
      )}

      {topPriorities.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <h3 className="text-sm font-semibold text-navy-900">Top priorities</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {topPriorities.map((item) => (
              <li key={item.text} className="text-sm leading-6 text-navy-900">
                {item.text}
              </li>
            ))}
          </ol>
          {watchPreview.length > 0 && (
            <div className="mt-4 border-t border-slate-200/80 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Watch items
              </p>
              <ul className="mt-2 space-y-1">
                {watchPreview.map((item) => (
                  <li key={item.text} className="text-sm leading-6 text-text-muted">
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <details className="group mt-5">
        <summary className="hom-focusable flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-brand-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span
            className="inline-block transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          Show full brief details
        </summary>
        <div className="hom-disclose-content mt-4 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <ItemList title="Today's priorities" items={liveBrief.topPriorities} emphasizeFirst />
          <ItemList title="Today" items={liveBrief.today} />
          <ItemList title="Wins" items={liveBrief.wins} />
          <ItemList title="Watch items" items={liveBrief.watchItems} />
          <ItemList title="Important changes" items={liveBrief.recentChanges} />
          <div className="sm:col-span-2">
            <h3 className="text-sm font-semibold text-navy-900">Supporting context</h3>
            <ul className="mt-2 space-y-2">
              {liveBrief.supportingEvidence.map((entry) => (
                <li key={`${entry.kind}:${entry.detail}`} className="text-sm leading-6 text-text-muted">
                  <span className="font-medium text-navy-900">{entry.label}:</span>{" "}
                  {entry.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
