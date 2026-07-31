"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  EXECUTIVE_REVIEW_CADENCE_LABELS,
  ExecutiveReviewCadences,
  type ExecutiveReview,
  type ExecutiveReviewCadence,
} from "@/lib/head-of-marketing-orchestrator/types";

const CADENCE_ORDER: ExecutiveReviewCadence[] = [
  ExecutiveReviewCadences.TODAY,
  ExecutiveReviewCadences.THIS_WEEK,
  ExecutiveReviewCadences.THIS_MONTH,
];

function SummaryColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm leading-6 text-navy-900">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Head of Marketing Orchestrator's customer-facing surface — one daily
 * Executive Review, presented across Today / This Week / This Month. All
 * three cadences come from the SAME underlying review object (Part 7): only
 * the headline/summary framing swaps client-side, never a re-fetch.
 */
export function ExecutiveReviewPage({
  reviewsByCadence,
}: {
  reviewsByCadence: Record<ExecutiveReviewCadence, ExecutiveReview>;
}) {
  const [cadence, setCadence] = useState<ExecutiveReviewCadence>(ExecutiveReviewCadences.TODAY);
  const tabsId = useId();
  const review = reviewsByCadence[cadence];

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Executive Review</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">{review.headline}</h1>
        <p className="mt-3 text-base leading-7 text-text-muted">{review.summary}</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-labelledby={tabsId}>
        <span id={tabsId} className="sr-only">
          Choose a time horizon
        </span>
        {CADENCE_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCadence(option)}
            aria-pressed={cadence === option}
            className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
              cadence === option
                ? "bg-brand-600 text-white ring-brand-600"
                : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {EXECUTIVE_REVIEW_CADENCE_LABELS[option]}
          </button>
        ))}
      </div>

      {/* Part 2 — the single primary priority. */}
      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="primary-priority-heading">
        <h2 id="primary-priority-heading" className="text-lg font-bold text-navy-900">
          Today&apos;s single priority
        </h2>
        <article className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
          <p className="text-base font-semibold text-navy-900">{review.primaryPriority.title}</p>
          <p className="mt-2 text-sm leading-6 text-navy-900">{review.primaryPriority.whyNow}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Expected impact</dt>
              <dd className="mt-1 text-sm leading-6 text-navy-900">{review.primaryPriority.expectedImpact}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Estimated effort</dt>
              <dd className="mt-1 text-sm leading-6 text-navy-900">{review.primaryPriority.estimatedEffort}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">Risk of waiting. </span>
            {review.primaryPriority.riskOfWaiting}
          </p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">Why this one. </span>
            {review.primaryPriority.wonBecause}
          </p>
          {review.primaryPriority.confidenceLabel ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              <span className="font-medium text-slate-600">Confidence. </span>
              {review.primaryPriority.confidenceLabel}
            </p>
          ) : null}
        </article>
      </section>

      {/* Part 3 — up to 3 secondary priorities. Anything below the evidence
          bar simply never renders here. */}
      {review.secondaryPriorities.length > 0 ? (
        <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="secondary-priorities-heading">
          <h2 id="secondary-priorities-heading" className="text-lg font-bold text-navy-900">
            Also worth knowing about
          </h2>
          <ul className="mt-4 space-y-3">
            {review.secondaryPriorities.map((item) => (
              <li key={item.id} className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{item.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Part 4 — executive summary. */}
      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="executive-summary-heading">
        <h2 id="executive-summary-heading" className="text-lg font-bold text-navy-900">
          Executive summary
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <SummaryColumn title="What improved" items={review.executiveSummary.whatImproved} />
          <SummaryColumn title="What changed" items={review.executiveSummary.whatChanged} />
          <SummaryColumn title="What needs attention" items={review.executiveSummary.whatNeedsAttention} />
          <SummaryColumn title="What can wait" items={review.executiveSummary.whatCanWait} />
        </div>
      </section>

      {/* Part 5 — expandable decision explanation. */}
      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="decision-explanation-heading">
        <details className="group">
          <summary className="hom-focusable cursor-pointer list-none" id="decision-explanation-heading">
            <span className="inline-flex min-h-11 items-center gap-2 text-lg font-bold text-navy-900">
              Why am I seeing this?
              <span
                className="text-slate-400 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
                aria-hidden
              >
                ›
              </span>
            </span>
          </summary>
          <div className="hom-disclose-content mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Signals considered</p>
              <p className="mt-1 text-sm leading-6 text-navy-900">{review.decisionExplanation.signalsConsidered.join(", ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Evidence used</p>
              <ul className="mt-2 space-y-1.5">
                {review.decisionExplanation.evidenceUsed.map((item) => (
                  <li key={item.id} className="text-sm leading-6 text-navy-900">
                    {item.statement}
                  </li>
                ))}
              </ul>
            </div>
            {review.decisionExplanation.learningApplied.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Learning applied</p>
                <ul className="mt-2 space-y-1.5">
                  {review.decisionExplanation.learningApplied.map((item) => (
                    <li key={item.id} className="text-sm leading-6 text-navy-900">
                      {item.statement}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Confidence</p>
              <p className="mt-1 text-sm leading-6 text-navy-900">{review.decisionExplanation.confidence}</p>
            </div>
          </div>
        </details>
      </section>

      {/* Part 6 — action plan. */}
      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="action-plan-heading">
        <h2 id="action-plan-heading" className="text-lg font-bold text-navy-900">
          Action plan
        </h2>
        <ol className="mt-4 space-y-3">
          {review.actionPlan.steps.map((step, idx) => (
            <li key={step.id} className="rounded-xl border border-slate-100 bg-white p-4 ring-1 ring-slate-200/60">
              <p className="text-sm font-semibold text-navy-900">
                {idx + 1}. {step.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{step.detail}</p>
              {step.href ? (
                <Link
                  href={step.href}
                  className="hom-focusable mt-2 inline-flex text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  Open this →
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          <span className="font-medium text-slate-600">How we&apos;ll know it worked. </span>
          {review.actionPlan.successMetric}
        </p>
        {review.actionPlan.whatIllWatch.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {review.actionPlan.whatIllWatch.map((signal, idx) => (
              <li key={idx} className="text-sm leading-6 text-text-muted">
                {signal}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Part 9 — trust links. */}
      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="trust-links-heading">
        <h2 id="trust-links-heading" className="text-lg font-bold text-navy-900">
          See the evidence
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {review.trustLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="hom-focusable inline-flex min-h-11 items-center font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                {link.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm leading-7 text-text-muted">
        Return to{" "}
        <Link href="/dashboard" className="hom-focusable font-medium text-brand-600 hover:text-brand-700">
          Your Growth Advisor
        </Link>
        .
      </p>
    </div>
  );
}
