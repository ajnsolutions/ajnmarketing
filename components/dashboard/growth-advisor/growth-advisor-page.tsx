import { GrowthAdvisorPrimaryAction } from "@/components/dashboard/growth-advisor/primary-action";
import { GrowthAdvisorRecommendationSection } from "@/components/dashboard/growth-advisor/recommendation-section";
import { GrowthAdvisorSupportingContext } from "@/components/dashboard/growth-advisor/supporting-context";
import { GrowthAdvisorViewTracker } from "@/components/dashboard/growth-advisor/view-tracker";
import { PrimaryActionBar } from "@/components/dashboard/ui/page-chrome";
import type { GrowthAdvisorBriefing } from "@/lib/growth-advisor/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";

/**
 * Your Growth Advisor — the authenticated home experience.
 *
 * Conversational hierarchy (never reordered): greeting → what changed → what
 * I noticed → what I recommend → primary action → supporting context. See
 * docs/project-magic/GROWTH_ADVISOR.md for the full philosophy and the
 * reasoning behind dropping the previous page's separate confidence panel,
 * proactive-presence card, and executive-brief card — their job is now done
 * by this hierarchy directly, not by three additional cards above it.
 */
export function GrowthAdvisorPage({
  advisor,
  briefing,
}: {
  advisor: GrowthAdvisorBriefing;
  briefing: HeadOfMarketingBriefing;
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

      {/* What changed */}
      <section className="mt-6" aria-labelledby="what-changed-heading">
        <h2 id="what-changed-heading" className="sr-only">
          What changed
        </h2>
        {advisor.whatChanged.hasMeaningfulChange ? (
          <ul className="space-y-2">
            {advisor.whatChanged.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-base leading-7 text-navy-900">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base leading-7 text-navy-900">{advisor.whatChanged.items[0]}</p>
        )}
        {advisor.whatChanged.memoryLine && (
          <p className="mt-3 text-sm leading-7 text-text-muted">{advisor.whatChanged.memoryLine}</p>
        )}
      </section>

      {/* What I noticed */}
      {advisor.whatINoticed.length > 0 && (
        <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="what-i-noticed-heading">
          <h2 id="what-i-noticed-heading" className="text-lg font-bold text-navy-900">
            What I noticed
          </h2>
          <ul className="mt-4 space-y-4">
            {advisor.whatINoticed.map((observation) => (
              <li key={observation.headline}>
                <p className="text-sm font-semibold text-navy-900">{observation.headline}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{observation.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* What I recommend */}
      <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="what-i-recommend-heading">
        <h2 id="what-i-recommend-heading" className="text-lg font-bold text-navy-900">
          What I recommend
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

      {/* Primary action */}
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
                  Recommended next step
                </p>
                <p className="mt-1 text-base font-semibold text-navy-900">{advisor.primaryAction.label}</p>
                <p className="mt-1 text-sm text-text-muted">
                  After you click, you&apos;ll review the details and stay in control — nothing
                  publishes without your approval.
                </p>
              </div>
              <GrowthAdvisorPrimaryAction action={advisor.primaryAction} recommendationId={recommendationId} />
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
