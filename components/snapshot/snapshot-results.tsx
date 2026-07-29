"use client";

import { useEffect, useState } from "react";
import type { InsightDecisionType, InsightKey } from "@/lib/business-discovery/continuation/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";
import { buildReviewableInsights, guidedReviewItems, remainingItems, topDiscoveries } from "@/lib/snapshot-ui/insightCatalog";
import type { DraftDecisionMap } from "@/lib/snapshot-ui/types";
import { trackSnapshotEvent } from "@/lib/snapshot-ui/analytics";
import { InsightReviewItem } from "@/components/snapshot/insight-review-item";
import { GrowthOpportunityCard } from "@/components/snapshot/growth-opportunity-card";

const MAX_GROWTH_OPPORTUNITIES = 3;

export function SnapshotResults({
  snapshot,
  decisions,
  onDecide,
  onContinue,
  onSignIn,
  partial = false,
}: {
  snapshot: PublicBusinessDiscoveryResultV1;
  decisions: DraftDecisionMap;
  onDecide: (insightKey: InsightKey, decision: InsightDecisionType, correctedValue?: string, note?: string) => void;
  onContinue: () => void;
  onSignIn: () => void;
  /** True when this Snapshot degraded gracefully (e.g. AI provider fallback) — shown honestly, never hidden. */
  partial?: boolean;
}) {
  const insights = buildReviewableInsights(snapshot);
  const discoveries = topDiscoveries(insights);
  const guided = guidedReviewItems(insights);
  const remaining = remainingItems(insights);
  const opportunities = (snapshot.possibleGrowthOpportunities.value ?? []).slice(0, MAX_GROWTH_OPPORTUNITIES);

  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [understoodChoice, setUnderstoodChoice] = useState<"yes" | "review" | null>(null);

  useEffect(() => {
    trackSnapshotEvent("result_section_viewed", { section: "overview" });
    if (partial) trackSnapshotEvent("partial_result_shown");
  }, [partial]);

  const businessLabel = snapshot.businessName?.trim() || "your business";

  return (
    <div className="space-y-10">
      {partial && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
          We learned part of your business, but one source took too long. Here&apos;s what we found so far — you can
          run a fresh Snapshot anytime for a fuller picture.
        </div>
      )}

      <section aria-labelledby="snapshot-summary-heading">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Your Snapshot</p>
        <h1 id="snapshot-summary-heading" className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Here&apos;s what I learned about {businessLabel}.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-text-muted">
          {snapshot.businessSummary.value ??
            "I couldn't find enough public information to summarize your business yet — that itself may be an opportunity."}
        </p>
        <p className="mt-3 text-sm text-text-muted">
          {snapshot.overallConfidence.label}. {snapshot.overallConfidence.explanation}
        </p>
      </section>

      {discoveries.length > 0 && (
        <section aria-labelledby="top-discoveries-heading">
          <h2 id="top-discoveries-heading" className="text-lg font-bold tracking-tight text-navy-900">
            What I noticed first
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {discoveries.map((insight) => (
              <div
                key={insight.key}
                className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{insight.label}</p>
                <p className="mt-2 text-sm leading-6 text-navy-900">
                  {insight.displayValue ?? "I couldn't determine this yet."}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {opportunities.length > 0 && (
        <section aria-labelledby="growth-opportunities-heading">
          <h2 id="growth-opportunities-heading" className="text-lg font-bold tracking-tight text-navy-900">
            Where growth may be hiding
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Possibilities worth a closer look — not guarantees, and nothing happens automatically.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {opportunities.map((notice, index) => (
              <GrowthOpportunityCard
                key={notice}
                notice={notice}
                reason={snapshot.possibleGrowthOpportunities.reason}
                highlightAsTop={index === 0}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="understood-heading" className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
        <h2 id="understood-heading" className="text-xl font-bold tracking-tight text-navy-900">
          Did I understand your business correctly?
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          A few things are still my best guess — you can confirm, correct, or skip anything below.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setUnderstoodChoice("yes")}
            className="min-h-11 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700"
          >
            Yes, that looks right
          </button>
          <button
            type="button"
            onClick={() => {
              setUnderstoodChoice("review");
              setReviewExpanded(true);
            }}
            className="min-h-11 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50"
          >
            Let me review the details
          </button>
        </div>
      </section>

      {understoodChoice && guided.length > 0 && (
        <section aria-labelledby="guided-review-heading">
          <h2 id="guided-review-heading" className="text-lg font-bold tracking-tight text-navy-900">
            Worth a quick double-check
          </h2>
          <div className="mt-4 space-y-4">
            {guided.map((insight) => (
              <InsightReviewItem
                key={insight.key}
                insight={insight}
                decision={decisions[insight.key]}
                onDecide={(decision, correctedValue, note) => onDecide(insight.key, decision, correctedValue, note)}
              />
            ))}
          </div>
        </section>
      )}

      {remaining.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setReviewExpanded((current) => !current)}
            aria-expanded={reviewExpanded}
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {reviewExpanded ? "Hide the rest" : "Review everything I learned"}
          </button>
          {reviewExpanded && (
            <div className="mt-4 space-y-4">
              {remaining.map((insight) => (
                <InsightReviewItem
                  key={insight.key}
                  insight={insight}
                  decision={decisions[insight.key]}
                  onDecide={(decision, correctedValue, note) => onDecide(insight.key, decision, correctedValue, note)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-navy-900/10 bg-[#081426] p-6 text-center sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          I can keep learning and turn this into a growth plan.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
          Nothing you&apos;ve reviewed here is saved yet. Create an account to keep it and pick up right where you
          left off — no repeating yourself.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-11 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/30 transition-colors hover:bg-brand-700"
          >
            Create My Growth Plan
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-11 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            I already have an account
          </button>
        </div>
      </section>
    </div>
  );
}
