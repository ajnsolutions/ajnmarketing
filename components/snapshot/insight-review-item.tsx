"use client";

import { useState } from "react";
import { InsightDecisionTypes, type InsightDecisionType } from "@/lib/business-discovery/continuation/types";
import { DiscoveryConfidenceTiers } from "@/lib/business-discovery/types";
import { sourcePhrase } from "@/lib/snapshot-ui/confidenceLanguage";
import { trackSnapshotEvent } from "@/lib/snapshot-ui/analytics";
import type { DraftDecision, ReviewableInsight } from "@/lib/snapshot-ui/types";
import { ConfidenceBadge } from "@/components/snapshot/confidence-badge";
import { InsightCorrectionDialog } from "@/components/snapshot/insight-correction-dialog";

const DECISION_LABEL: Record<InsightDecisionType, string> = {
  [InsightDecisionTypes.CONFIRM]: "That's right",
  [InsightDecisionTypes.CORRECT]: "Let me correct it",
  [InsightDecisionTypes.REJECT]: "That's not right",
  [InsightDecisionTypes.REVIEW_LATER]: "Review later",
};

const DECISION_ACKNOWLEDGEMENT: Record<InsightDecisionType, string> = {
  [InsightDecisionTypes.CONFIRM]: "Got it — marked as confirmed.",
  [InsightDecisionTypes.CORRECT]: "Thanks — I'll use your correction.",
  [InsightDecisionTypes.REJECT]: "Understood — I won't treat this as a fact.",
  [InsightDecisionTypes.REVIEW_LATER]: "No problem — you can come back to this anytime.",
};

export function InsightReviewItem({
  insight,
  decision,
  onDecide,
  disabled = false,
}: {
  insight: ReviewableInsight;
  decision?: DraftDecision;
  onDecide: (decision: InsightDecisionType, correctedValue?: string, note?: string) => void;
  disabled?: boolean;
}) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);

  const source = sourcePhrase(insight.sources);
  const displayed = decision?.decision === InsightDecisionTypes.CORRECT ? decision.correctedValue : insight.displayValue;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight text-navy-900">{insight.label}</h3>
        <ConfidenceBadge tier={insight.confidenceTier} />
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        {displayed ?? "I couldn't determine this yet."}
        {decision?.decision === InsightDecisionTypes.CORRECT && (
          <span className="ml-2 text-xs font-semibold text-brand-600">(you corrected this)</span>
        )}
      </p>

      {insight.confidenceTier !== DiscoveryConfidenceTiers.MISSING && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              const next = !explanationOpen;
              setExplanationOpen(next);
              if (next) trackSnapshotEvent("explanation_opened", { insightKey: insight.key });
            }}
            aria-expanded={explanationOpen}
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {explanationOpen ? "Hide why I think this" : "Why I think this"}
          </button>
          {explanationOpen && (
            <p className="mt-2 rounded-xl bg-[#F8FAFC] p-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-100">
              {insight.reason}
              {source && <span className="block mt-1 text-xs text-slate-500">Based on {source}.</span>}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Review: ${insight.label}`}>
        {(
          [InsightDecisionTypes.CONFIRM, InsightDecisionTypes.CORRECT, InsightDecisionTypes.REJECT, InsightDecisionTypes.REVIEW_LATER] as const
        ).map((option) => {
          const selected = decision?.decision === option;
          const isMissing = insight.confidenceTier === DiscoveryConfidenceTiers.MISSING;
          if (isMissing && (option === InsightDecisionTypes.CONFIRM || option === InsightDecisionTypes.REJECT)) {
            // Nothing to confirm or reject on a Missing insight — we made no
            // claim at all, so "That's not right" reads as nonsensical here.
            // Only "Let me correct it" (tell us the answer) and "Review
            // later" make sense when the honest state is "I don't know yet."
            return null;
          }
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => {
                if (option === InsightDecisionTypes.CORRECT) {
                  setCorrectionOpen(true);
                  return;
                }
                onDecide(option);
              }}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {DECISION_LABEL[option]}
            </button>
          );
        })}
      </div>

      {decision && (
        <p role="status" className="mt-3 text-xs font-medium text-growth-500">
          {DECISION_ACKNOWLEDGEMENT[decision.decision]}
        </p>
      )}

      <InsightCorrectionDialog
        open={correctionOpen}
        label={insight.label}
        currentValue={insight.displayValue ?? ""}
        saving={false}
        onClose={() => setCorrectionOpen(false)}
        onSave={(correctedValue, note) => {
          onDecide(InsightDecisionTypes.CORRECT, correctedValue, note);
          setCorrectionOpen(false);
        }}
      />
    </article>
  );
}
