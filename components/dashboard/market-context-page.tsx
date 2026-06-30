import {
  formatMarketContextCategory,
  formatMarketContextDate,
  formatMarketContextStatus,
  formatMarketContextWeekLabel,
} from "@/lib/market-context/persistence";
import {
  getContextSignalSourceLabel,
  getContextSignalSourceStyles,
} from "@/lib/market-context/signal-source";
import type { MarketContextPageData } from "@/lib/market-context/types";
import { MarketContextRefreshButton } from "@/components/dashboard/market-context-actions";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Active"
      ? "bg-growth-50 text-growth-500 ring-emerald-100"
      : status === "Generating"
        ? "bg-brand-50 text-brand-600 ring-brand-100"
        : status === "Failed"
          ? "bg-rose-50 text-rose-600 ring-rose-100"
          : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function MarketContextPage({ briefWithItems, weekLabel }: MarketContextPageData) {
  const brief = briefWithItems?.brief ?? null;
  const items = briefWithItems?.items ?? [];
  const statusLabel = brief ? formatMarketContextStatus(brief.status) : "Not Generated";
  const periodLabel = brief
    ? formatMarketContextWeekLabel(brief.brief_start_date, brief.brief_end_date)
    : weekLabel;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Market Context
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Local and industry signals that help AJN tailor your marketing plan, content, and
            command center recommendations to what is happening in your market right now.
          </p>
        </div>
        <MarketContextRefreshButton />
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Weekly Market Summary
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">{periodLabel}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {brief
                ? `Generated ${formatMarketContextDate(brief.updated_at)}`
                : "Refresh market context to gather local events, holidays, weather, trends, and competitor signals."}
            </p>
          </div>
          <StatusBadge status={statusLabel} />
        </div>
        {brief?.overall_summary && (
          <p className="mt-5 text-sm leading-7 text-slate-200">{brief.overall_summary}</p>
        )}
      </section>

      {brief?.status === "generating" && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          Your market context brief is generating. Refresh this page in a moment if it does not
          update automatically.
        </p>
      )}

      {brief?.status === "failed" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          The last market context refresh failed. Click Refresh Market Context to try again.
        </p>
      )}

      {!brief && (
        <DashboardEmptyState
          title="No market context yet"
          description="Generate your first weekly market context brief to see local signals, recommended topics, and content angles."
        />
      )}

      {brief?.status === "active" && (
        <>
          <SectionCard
            title="Top Context Signals"
            subtitle="Ranked by relevance to your business, location, and timing."
          >
            {items.length === 0 ? (
              <p className="text-sm text-text-muted">No context items were saved for this brief.</p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600 ring-1 ring-brand-100">
                        {formatMarketContextCategory(item.category)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getContextSignalSourceStyles(item.metadata)}`}
                      >
                        {getContextSignalSourceLabel(item.metadata)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        Relevance {Math.round(item.relevance_score)} · Confidence{" "}
                        {Math.round(item.confidence_score)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-navy-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{item.summary}</p>
                    {item.source_name && (
                      <p className="mt-2 text-xs text-slate-500">
                        Source:{" "}
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {item.source_name}
                          </a>
                        ) : (
                          item.source_name
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Recommended Topics">
              <TagList items={brief.recommended_topics} emptyLabel="No recommended topics yet." />
            </SectionCard>

            <SectionCard title="Opportunity Keywords">
              <TagList
                items={brief.high_opportunity_keywords}
                emptyLabel="No opportunity keywords yet."
              />
            </SectionCard>
          </div>

          <SectionCard title="Content Angles">
            {brief.content_angles.length === 0 ? (
              <p className="text-sm text-text-muted">No content angles yet.</p>
            ) : (
              <ul className="space-y-3">
                {brief.content_angles.map((angle) => (
                  <li key={angle} className="text-sm leading-6 text-slate-700">
                    {angle}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
