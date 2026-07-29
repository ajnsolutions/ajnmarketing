"use client";

import { useState } from "react";
import type { ConfirmationDecisionInput, InsightDecisionType, InsightKey } from "@/lib/business-discovery/continuation/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";
import { buildReviewableInsights, guidedReviewItems, remainingItems } from "@/lib/snapshot-ui/insightCatalog";
import { clearDraftDecisions, loadDraftDecisions, saveDraftDecisions } from "@/lib/snapshot-ui/decisionStorage";
import { trackSnapshotEvent } from "@/lib/snapshot-ui/analytics";
import type { DraftDecisionMap } from "@/lib/snapshot-ui/types";
import { InsightReviewItem } from "@/components/snapshot/insight-review-item";

/**
 * The authenticated review step — Part 9. This is where a visitor's
 * anonymous, pre-auth choices on /snapshot (stored only in sessionStorage,
 * see lib/snapshot-ui/decisionStorage.ts) actually become durable: nothing
 * they clicked before signing in was ever sent to a server. "Save my
 * answers" here is the one real, explicit, authenticated action — exactly
 * what Part 5/10 require ("No Assumed insight may become Known without an
 * explicit action").
 */
export function SnapshotReviewStep({
  snapshot,
  snapshotReference,
  onComplete,
}: {
  snapshot: PublicBusinessDiscoveryResultV1;
  snapshotReference: string;
  onComplete: () => void;
}) {
  const insights = buildReviewableInsights(snapshot);
  const guided = guidedReviewItems(insights);
  const remaining = remainingItems(insights);

  const [decisions, setDecisions] = useState<DraftDecisionMap>(() => loadDraftDecisions(snapshotReference));
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDecide(insightKey: InsightKey, decision: InsightDecisionType, correctedValue?: string, note?: string) {
    const next = { ...decisions, [insightKey]: { insightKey, decision, correctedValue, note } };
    setDecisions(next);
    saveDraftDecisions(snapshotReference, next);
  }

  async function handleSaveAndContinue() {
    const entries = Object.values(decisions).filter((decision): decision is NonNullable<typeof decision> => Boolean(decision));
    if (entries.length === 0) {
      onComplete();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: ConfirmationDecisionInput[] = entries.map((entry) => ({
        insightKey: entry.insightKey,
        decision: entry.decision,
        correctedValue: entry.correctedValue,
        note: entry.note,
      }));

      const response = await fetch("/api/business-discovery/continuation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotReference, decisions: payload }),
      });

      if (!response.ok) {
        setError("We couldn't save your answers just now. You can try again, or continue and come back later.");
        setSubmitting(false);
        return;
      }

      clearDraftDecisions(snapshotReference);
      trackSnapshotEvent("onboarding_review_completed");
      onComplete();
    } catch {
      setError("We couldn't save your answers just now. You can try again, or continue and come back later.");
      setSubmitting(false);
    }
  }

  function handleSkip() {
    trackSnapshotEvent("onboarding_review_completed");
    onComplete();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          I already learned this. Let&apos;s make sure I got it right.
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          From your free Snapshot — confirm, correct, or skip anything below. Nothing becomes a saved fact until you
          tell me it&apos;s right.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {guided.map((insight) => (
          <InsightReviewItem
            key={insight.key}
            insight={insight}
            decision={decisions[insight.key]}
            onDecide={(decision, correctedValue, note) => handleDecide(insight.key, decision, correctedValue, note)}
            disabled={submitting}
          />
        ))}
      </div>

      {remaining.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {expanded ? "Hide the rest" : "Review everything I learned"}
          </button>
          {expanded && (
            <div className="mt-4 space-y-4">
              {remaining.map((insight) => (
                <InsightReviewItem
                  key={insight.key}
                  insight={insight}
                  decision={decisions[insight.key]}
                  onDecide={(decision, correctedValue, note) => handleDecide(insight.key, decision, correctedValue, note)}
                  disabled={submitting}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className="min-h-11 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleSaveAndContinue}
          disabled={submitting}
          className="min-h-11 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save my answers & continue"}
        </button>
      </div>
    </div>
  );
}
