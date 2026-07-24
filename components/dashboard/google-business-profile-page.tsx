import Link from "next/link";
import { GoogleBusinessReviewCard } from "@/components/dashboard/google-business-review-card";
import { GoogleBusinessSyncButton } from "@/components/dashboard/google-business-sync-button";
import {
  OrientationNote,
  PageHeader,
  RecoveryNotice,
  TrustSignalList,
} from "@/components/dashboard/ui/page-chrome";
import {
  buildTrustSignals,
  recoveryGoogleUnavailable,
} from "@/lib/customer-ux/trustPresentation";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import { formatGoogleSyncDate } from "@/lib/google-business/persistence";
import type { GoogleBusinessDashboardData, GoogleBusinessPost } from "@/lib/google-business/types";

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
    </article>
  );
}

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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-8 text-center ring-1 ring-slate-200/60">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

function PostList({ posts, emptyMessage }: { posts: GoogleBusinessPost[]; emptyMessage: string }) {
  if (posts.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-3">
      {posts.slice(0, 6).map((post) => (
        <article
          key={post.id}
          className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
              {post.status}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {post.source === "local" ? "Local draft" : "Google"}
            </span>
          </div>
          <p className="mt-3 font-semibold text-navy-900">
            {post.title ?? post.summary?.slice(0, 80) ?? "Google Business post"}
          </p>
          {post.summary && (
            <p className="mt-2 text-sm leading-6 text-slate-600">{post.summary}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function GrowthChart({
  labels,
  values,
  color,
  title,
}: {
  labels: string[];
  values: number[];
  color: string;
  title: string;
}) {
  if (labels.length === 0 || values.length === 0) {
    return null;
  }

  const max = Math.max(...values, 1);
  const width = 560;
  const height = 120;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 16) - 8;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function formatAddress(addressJson: Record<string, unknown>): string {
  const parts = [
    addressJson.addressLines,
    addressJson.locality,
    addressJson.administrativeArea,
    addressJson.postalCode,
  ]
    .flat()
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "—";
}

export function GoogleBusinessProfilePage({ data }: { data: GoogleBusinessDashboardData }) {
  if (data.setupRequired) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Connections"
          title="Google Business Profile"
          description="Optional connection for local posts, reviews, and performance insights."
        />
        <RecoveryNotice {...recoveryGoogleUnavailable()} />
        <DashboardEmptyState
          kind="source_unavailable"
          title="Google connection is temporarily unavailable"
          description="You can keep using Head of Marketing and finish other setup. Contact support if you need Google features enabled for your workspace."
          actionLabel="Open connection help"
          actionHref="/dashboard/google-business-profile/connect"
        />
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Connections"
          title="Google Business Profile"
          description="Optional — unlocks local posts, reviews, and performance insights when you're ready."
        />
        <OrientationNote
          whyItMatters="Connecting Google helps me prepare local posts and review replies for your approval."
          whatHappensNext="You'll sign in with Google, choose your profile, and nothing publishes without approval."
        />
        <DashboardEmptyState
          kind="not_configured"
          title="Google isn't connected yet"
          description="Connect when you're ready. Other parts of AJN Marketing still work without Google."
          actionLabel="Connect Google Business Profile"
          actionHref="/dashboard/google-business-profile/connect"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <PageHeader
            eyebrow="Connections"
            title="Google Business Profile"
            description="Local visibility, reviews, and posts for your connected profile. Publishing still requires your approval."
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-growth-50 px-3 py-1 text-xs font-semibold text-growth-700 ring-1 ring-emerald-100">
              <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
              <span className="sr-only">Connection status: </span>
              {data.connectionStatus}
            </span>
            <p className="text-xs font-medium text-slate-500">
              Last sync: {formatGoogleSyncDate(data.lastSyncedAt)}
            </p>
          </div>
          <OrientationNote
            whyItMatters="This is your local marketing hub on Google."
            whatHappensNext="Sync when data looks stale. Reconnect if access expires."
          />
          <TrustSignalList
            signals={buildTrustSignals([
              { label: "Last synced", isoDate: data.lastSyncedAt },
              {
                label: "Last sync run",
                isoDate: data.latestSync?.completed_at ?? data.latestSync?.started_at ?? null,
              },
            ])}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/google-business-profile/connect"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Manage Connection
          </Link>
          <GoogleBusinessSyncButton />
        </div>
      </div>

      <SectionCard title="Sync Status" subtitle="Latest Google Business Profile sync">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <p className="text-xs font-medium text-text-muted">Last Synced</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">
              {formatGoogleSyncDate(data.lastSyncedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <p className="text-xs font-medium text-text-muted">Sync Status</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">
              {data.latestSync?.sync_status ?? "No sync yet"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <p className="text-xs font-medium text-text-muted">Reviews Synced</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">
              {data.latestSync?.reviews_synced ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <p className="text-xs font-medium text-text-muted">Insights Synced</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">
              {data.latestSync?.insights_synced ?? 0}
            </p>
          </div>
        </div>
        {data.latestSync?.error_message && (
          <p className="mt-4 text-sm text-amber-700">{data.latestSync.error_message}</p>
        )}
      </SectionCard>

      <SectionCard title="Sync History" subtitle="Recent Google Business Profile sync runs">
        {data.syncHistory.length === 0 ? (
          <EmptyState message="No sync history yet. Click Refresh Data to start your first sync." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                  <th className="pb-3 pr-4 font-semibold">Started</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Locations</th>
                  <th className="pb-3 pr-4 font-semibold">Reviews</th>
                  <th className="pb-3 pr-4 font-semibold">Posts</th>
                  <th className="pb-3 font-semibold">Insights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.syncHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4 font-medium text-navy-900">
                      {formatGoogleSyncDate(entry.started_at)}
                    </td>
                    <td className="py-3 pr-4">{entry.sync_status}</td>
                    <td className="py-3 pr-4">{entry.locations_synced}</td>
                    <td className="py-3 pr-4">{entry.reviews_synced}</td>
                    <td className="py-3 pr-4">{entry.posts_synced}</td>
                    <td className="py-3">{entry.insights_synced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Business Overview" subtitle="Connected location information">
        {data.location ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Business", value: data.location.location_title ?? "—" },
              { label: "Category", value: data.location.primary_category ?? "—" },
              { label: "Phone", value: data.location.phone ?? "—" },
              { label: "Website", value: data.location.website_uri ?? "—" },
              { label: "Address", value: formatAddress(data.location.address_json) },
              { label: "Verification", value: data.location.verification_status ?? "—" },
              {
                label: "Average Rating",
                value: data.reviewSummary.averageRating?.toFixed(1) ?? "—",
              },
              { label: "Review Count", value: String(data.reviewSummary.reviewCount) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-navy-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState message="No location synced yet. Click Refresh Data to download your Google Business location." />
        )}
      </SectionCard>

      <div>
        <h2 className="mb-4 text-lg font-bold text-navy-900">Performance</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Search Views" value={String(data.insights.searchViews)} />
          <MetricCard label="Maps Views" value={String(data.insights.mapsViews)} />
          <MetricCard label="Website Clicks" value={String(data.insights.websiteClicks)} />
          <MetricCard label="Phone Calls" value={String(data.insights.phoneCalls)} />
          <MetricCard label="Direction Requests" value={String(data.insights.directionRequests)} />
        </div>
        <p className="mt-2 text-xs text-text-muted">Current month totals from synced Google insights.</p>
      </div>

      <SectionCard title="Reviews" subtitle="Reputation monitoring and AI-assisted reply drafts">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Average Rating",
              value: data.reviewSummary.averageRating?.toFixed(1) ?? "—",
            },
            { label: "Review Count", value: String(data.reviewSummary.reviewCount) },
            {
              label: "New Reviews This Month",
              value: String(data.reviewSummary.newReviewsThisMonth),
            },
            {
              label: "Unanswered Reviews",
              value: String(data.reviewSummary.unansweredCount),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-medium text-text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-navy-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Unanswered Reviews</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {data.unansweredReviews.length === 0 ? (
                <EmptyState message="No unanswered reviews." />
              ) : (
                data.unansweredReviews.map((review) => (
                  <GoogleBusinessReviewCard key={review.id} review={review} />
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-navy-900">Recent Reviews</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {data.recentReviews.length === 0 ? (
                <EmptyState message="No reviews synced yet. Click Refresh Data to download reviews." />
              ) : (
                data.recentReviews.map((review) => (
                  <GoogleBusinessReviewCard key={review.id} review={review} />
                ))
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Posts" subtitle="Published, scheduled, and draft Google Business posts">
        <div className="mb-4">
          <Link
            href="/dashboard/content/generator"
            className="inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Create Google Post
          </Link>
          <p className="mt-2 text-xs text-text-muted">
            Content is generated with the AI Content Generator and requires Approval Center approval
            before publishing. Replies are never auto-posted.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Published</h3>
            <div className="mt-3">
              <PostList posts={data.posts.published} emptyMessage="No published posts synced yet." />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Scheduled</h3>
            <div className="mt-3">
              <PostList posts={data.posts.scheduled} emptyMessage="No scheduled posts." />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Draft</h3>
            <div className="mt-3">
              <PostList posts={data.posts.draft} emptyMessage="No draft posts." />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Insights" subtitle="Monthly trends and top performing months">
        {data.insights.monthlyTrends.length === 0 ? (
          <EmptyState message="No insights synced yet. Click Refresh Data to download performance metrics." />
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                    <th className="pb-3 pr-4 font-semibold">Month</th>
                    <th className="pb-3 pr-4 font-semibold">Search</th>
                    <th className="pb-3 pr-4 font-semibold">Maps</th>
                    <th className="pb-3 pr-4 font-semibold">Website</th>
                    <th className="pb-3 pr-4 font-semibold">Calls</th>
                    <th className="pb-3 font-semibold">Directions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.insights.monthlyTrends.map((row) => (
                    <tr key={row.month}>
                      <td className="py-3 pr-4 font-medium text-navy-900">{row.month}</td>
                      <td className="py-3 pr-4">{row.searchViews}</td>
                      <td className="py-3 pr-4">{row.mapsViews}</td>
                      <td className="py-3 pr-4">{row.websiteClicks}</td>
                      <td className="py-3 pr-4">{row.phoneCalls}</td>
                      <td className="py-3">{row.directionRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.insights.topPerformingMonths.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900">Best Performing Months</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {data.insights.topPerformingMonths.map((month) => (
                    <div
                      key={month.month}
                      className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                    >
                      <p className="text-xs font-medium text-text-muted">{month.month}</p>
                      <p className="mt-2 text-lg font-bold text-navy-900">
                        {month.totalEngagement} engagements
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.insights.growthCharts.labels.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900">Growth Charts</h3>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <GrowthChart
                    title="Profile Views"
                    labels={data.insights.growthCharts.labels}
                    values={data.insights.growthCharts.profileViews}
                    color="#2563EB"
                  />
                  <GrowthChart
                    title="Website Clicks"
                    labels={data.insights.growthCharts.labels}
                    values={data.insights.growthCharts.websiteClicks}
                    color="#22C55E"
                  />
                  <GrowthChart
                    title="Phone Calls"
                    labels={data.insights.growthCharts.labels}
                    values={data.insights.growthCharts.phoneCalls}
                    color="#F59E0B"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
