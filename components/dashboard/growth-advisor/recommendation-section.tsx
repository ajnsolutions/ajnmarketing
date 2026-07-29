"use client";

import { useState } from "react";
import { trackGrowthAdvisorEvent } from "@/lib/growth-advisor/clientAnalytics";
import type { GrowthAdvisorRecommendation } from "@/lib/growth-advisor/types";

/**
 * Exactly one recommendation — never a list. "Tell me more" reveals expected
 * impact, estimated effort, and why the advisor believes this, so the first
 * glance stays to a title and a single "why now" sentence (Progressive
 * Disclosure section of the sprint spec).
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

  if (dismissed) {
    return (
      <p className="text-sm leading-6 text-text-muted" role="status">
        Got it — I&apos;ll hold off on this for now.
      </p>
    );
  }

  return (
    <div>
      <p className="text-base font-semibold text-navy-900">{recommendation.title}</p>
      {recommendation.customerVoiceContext ? (
        <p className="mt-2 text-sm leading-7 text-navy-900">{recommendation.customerVoiceContext}</p>
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

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next) {
              trackGrowthAdvisorEvent("recommendation_expanded", { recommendationId: recommendationId ?? undefined });
              trackGrowthAdvisorEvent("tell_me_more", { section: "recommendation" });
            }
          }}
          aria-expanded={expanded}
          className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {expanded ? "Show less" : "Tell me more"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            trackGrowthAdvisorEvent("recommendation_dismissed", { recommendationId: recommendationId ?? undefined });
          }}
          className="hom-focusable text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Not now
        </button>
      </div>

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
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Expected impact</dt>
            <dd className="mt-1 text-sm leading-6 text-navy-900">{recommendation.expectedImpact}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estimated effort</dt>
            <dd className="mt-1 text-sm leading-6 text-navy-900">{recommendation.estimatedEffort}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Why I believe this</dt>
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
