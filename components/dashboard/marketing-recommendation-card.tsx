"use client";

import { useId, useState } from "react";
import { MarketingRecommendationActions } from "@/components/dashboard/marketing-recommendation-actions";
import {
  formatDraftStatus,
  formatEffort,
  formatEvidenceEntries,
  formatImpact,
  formatRecommendedActionType,
  formatRecommendationStatus,
  formatUrgency,
  getManualNextStep,
  type RecommendationListItem,
} from "@/lib/marketing-decisions/ui";

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

function urgencyBadgeClass(urgency: RecommendationListItem["recommendation"]["urgency"]): string {
  switch (urgency) {
    case "critical":
    case "high":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "medium":
      return "bg-amber-50 text-amber-700 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function statusBadgeClass(status: RecommendationListItem["recommendation"]["status"]): string {
  switch (status) {
    case "in_progress":
      return "bg-brand-50 text-brand-700 ring-brand-100";
    case "open":
      return "bg-growth-50 text-growth-600 ring-emerald-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function MarketingRecommendationCard({ item }: { item: RecommendationListItem }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const { recommendation, opportunities, linkedDraft, draftAction } = item;

  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={urgencyBadgeClass(recommendation.urgency)}>
          {formatUrgency(recommendation.urgency)} priority
        </Badge>
        <Badge className={statusBadgeClass(recommendation.status)}>
          {formatRecommendationStatus(recommendation.status)}
        </Badge>
        <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
          {Math.round(recommendation.confidence)}% confidence
        </Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold text-navy-900 sm:text-lg">{item.title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        <span className="font-semibold text-navy-900">Why you&apos;re seeing this: </span>
        {recommendation.reasoning}
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-navy-900">Suggested action</dt>
          <dd className="mt-1 text-slate-600">
            {formatRecommendedActionType(recommendation.recommended_action_type)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Expected impact</dt>
          <dd className="mt-1 text-slate-600">{formatImpact(recommendation.business_impact)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Effort from you</dt>
          <dd className="mt-1 text-slate-600">{formatEffort(recommendation.estimated_effort)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">If you accept</dt>
          <dd className="mt-1 text-slate-600">
            I prepare a draft for your review. Approval still comes before publishing.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Related signals</dt>
          <dd className="mt-1 text-slate-600">
            {opportunities.length} related opportunit{opportunities.length === 1 ? "y" : "ies"}
          </dd>
        </div>
        {item.earliestExpiration && (
          <div>
            <dt className="font-semibold text-navy-900">Expires</dt>
            <dd className="mt-1 text-slate-600">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(item.earliestExpiration))}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-navy-900">Draft status</dt>
          <dd className="mt-1 text-slate-600">
            {formatDraftStatus(linkedDraft?.status)}
            {linkedDraft?.title ? ` · ${linkedDraft.title}` : ""}
          </dd>
        </div>
      </dl>

      {draftAction === "manual" && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-semibold">Manual action required</p>
          <p className="mt-1 leading-6">
            {getManualNextStep(recommendation.recommended_action_type)}
          </p>
        </div>
      )}

      <MarketingRecommendationActions
        recommendationId={recommendation.id}
        draftAction={draftAction}
        linkedDraftTitle={linkedDraft?.title}
      />

      <div className="mt-4 border-t border-slate-200/80 pt-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {expanded ? "Hide details" : "Why this recommendation"}
        </button>

        {expanded && (
          <div id={detailsId} className="mt-3 space-y-4 text-sm leading-7 text-slate-600">
            <p>{item.groupingExplanation}</p>

            {opportunities.length === 0 ? (
              <p>No related opportunity details are available for this suggestion.</p>
            ) : (
              <ul className="space-y-3">
                {opportunities.map((opportunity) => {
                  const evidenceEntries = formatEvidenceEntries(opportunity.evidence ?? {});
                  return (
                    <li
                      key={opportunity.id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <p className="font-semibold text-navy-900">{opportunity.title}</p>
                      <p className="mt-1">{opportunity.description}</p>
                      {opportunity.expires_at && (
                        <p className="mt-2 text-text-muted">
                          Expires{" "}
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(opportunity.expires_at))}
                        </p>
                      )}
                      {evidenceEntries.length > 0 && (
                        <ul className="mt-2 space-y-1 text-text-muted">
                          {evidenceEntries.map((entry) => (
                            <li key={`${opportunity.id}-${entry.label}`}>
                              <span className="font-medium text-navy-900 capitalize">
                                {entry.label}:
                              </span>{" "}
                              {entry.value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
