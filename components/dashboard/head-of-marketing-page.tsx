import Link from "next/link";
import { AskHeadOfMarketingPanel } from "@/components/dashboard/ask-head-of-marketing";
import { CampaignsSection } from "@/components/dashboard/campaigns-section";
import { ExperimentsSection } from "@/components/dashboard/experiments-section";
import { ExecutiveBriefSection } from "@/components/dashboard/executive-brief-section";
import { HeadOfMarketingJournalSection } from "@/components/dashboard/head-of-marketing-journal";
import { MonthlyFocusSection } from "@/components/dashboard/monthly-focus-section";
import { ProactivePresenceSection } from "@/components/dashboard/proactive-presence";
import { StrategicCalendarPreviewSection } from "@/components/dashboard/strategic-calendar-preview";
import { WhyPlanChangedSection } from "@/components/dashboard/why-plan-changed-section";
import { PrimaryActionBar } from "@/components/dashboard/ui/page-chrome";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import type { CustomerStatusPresentation } from "@/lib/customer-ux/statusVocabulary";

function healthPresentation(briefing: HeadOfMarketingBriefing): CustomerStatusPresentation {
  const toneByState: Record<MarketingHealthState, CustomerStatusPresentation["tone"]> = {
    excellent: "success",
    healthy: "success",
    needs_attention: "warning",
    at_risk: "danger",
  };
  return {
    label: briefing.health.label,
    description: briefing.health.message,
    tone: toneByState[briefing.health.state],
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * Head of Marketing — primary strategic customer surface.
 * Hierarchy: summary → next action → why it changed → calendar → execution → ask → history.
 */
export function HeadOfMarketingPage({ briefing }: { briefing: HeadOfMarketingBriefing }) {
  return (
    <div className="mx-auto max-w-3xl">
      <a href="#hom-primary-action" className="hom-skip-link">
        Skip to next action
      </a>

      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing · {briefing.experienceTitle}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            {briefing.greeting}
          </h1>
          <StatusBadge presentation={healthPresentation(briefing)} />
        </div>
        <p className="mt-4 text-sm leading-7 text-text-muted">
          This is your home base. Start with the next step below — everything else stays available
          when you want more detail.
        </p>
        {briefing.relationshipMemory && (
          <p className="mt-3 text-sm leading-7 text-text-muted">{briefing.relationshipMemory}</p>
        )}
      </header>

      {/* 1. Executive summary / current priorities */}
      <ProactivePresenceSection presence={briefing.proactive} />
      <ExecutiveBriefSection brief={briefing.executiveBrief} />

      {/* 2. Primary next actions — above the fold, before history */}
      <div id="hom-primary-action">
        <PrimaryActionBar>
          {briefing.primaryAction.kind === "none" ? (
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-navy-900">
                {briefing.magicMoment ?? "Everything looks great."}
              </p>
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
                <p className="mt-1 text-base font-semibold text-navy-900">
                  {briefing.primaryAction.label}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  After you click, you&apos;ll review the details and stay in control — nothing
                  publishes without your approval.
                </p>
                {briefing.magicMoment && (
                  <p className="mt-1 text-sm text-text-muted">{briefing.magicMoment}</p>
                )}
              </div>
              <Link
                href={briefing.primaryAction.href}
                className="hom-focusable motion-safe-lift inline-flex min-h-11 items-center justify-center rounded-full bg-[#081426] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
              >
                {briefing.primaryAction.label}
              </Link>
            </>
          )}
        </PrimaryActionBar>
      </div>

      {/* 3. Why the Plan Changed */}
      <WhyPlanChangedSection preview={briefing.whyPlanChanged} />

      {/* 4. Strategic Calendar preview */}
      <StrategicCalendarPreviewSection preview={briefing.calendarPreview} />

      {/* 5–6. Execution: Campaigns then Experiments */}
      <CampaignsSection campaigns={briefing.campaigns} />
      <ExperimentsSection
        pendingProposals={briefing.experiments.pendingProposals}
        active={briefing.experiments.active}
        completed={briefing.experiments.completed}
      />

      {/* 7. Ask Your Head of Marketing */}
      <AskHeadOfMarketingPanel />

      {/* 8. Supporting detail / historical */}
      <MonthlyFocusSection focus={briefing.monthlyFocus} />

      <details className="group mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6">
        <summary className="hom-focusable cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-11 flex-col justify-center gap-1">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
              Supporting detail
            </span>
            <span className="text-sm leading-6 text-text-muted">
              Optional context for this week — open when you want the full picture.
            </span>
          </span>
        </summary>
        <div className="hom-disclose-content mt-4">
          <Section title="What I handled">
            <ul className="space-y-3">
              {briefing.thisWeek.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-navy-900">
                  <span className="mt-0.5 text-growth-600" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What I noticed">
            <ul className="space-y-3">
              {briefing.noticed.map((item) => (
                <li key={item} className="text-sm leading-6 text-text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {briefing.recommendation && (
            <Section title="What I'd recommend next">
              <p className="text-base font-semibold text-navy-900">
                {briefing.recommendation.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                Why it matters: {briefing.recommendation.why}
              </p>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                Expected benefit: {briefing.recommendation.expectedBenefit}
              </p>
            </Section>
          )}

          <Section title="Marketing Health">
            <p className="text-base font-semibold text-navy-900">{briefing.health.label}</p>
            <p className="mt-2 text-sm leading-7 text-text-muted">{briefing.health.message}</p>
            <p className="mt-2 text-sm leading-7 text-text-muted">{briefing.health.reason}</p>
          </Section>

          <Section title="Next Week">
            <p className="mb-3 text-sm text-text-muted">Here&apos;s what I&apos;ll be working on.</p>
            <ul className="space-y-3">
              {briefing.nextWeek.map((item) => (
                <li key={item} className="text-sm leading-6 text-navy-900">
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-navy-900">
              Estimated review time: {briefing.timeRespectLabel}.
            </p>
          </div>
        </div>
      </details>

      <HeadOfMarketingJournalSection journal={briefing.journal} />

      <details className="group mt-8 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-sm shadow-sm ring-1 ring-slate-900/[0.03]">
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
            Your Head of Marketing is the main place to decide. Tools below still work — they stay
            out of the way so you have one calm place to start.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { href: "/dashboard/approvals", label: "This Week — needs your opinion" },
              { href: "/dashboard/publishing", label: "Preparing for publication" },
              { href: "/dashboard/setup", label: "Setup checklist" },
              { href: "/dashboard/decision-intelligence", label: "Why the plan changed" },
              { href: "/dashboard/strategic-marketing-calendar", label: "Strategic calendar" },
              { href: "/dashboard/marketing-recommendations", label: "What I'd recommend next" },
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
