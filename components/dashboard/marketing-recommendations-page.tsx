"use client";

import { useMemo, useState } from "react";
import { MarketingRecommendationCard } from "@/components/dashboard/marketing-recommendation-card";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  filterRecommendationItems,
  type MarketingRecommendationsPageData,
  type RecommendationListFilter,
} from "@/lib/marketing-decisions/ui";

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

const FILTERS: Array<{ id: RecommendationListFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "manual", label: "Manual action" },
];

export function MarketingRecommendationsPage({
  data,
}: {
  data: MarketingRecommendationsPageData;
}) {
  const [filter, setFilter] = useState<RecommendationListFilter>("all");
  const visibleItems = useMemo(
    () => filterRecommendationItems(data.items, filter),
    [data.items, filter]
  );

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          What I&apos;d recommend
        </h1>
        <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
          Prioritized next steps for your business. When you&apos;re ready, I&apos;ll prepare a draft
          for your opinion before anything goes live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active ideas", value: String(data.summary.activeCount) },
          {
            label: "Ready for a draft",
            value: String(data.summary.readyForDraftCount),
          },
          {
            label: "Already in progress",
            value: String(data.summary.inProgressCount),
          },
          {
            label: "Highest priority",
            value: data.summary.highestPriorityTitle ?? "None yet",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]"
          >
            <p className="text-sm font-medium text-text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-bold tracking-tight text-navy-900">{item.value}</p>
          </article>
        ))}
      </div>

      <SectionCard
        title="Prioritized next steps"
        subtitle="Sorted by what matters most. Drafts wait for your opinion before anything goes live."
      >
        {data.items.length === 0 ? (
          <DashboardEmptyState
            title="Nothing to recommend yet"
            description="I'll surface ideas from your Google activity, reviews, and seasonal timing as soon as I have enough signal. In the meantime, your Weekly Briefing remains the calm place to check in."
            actionLabel="Your Head of Marketing"
            actionHref="/dashboard"
          />
        ) : (
          <div className="space-y-5">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter recommendations"
            >
              {FILTERS.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.id)}
                    className={
                      active
                        ? "rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition-colors hover:border-brand-300 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {visibleItems.length === 0 ? (
              <DashboardEmptyState
                title="Nothing in this filter"
                description="Try All to see every active recommendation, or switch to Ready to find items that can generate a draft."
              />
            ) : (
              <div className="grid gap-4">
                {visibleItems.map((item) => (
                  <MarketingRecommendationCard key={item.recommendation.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
