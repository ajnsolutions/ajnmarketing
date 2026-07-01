import Link from "next/link";
import { PublishingJobsPanel } from "@/components/dashboard/publishing-jobs-panel";
import { PublishingQueuePanel } from "@/components/dashboard/publishing-queue-panel";
import type { PublishingJob } from "@/lib/publishing/publishingTypes";
import type { PublishingQueueItem, PublishingQueueStats } from "@/lib/publishing-queue/types";

export function PublishingPage({
  items,
  stats,
  jobs,
}: {
  items: PublishingQueueItem[];
  stats: PublishingQueueStats;
  jobs: PublishingJob[];
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Publishing Queue
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Organize approved content and publish autonomously to Google Business Profile. The
            publishing engine handles async execution, retries, verification, and history while
            preserving the existing approval queue workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/approvals"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Approval Center
          </Link>
          <Link
            href="/dashboard/content"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Content Hub
          </Link>
        </div>
      </div>

      <PublishingJobsPanel initialJobs={jobs} />
      <PublishingQueuePanel initialItems={items} initialStats={stats} />
    </div>
  );
}
