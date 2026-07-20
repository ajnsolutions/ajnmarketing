"use client";

import { useId, useState } from "react";
import type { CampaignDashboardCard } from "@/lib/campaign-intelligence/campaign-types";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import { campaignStatusLabel } from "@/lib/customer-ux/statusVocabulary";
import { ReadOnlyNotice } from "@/components/dashboard/ui/page-chrome";

function CampaignCard({ campaign }: { campaign: CampaignDashboardCard }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const headingId = useId();

  return (
    <article
      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-base font-semibold text-navy-900">
            {campaign.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-text-muted">{campaign.objective}</p>
        </div>
        <StatusBadge presentation={campaignStatusLabel(campaign.status)} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Next milestone
          </dt>
          <dd className="mt-1 text-navy-900">{campaign.nextMilestone ?? "All steps accounted for"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Completion
          </dt>
          <dd className="mt-1 text-navy-900">
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={campaign.completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${campaign.completionPercent}% complete`}
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${campaign.completionPercent}%` }}
              />
            </div>
            <span className="mt-1 inline-block text-sm text-text-muted">
              {campaign.completionPercent}%
            </span>
          </dd>
        </div>
      </dl>

      {campaign.recentProgress.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Recent progress
          </p>
          <ul className="mt-2 space-y-1">
            {campaign.recentProgress.map((line) => (
              <li key={line} className="text-sm leading-6 text-text-muted">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="hom-focusable mt-4 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide timeline" : "Show timeline"}
      </button>

      {expanded && (
        <ol
          id={panelId}
          className="hom-disclose-content mt-3 space-y-2 border-t border-slate-200/80 pt-3"
        >
          {campaign.timeline.map((step) => (
            <li
              key={step.key}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <span className="text-navy-900">{step.label}</span>
              <span className="text-xs text-text-muted">
                {campaignStatusLabel(step.status).label}
                {step.scheduledFor ? ` · ${step.scheduledFor}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function CampaignsSection({ campaigns }: { campaigns: CampaignDashboardCard[] }) {
  return (
    <section
      className="hom-disclose-content mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="campaigns-heading"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Campaigns</p>
      <h2 id="campaigns-heading" className="mt-2 text-xl font-bold text-navy-900">
        Active campaigns
      </h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">
        Execution plans organized from your Head of Marketing&apos;s strategy — not a second strategy
        engine.
      </p>
      <ReadOnlyNotice>
        Campaigns organize approved work. They do not invent priorities or publish on their own.
      </ReadOnlyNotice>

      {campaigns.length === 0 ? (
        <div className="mt-5">
          <DashboardEmptyState
            kind="no_activity"
            title="No active campaigns"
            description="When your Head of Marketing starts a campaign, it will show up here with a clear timeline and progress."
            actionLabel="See why the plan changed"
            actionHref="/dashboard/decision-intelligence"
          />
        </div>
      ) : (
        <ul className="mt-5 grid gap-4">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <CampaignCard campaign={campaign} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
