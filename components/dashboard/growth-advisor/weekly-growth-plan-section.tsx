import { planTrustLabel } from "@/lib/growth-planner/trust";
import type { WeeklyGrowthPlanBundle } from "@/lib/growth-planner/types";

/**
 * Weekly Growth Plan — strategic plan card inside Growth Advisor.
 * Recommendations only; customer approves; never auto-executes.
 */
export function WeeklyGrowthPlanSection({
  bundle,
}: {
  bundle: WeeklyGrowthPlanBundle;
}) {
  const { plan, comparison, history } = bundle;
  const previous = comparison.previous;

  return (
    <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="weekly-growth-plan-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Weekly Growth Plan
      </p>
      <h2 id="weekly-growth-plan-heading" className="mt-2 text-lg font-bold text-navy-900">
        Primary objective: {plan.primaryObjective.label}
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        I recommend this plan for the week. You approve what we do — nothing runs automatically.
      </p>

      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Why now</dt>
          <dd className="mt-1 text-sm leading-6 text-navy-900">{plan.whyNow}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Expected impact
          </dt>
          <dd className="mt-1 text-sm leading-6 text-navy-900">{plan.expectedImpact}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Estimated effort
          </dt>
          <dd className="mt-1 text-sm leading-6 text-navy-900">{plan.estimatedEffort}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Success metric
          </dt>
          <dd className="mt-1 text-sm leading-6 text-navy-900">
            <span className="font-semibold">{plan.successMetric.label}</span>
            <span className="text-text-muted"> — {plan.successMetric.detail}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-navy-900">Supporting actions</h3>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Recommended only — review and approve each one before anything goes live.
        </p>
        <ul className="mt-3 space-y-3">
          {plan.supportingActions.map((action) => (
            <li key={action.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {planTrustLabel(action.certainty)}
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">{action.title}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{action.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-navy-900">What I&apos;ll watch</h3>
        {plan.whatIllWatch.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {plan.whatIllWatch.map((item) => (
              <li key={item.id}>
                <p className="text-sm font-semibold text-navy-900">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-text-muted">
            I&apos;ll keep learning quietly until there&apos;s something useful to watch together.
          </p>
        )}
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-navy-900">
          Why I believe this
        </summary>
        <div className="mt-3 space-y-3">
          {plan.explainability.confidenceLabelText ? (
            <p className="text-sm leading-6 text-text-muted">
              Confidence: {plan.explainability.confidenceLabelText}
            </p>
          ) : null}
          {plan.explainability.relatedGoals.length > 0 ? (
            <p className="text-sm leading-6 text-text-muted">
              Related goals: {plan.explainability.relatedGoals.join(" · ")}
            </p>
          ) : null}
          <ul className="space-y-2">
            {plan.evidence.map((item) => (
              <li key={item.id} className="text-sm leading-6 text-text-muted">
                <span className="font-semibold text-slate-600">
                  {planTrustLabel(item.certainty)}.
                </span>{" "}
                {item.statement}
              </li>
            ))}
          </ul>
          {plan.historicalContext.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                From past experience
              </p>
              <ul className="mt-2 space-y-2">
                {plan.historicalContext.map((item) => (
                  <li key={item.id} className="text-sm leading-6 text-text-muted">
                    <span className="font-semibold text-slate-600">
                      {planTrustLabel(item.certainty)}.
                    </span>{" "}
                    {item.statement}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Plan history
        </p>
        <p className="mt-2 text-sm leading-6 text-navy-900">{comparison.summary}</p>
        <p className="mt-1 text-xs text-text-muted">
          Generated {new Date(plan.generatedAt).toLocaleDateString()} · Status{" "}
          {plan.status.replace(/_/g, " ")}
          {plan.outcome ? ` · Outcome: ${plan.outcome}` : ""}
        </p>
        {previous ? (
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Last week: {previous.objectiveLabel} ({previous.status.replace(/_/g, " ")})
            {previous.outcome ? ` — ${previous.outcome}` : ""}
          </p>
        ) : null}
        {history.length > 2 ? (
          <p className="mt-2 text-xs text-text-muted">
            {history.length} weekly plans on record for comparison.
          </p>
        ) : null}
      </div>
    </section>
  );
}
