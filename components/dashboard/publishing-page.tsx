import Link from "next/link";
import { PublishingJobsPanel } from "@/components/dashboard/publishing-jobs-panel";
import { PublishingQueuePanel } from "@/components/dashboard/publishing-queue-panel";
import {
  CONTENT_WORKFLOW_STEPS,
  OrientationNote,
  PageHeader,
  WorkflowTrail,
} from "@/components/dashboard/ui/page-chrome";
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
          <PageHeader
            eyebrow="Publishing"
            title="Preparing for publication"
            description="Approved work waiting to go live. I handle timing when I can — you only need to look when something needs attention or recovery."
            actions={
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Link
                  href="/dashboard/library"
                  className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
                >
                  Open Library
                </Link>
                <Link
                  href="/dashboard/approvals"
                  className="hom-focusable text-sm font-medium text-text-muted transition-colors hover:text-brand-700"
                >
                  Review This Week
                </Link>
              </div>
            }
          />
          <OrientationNote
            whyItMatters="This page shows what is approved and ready (or already queued) for destinations like Google."
            whatHappensNext="Failed items can be retried safely. Approval is never the same as publishing."
          />
          <WorkflowTrail
            steps={CONTENT_WORKFLOW_STEPS.map((step) =>
              step.href === "/dashboard/publishing" ? { ...step, current: true } : step,
            )}
          />
        </div>
      </div>

      <PublishingJobsPanel initialJobs={jobs} />
      <PublishingQueuePanel initialItems={items} initialStats={stats} />
    </div>
  );
}
