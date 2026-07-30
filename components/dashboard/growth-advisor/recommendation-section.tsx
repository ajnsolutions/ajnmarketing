"use client";

import { useState } from "react";
import { trackGrowthAdvisorEvent } from "@/lib/growth-advisor/clientAnalytics";
import type { GrowthAdvisorRecommendation } from "@/lib/growth-advisor/types";
import { trustLabel } from "@/lib/growth-advisor/trust";

/**
 * Exactly one recommendation — never a list. Progressive disclosure reveals
 * expected impact, supporting evidence, and why the advisor believes this.
 */
export function GrowthAdvisorRecommendationSection({
  recommendation,
  recommendationId,
}: {
  recommendation: GrowthAdvisorRecommendation;
  recommendationId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<"helped" | "not_useful" | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  async function sendFeedback(feedback: "helped" | "not_useful") {
    if (!recommendationId) return;
    setFeedbackError(null);
    try {
      const response = await fetch("/api/recommendation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, feedback }),
      });
      if (!response.ok) throw new Error("Could not save feedback");
      setFeedbackSent(feedback);
      trackGrowthAdvisorEvent(
        feedback === "helped" ? "recommendation_feedback_helped" : "recommendation_feedback_not_useful",
        { recommendationId },
      );
    } catch {
      setFeedbackError("Couldn't save your feedback — please try again.");
    }
  }

  if (dismissed) {
    return (
      <p className="text-sm leading-6 text-text-muted" role="status">
        Got it — I&apos;ll hold off on this for now.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {trustLabel(recommendation.certainty)}
      </p>
      <p className="mt-2 text-base font-semibold text-navy-900">{recommendation.title}</p>
      {recommendation.customerVoiceContext ? (
        <p className="mt-2 text-sm leading-7 text-navy-900">{recommendation.customerVoiceContext}</p>
      ) : null}
      {recommendation.historicalContext ? (
        <p className="mt-2 text-sm leading-7 text-navy-900">{recommendation.historicalContext}</p>
      ) : null}
      {recommendation.supportsGoal ? (
        <p className="mt-2 text-sm font-medium text-brand-700">
          This supports your goal of {recommendation.supportsGoal.toLowerCase()}.
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-7 text-slate-600">
        <span className="font-medium text-navy-900">Recommended next step. </span>
        {recommendation.whyNow}
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Expected impact
        </p>
        <p className="mt-1 text-sm leading-6 text-navy-900">{recommendation.expectedImpact}</p>
        {recommendation.expectedOutcomes.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {recommendation.expectedOutcomes.map((outcome) => (
              <li
                key={outcome}
                className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-100"
              >
                {outcome}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next) {
              trackGrowthAdvisorEvent("recommendation_expanded", {
                recommendationId: recommendationId ?? undefined,
              });
              trackGrowthAdvisorEvent("tell_me_more", { section: "recommendation" });
            }
          }}
          aria-expanded={expanded}
          className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {expanded ? "Show less" : "Why I believe this"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            trackGrowthAdvisorEvent("recommendation_dismissed", {
              recommendationId: recommendationId ?? undefined,
            });
          }}
          className="hom-focusable text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Not now
        </button>
      </div>

      {recommendationId ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {feedbackSent ? (
            <p className="text-sm text-text-muted" role="status">
              {feedbackSent === "helped" ? "Thanks — glad this helped." : "Thanks for letting me know."}
            </p>
          ) : (
            <>
              <span className="text-xs font-medium text-slate-500">Was this helpful?</span>
              <button
                type="button"
                onClick={() => void sendFeedback("helped")}
                className="hom-focusable text-sm font-medium text-slate-600 transition-colors hover:text-brand-700"
              >
                This helped
              </button>
              <button
                type="button"
                onClick={() => void sendFeedback("not_useful")}
                className="hom-focusable text-sm font-medium text-slate-600 transition-colors hover:text-brand-700"
              >
                Wasn&apos;t useful
              </button>
            </>
          )}
          {feedbackError ? (
            <p className="text-xs text-red-600" role="alert">
              {feedbackError}
            </p>
          ) : null}
        </div>
      ) : null}

      {expanded && (
        <dl className="hom-disclose-content mt-4 space-y-3 rounded-xl bg-[#F8FAFC] p-4 ring-1 ring-slate-100">
          {recommendation.whySupportsGoal ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Why this supports your goal
              </dt>
              <dd className="mt-1 text-sm leading-6 text-navy-900">{recommendation.whySupportsGoal}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Supporting evidence
            </dt>
            <dd className="mt-1">
              <ul className="space-y-1.5 text-sm leading-6 text-navy-900">
                {recommendation.supportingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Estimated effort
            </dt>
            <dd className="mt-1 text-sm leading-6 text-navy-900">{recommendation.estimatedEffort}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Why I believe this
            </dt>
            <dd className="mt-1 text-sm leading-6 text-navy-900">
              {recommendation.whyIBelieve}
              {recommendation.confidenceLabelText && (
                <span className="ml-2 text-xs font-semibold text-brand-600">
                  {recommendation.confidenceLabelText}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
