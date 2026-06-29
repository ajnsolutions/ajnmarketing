import Link from "next/link";
import { GoogleBusinessReviewCard } from "@/components/dashboard/google-business-review-card";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import type { GoogleBusinessDashboardData } from "@/lib/google-business/types";

export function ReviewsHubPage({ data }: { data: GoogleBusinessDashboardData }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Reviews</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Monitor customer feedback and draft professional replies from your synced Google Business
          Profile data.
        </p>
      </div>

      {!data.connected ? (
        <DashboardEmptyState
          title="Connect Google Business Profile"
          description="Connect Google Business Profile to sync live reviews, ratings, and reply drafts."
          actionLabel="Connect Google Business Profile"
          actionHref="/dashboard/google-business-profile/connect"
        />
      ) : data.recentReviews.length === 0 ? (
        <DashboardEmptyState
          title="No reviews synced yet"
          description="Refresh Google Business data to download your latest reviews and ratings."
          actionLabel="Open Google Business Profile"
          actionHref="/dashboard/google-business-profile"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Average Rating",
                value: data.reviewSummary.averageRating?.toFixed(1) ?? "—",
              },
              { label: "Total Reviews", value: String(data.reviewSummary.reviewCount) },
              {
                label: "New This Month",
                value: String(data.reviewSummary.newReviewsThisMonth),
              },
              {
                label: "Pending Replies",
                value: String(data.reviewSummary.unansweredCount),
              },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]"
              >
                <p className="text-sm font-medium text-text-muted">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-navy-900">{item.value}</p>
              </article>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-navy-900 sm:text-lg">Recent Reviews</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Draft replies with AI, then post manually on Google.
                </p>
              </div>
              <Link
                href="/dashboard/google-business-profile"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Open GBP dashboard →
              </Link>
            </div>
            <div className="grid gap-4 px-5 py-4 sm:px-6 sm:py-5 lg:grid-cols-2">
              {data.recentReviews.map((review) => (
                <GoogleBusinessReviewCard key={review.id} review={review} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
