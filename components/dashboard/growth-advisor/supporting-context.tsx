import Link from "next/link";
import { AskHeadOfMarketingPanel } from "@/components/dashboard/ask-head-of-marketing";
import { CampaignsSection } from "@/components/dashboard/campaigns-section";
import { CustomerConfidencePanel } from "@/components/dashboard/customer-confidence";
import { ExecutiveBriefSection } from "@/components/dashboard/executive-brief-section";
import { ExperimentsSection } from "@/components/dashboard/experiments-section";
import { HeadOfMarketingJournalSection } from "@/components/dashboard/head-of-marketing-journal";
import { MonthlyFocusSection } from "@/components/dashboard/monthly-focus-section";
import { ProactivePresenceSection } from "@/components/dashboard/proactive-presence";
import { StrategicCalendarPreviewSection } from "@/components/dashboard/strategic-calendar-preview";
import { WhyPlanChangedSection } from "@/components/dashboard/why-plan-changed-section";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import type { CustomerStatusPresentation } from "@/lib/customer-ux/statusVocabulary";
import { buildTrustSignals } from "@/lib/customer-ux/trustPresentation";
import type { HeadOfMarketingBriefing, MarketingHealthState } from "@/lib/head-of-marketing/types";
import type { GrowthAdvisorSupportingContext as AdvisorSupporting } from "@/lib/growth-advisor/types";
import { buildMarketingHealthCoaching } from "@/lib/growth-advisor/marketingHealthCoaching";

function healthPresentation(state: MarketingHealthState, label: string, message: string): CustomerStatusPresentation {
  const toneByState: Record<MarketingHealthState, CustomerStatusPresentation["tone"]> = {
    excellent: "success",
    healthy: "success",
    needs_attention: "warning",
    at_risk: "danger",
  };
  return { label, description: message, tone: toneByState[state] };
}

/**
 * Everything that isn't the conversation: Marketing Health (one line, not a
 * hero), Customer Voice Health, recent activity, and secondary tools.
 * Positioned below the primary action, never competing with it.
 */
export function GrowthAdvisorSupportingContext({
  briefing,
  customerVoiceHealth,
  knowledgeHealth,
  learningMaturity,
}: {
  briefing: HeadOfMarketingBriefing;
  customerVoiceHealth?: AdvisorSupporting["customerVoiceHealth"];
  knowledgeHealth?: AdvisorSupporting["knowledgeHealth"];
  learningMaturity?: AdvisorSupporting["learningMaturity"];
}) {
  const trustSignals = buildTrustSignals([
    { label: "Briefing generated", isoDate: briefing.executiveBrief.generatedAt },
    { label: "Profile since", isoDate: briefing.confidence.profileCreatedAt },
  ]);

  const coaching = buildMarketingHealthCoaching({
    health: briefing.health,
    primaryAction: briefing.primaryAction,
    customerVoiceHealth,
    knowledgeHealth,
    learningMaturity,
  });

  return (
    <div className="mt-12 space-y-8 border-t border-slate-100 pt-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting context</p>

      {/* Marketing Health — one coaching card, not four disconnected score
          badges. Explains what the score means, why it matters, the next
          best action, and what improves next. */}
      <div className="rounded-xl bg-[#F8FAFC] px-4 py-4 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge presentation={healthPresentation(briefing.health.state, coaching.label, coaching.whatItMeans)} />
          <Link
            href="/dashboard/results"
            className="hom-focusable ml-auto text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            See performance trends →
          </Link>
        </div>
        <p className="mt-3 text-sm leading-6 text-navy-900">{coaching.whatItMeans}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          <span className="font-medium text-slate-600">Why it matters. </span>
          {coaching.whyItMatters}
        </p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          <span className="font-medium text-slate-600">What improves next. </span>
          {coaching.expectedImprovement}
        </p>
        {coaching.nextBestAction ? (
          <Link
            href={coaching.nextBestAction.href}
            className="hom-focusable mt-3 inline-flex text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {coaching.nextBestAction.label} →
          </Link>
        ) : null}

        {coaching.supportingScores.length > 0 ? (
          <details className="group mt-4">
            <summary className="hom-focusable cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex min-h-11 items-center gap-2">
                What&apos;s behind this
                <span
                  className="text-slate-400 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
                >
                  ›
                </span>
              </span>
            </summary>
            <ul className="hom-disclose-content mt-2 space-y-2">
              {coaching.supportingScores.map((supporting) => (
                <li key={supporting.key} className="text-sm leading-6 text-text-muted">
                  <span className="font-medium text-slate-600">
                    {supporting.label}
                    {supporting.score >= 0 ? ` · ${supporting.score}` : ""}.{" "}
                  </span>
                  {supporting.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <CustomerConfidencePanel
        facts={{
          thisWeek: briefing.thisWeek,
          celebrations: briefing.proactive.celebrations.map((item) => item.message),
          pendingApprovals: briefing.confidence.pendingApprovals,
          publishFailures: briefing.confidence.publishFailures,
          openRecommendations: briefing.confidence.openRecommendations,
          publishingReady: briefing.confidence.publishingReadyOrScheduled,
          primaryActionKind: briefing.primaryAction.kind,
          primaryActionLabel: briefing.primaryAction.label,
          primaryActionHref: briefing.primaryAction.href,
          hasBusinessProfile: Boolean(briefing.businessName && briefing.businessName !== "your business"),
          hasMarketingPlan: briefing.confidence.hasMarketingPlan,
          hasPublishedContent: briefing.confidence.weeklyPublishedPosts > 0,
          hasGoogleSync: briefing.confidence.gbpConnected,
          hasCompletedRecommendation: briefing.experiments.completed.length > 0,
          trustSignals,
        }}
      />

      <ProactivePresenceSection presence={briefing.proactive} />
      <ExecutiveBriefSection brief={briefing.executiveBrief} />
      <WhyPlanChangedSection preview={briefing.whyPlanChanged} />
      <StrategicCalendarPreviewSection preview={briefing.calendarPreview} />
      <CampaignsSection campaigns={briefing.campaigns} />
      <ExperimentsSection
        pendingProposals={briefing.experiments.pendingProposals}
        active={briefing.experiments.active}
        completed={briefing.experiments.completed}
      />

      <AskHeadOfMarketingPanel />

      <MonthlyFocusSection focus={briefing.monthlyFocus} />

      <HeadOfMarketingJournalSection journal={briefing.journal} />

      <details className="group rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-sm shadow-sm ring-1 ring-slate-900/[0.03]">
        <summary className="hom-focusable cursor-pointer list-none font-semibold text-navy-900 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-11 items-center gap-2">
            More tools
            <span
              className="text-slate-400 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden
            >
              ›
            </span>
          </span>
        </summary>
        <div className="hom-disclose-content">
          <p className="mt-2 text-text-muted">
            Your Growth Advisor is the main place to decide. Tools below still work — they stay out
            of the way so you have one calm place to start.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { href: "/dashboard/approvals", label: "This Week — needs your opinion" },
              { href: "/dashboard/publishing", label: "Preparing for publication" },
              { href: "/dashboard/setup", label: "Setup checklist" },
              { href: "/dashboard/decision-intelligence", label: "Why the plan changed" },
              { href: "/dashboard/strategic-marketing-calendar", label: "Strategic calendar" },
              { href: "/dashboard/marketing-recommendations", label: "What I'd recommend next" },
              { href: "/dashboard/customer-voice", label: "Customer Voice" },
              { href: "/dashboard/testimonials", label: "Website Testimonials" },
              { href: "/dashboard/business-timeline", label: "Business Timeline" },
              { href: "/dashboard/tasks", label: "What I'm working on" },
              { href: "/dashboard/google-business-profile", label: "Google Profile" },
              { href: "/dashboard/command-center", label: "Detailed workspace (advanced)" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hom-focusable inline-flex min-h-11 items-center font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
