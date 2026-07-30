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
import type { CustomerVoiceHealthState } from "@/lib/customer-voice/health";

function healthPresentation(state: MarketingHealthState, label: string, message: string): CustomerStatusPresentation {
  const toneByState: Record<MarketingHealthState, CustomerStatusPresentation["tone"]> = {
    excellent: "success",
    healthy: "success",
    needs_attention: "warning",
    at_risk: "danger",
  };
  return { label, description: message, tone: toneByState[state] };
}

function customerVoiceHealthPresentation(
  state: CustomerVoiceHealthState,
  label: string,
  message: string,
): CustomerStatusPresentation {
  const toneByState: Record<CustomerVoiceHealthState, CustomerStatusPresentation["tone"]> = {
    healthy: "success",
    emerging_concerns: "warning",
    limited_feedback: "neutral",
    establishing_baseline: "neutral",
  };
  return { label: `Customer Voice · ${label}`, description: message, tone: toneByState[state] };
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
}: {
  briefing: HeadOfMarketingBriefing;
  customerVoiceHealth?: AdvisorSupporting["customerVoiceHealth"];
  knowledgeHealth?: AdvisorSupporting["knowledgeHealth"];
}) {
  const trustSignals = buildTrustSignals([
    { label: "Briefing generated", isoDate: briefing.executiveBrief.generatedAt },
    { label: "Profile since", isoDate: briefing.confidence.profileCreatedAt },
  ]);

  return (
    <div className="mt-12 space-y-8 border-t border-slate-100 pt-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting context</p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-100">
        <StatusBadge presentation={healthPresentation(briefing.health.state, briefing.health.label, briefing.health.message)} />
        <p className="text-sm leading-6 text-text-muted">{briefing.health.message}</p>
        <Link
          href="/dashboard/results"
          className="hom-focusable ml-auto text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          See performance trends →
        </Link>
      </div>

      {customerVoiceHealth ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-100">
          <StatusBadge
            presentation={customerVoiceHealthPresentation(
              customerVoiceHealth.state,
              customerVoiceHealth.label,
              customerVoiceHealth.message,
            )}
          />
          <p className="text-sm leading-6 text-text-muted">{customerVoiceHealth.message}</p>
          <Link
            href="/dashboard/customer-voice"
            className="hom-focusable ml-auto text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Open Customer Voice →
          </Link>
        </div>
      ) : null}

      {knowledgeHealth ? (
        <div className="rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              presentation={{
                label: `Business understanding · ${knowledgeHealth.overallScore}`,
                description: "How well we understand your business across every connected source.",
                tone:
                  knowledgeHealth.overallScore >= 70
                    ? "success"
                    : knowledgeHealth.overallScore >= 35
                      ? "warning"
                      : "neutral",
              }}
            />
          </div>
          {knowledgeHealth.missingKnowledge.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm leading-6 text-text-muted">
              {knowledgeHealth.missingKnowledge.slice(0, 3).map((gap) => (
                <li key={gap.label}>{gap.detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
