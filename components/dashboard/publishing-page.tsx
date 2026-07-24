import Link from "next/link";
import { PublishingJobsPanel } from "@/components/dashboard/publishing-jobs-panel";
import { PublishingQueuePanel } from "@/components/dashboard/publishing-queue-panel";
import {
  AttentionBanner,
  CONTENT_WORKFLOW_STEPS,
  FULL_CUSTOMER_JOURNEY_STEPS,
  NextStepHint,
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
  const needsAttention = stats.failed > 0 || stats.ready > 0;

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
          <AttentionBanner
            headline={
              stats.failed > 0
                ? `${stats.failed} item${stats.failed === 1 ? "" : "s"} need a retry`
                : stats.ready > 0
                  ? `${stats.ready} approved item${stats.ready === 1 ? "" : "s"} ready to publish`
                  : "Nothing needs you in publishing right now"
            }
            detail={
              stats.failed > 0
                ? "Retry when you’re ready — a successful retry moves the update toward published."
                : stats.ready > 0
                  ? "Publish now or schedule for later. Waiting/scheduled items need no action."
                  : "Scheduled and published work continues without you."
            }
            tone={stats.failed > 0 ? "warning" : needsAttention ? "info" : "success"}
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

      <NextStepHint
        finished="You’ve reached the publishing step for approved work."
        next="After something goes live, Results highlights what’s improving — not operational noise."
        href="/dashboard/results"
        ctaLabel="See results"
      />
      <WorkflowTrail
        ariaLabel="Full customer journey"
        steps={FULL_CUSTOMER_JOURNEY_STEPS.map((step) =>
          step.href === "/dashboard/publishing" ? { ...step, current: true } : step,
        )}
      />
    </div>
  );
}
