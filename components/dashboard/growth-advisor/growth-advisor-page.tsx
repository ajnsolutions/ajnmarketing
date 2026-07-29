import { GrowthAdvisorPrimaryAction } from "@/components/dashboard/growth-advisor/primary-action";
import { GrowthAdvisorRecommendationSection } from "@/components/dashboard/growth-advisor/recommendation-section";
import { GrowthAdvisorSupportingContext } from "@/components/dashboard/growth-advisor/supporting-context";
import { GrowthAdvisorViewTracker } from "@/components/dashboard/growth-advisor/view-tracker";
import { GrowthAdvisorSetupProgress } from "@/components/dashboard/growth-advisor/setup-progress-section";
import { WeeklyGrowthPlanSection } from "@/components/dashboard/growth-advisor/weekly-growth-plan-section";
import { PrimaryActionBar } from "@/components/dashboard/ui/page-chrome";
import type { GrowthAdvisorBriefing } from "@/lib/growth-advisor/types";
import type { WeeklyGrowthPlanBundle } from "@/lib/growth-planner/types";
import type { GuidedSetupExperience } from "@/lib/guided-setup/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { trustLabel } from "@/lib/growth-advisor/trust";

/**
 * Your Growth Advisor — conversational weekly meeting experience.
 *
 * Flow: This Week → Setup progress (when learning) → What I Noticed →
 * Weekly Growth Plan → Recommendation → Next Week → One Action.
 */
export function GrowthAdvisorPage({
  advisor,
  briefing,
  weeklyPlan,
  guidedSetup,
}: {
  advisor: GrowthAdvisorBriefing;
  briefing: HeadOfMarketingBriefing;
  weeklyPlan?: WeeklyGrowthPlanBundle | null;
  guidedSetup?: GuidedSetupExperience | null;
}) {
  const recommendationId = briefing.topRecommendationDetail?.recommendationId ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <GrowthAdvisorViewTracker />
      <a href="#growth-advisor-primary-action" className="hom-skip-link">
        Skip to next action
      </a>

      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Growth Advisor
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          {advisor.greeting}
        </h1>
      </header>

      {/* This Week */}
      <section className="mt-8" aria-labelledby="this-week-heading">
        <h2 id="this-week-heading" className="text-lg font-bold text-navy-900">
          This week
        </h2>
        {advisor.whatChanged.hasMeaningfulChange ? (
          <ul className="mt-3 space-y-2">
            {advisor.whatChanged.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-base leading-7 text-navy-900">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base leading-7 text-navy-900">{advisor.whatChanged.items[0]}</p>
        )}
        {advisor.whatChanged.memoryLine && (
          <p className="mt-3 text-sm leading-7 text-text-muted">{advisor.whatChanged.memoryLine}</p>
        )}
      </section>

      {guidedSetup ? <GrowthAdvisorSetupProgress experience={guidedSetup} /> : null}

      {/* What I noticed */}
      <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="what-i-noticed-heading">
        <h2 id="what-i-noticed-heading" className="text-lg font-bold text-navy-900">
          What I noticed
        </h2>
        {advisor.whatINoticed.length > 0 ? (
          <ul className="mt-4 space-y-5">
            {advisor.whatINoticed.map((observation) => (
              <li key={observation.headline}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {trustLabel(observation.certainty)}
                </p>
                <p className="mt-1 text-sm font-semibold text-navy-900">{observation.headline}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  <span className="font-medium text-slate-600">Why it matters. </span>
                  {observation.whyItMatters}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-7 text-text-muted">
            I don&apos;t have enough grounded signals yet to share observations — I&apos;ll keep
            learning rather than inventing insights.
          </p>
        )}
      </section>

      {/* Learning / empty state */}
      {advisor.learning.isLearning ? (
        <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="still-learning-heading">
          <h2 id="still-learning-heading" className="text-lg font-bold text-navy-900">
            What I&apos;m still learning
          </h2>
          {advisor.learning.message ? (
            <p className="mt-3 text-sm leading-7 text-slate-600">{advisor.learning.message}</p>
          ) : null}
          {advisor.learning.improvementSuggestions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {advisor.learning.improvementSuggestions.map((suggestion) => (
                <li key={suggestion} className="text-sm leading-6 text-text-muted">
                  {suggestion}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* Progress toward goals + strategic focus */}
      <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="goal-progress-heading">
        <h2 id="goal-progress-heading" className="text-lg font-bold text-navy-900">
          Progress toward goals
        </h2>
        {advisor.goalProgress.strategicFocus ? (
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Strategic focus:{" "}
            <span className="font-semibold text-navy-900">{advisor.goalProgress.strategicFocus}</span>
          </p>
        ) : null}
        {advisor.goalProgress.emptyDetail ? (
          <p className="mt-3 text-sm leading-7 text-text-muted">{advisor.goalProgress.emptyDetail}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {advisor.goalProgress.items.slice(0, 3).map((item) => (
              <li key={item.goalKey}>
                <p className="text-sm font-semibold text-navy-900">
                  {item.label}
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {item.state.replace(/_/g, " ")}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {weeklyPlan ? <WeeklyGrowthPlanSection bundle={weeklyPlan} /> : null}

      {/* Recommendation */}
      <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="what-i-recommend-heading">
        <h2 id="what-i-recommend-heading" className="text-lg font-bold text-navy-900">
          Recommendation
        </h2>
        <div className="mt-4">
          {advisor.recommendation ? (
            <GrowthAdvisorRecommendationSection
              recommendation={advisor.recommendation}
              recommendationId={recommendationId}
            />
          ) : (
            <p className="text-sm leading-7 text-text-muted">
              Nothing urgent right now — I&apos;ll let you know as soon as something worth your
              attention comes up.
            </p>
          )}
        </div>
      </section>

      {/* Next week */}
      <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="next-week-heading">
        <h2 id="next-week-heading" className="text-lg font-bold text-navy-900">
          Next week
        </h2>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          Here&apos;s what I expect to monitor as we continue.
        </p>
        {advisor.nextWeek.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {advisor.nextWeek.map((item) => (
              <li key={item.id}>
                <p className="text-sm font-semibold text-navy-900">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-7 text-text-muted">
            I&apos;ll keep learning quietly in the background until there&apos;s something useful
            to watch together.
          </p>
        )}
      </section>

      {/* One primary action */}
      <div id="growth-advisor-primary-action">
        <PrimaryActionBar>
          {advisor.primaryActionIsReassurance ? (
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-navy-900">Everything looks great.</p>
              <p className="mt-1 text-sm leading-7 text-text-muted">
                No urgent decision needed. I&apos;ll let you know if anything changes.
              </p>
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  One action
                </p>
                <p className="mt-1 text-base font-semibold text-navy-900">{advisor.primaryAction.label}</p>
                <p className="mt-1 text-sm text-text-muted">
                  After you click, you&apos;ll review the details and stay in control — nothing
                  publishes without your approval.
                </p>
              </div>
              <GrowthAdvisorPrimaryAction
                action={advisor.primaryAction}
                recommendationId={recommendationId}
              />
            </>
          )}
        </PrimaryActionBar>
      </div>

      <GrowthAdvisorSupportingContext
        briefing={briefing}
        customerVoiceHealth={advisor.supporting.customerVoiceHealth}
      />
    </div>
  );
}
