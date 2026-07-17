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
            Preparing for publication
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Approved work waiting to go live. I handle the timing — you only need to look when
            something needs your attention.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Link
            href="/dashboard/library"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Open Library
          </Link>
          <Link
            href="/dashboard/approvals"
            className="text-sm font-medium text-text-muted transition-colors hover:text-brand-700"
          >
            Review This Week
          </Link>
        </div>
      </div>

      <PublishingJobsPanel initialJobs={jobs} />
      <PublishingQueuePanel initialItems={items} initialStats={stats} />
    </div>
  );
}
