import {
  PublishingJobStatuses,
  type PublishingJobStatus,
} from "@/lib/publishing/publishingTypes";

export function formatPublishingJobStatus(status: PublishingJobStatus | string): string {
  switch (status) {
    case PublishingJobStatuses.QUEUED:
      return "Queued";
    case PublishingJobStatuses.SCHEDULED:
      return "Scheduled";
    case PublishingJobStatuses.PUBLISHING:
      return "Publishing";
    case PublishingJobStatuses.PUBLISHED:
      return "Published";
    case PublishingJobStatuses.VERIFIED:
      return "Verified";
    case PublishingJobStatuses.RETRYING:
      return "Retrying";
    case PublishingJobStatuses.FAILED:
      return "Failed";
    case PublishingJobStatuses.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

export function formatPublishingHistoryDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function publishingJobStatusStyles(status: PublishingJobStatus | string): string {
  switch (status) {
    case PublishingJobStatuses.QUEUED:
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case PublishingJobStatuses.SCHEDULED:
      return "bg-amber-50 text-amber-700 ring-amber-100";
    case PublishingJobStatuses.PUBLISHING:
      return "bg-brand-50 text-brand-600 ring-brand-100";
    case PublishingJobStatuses.PUBLISHED:
    case PublishingJobStatuses.VERIFIED:
      return "bg-growth-50 text-growth-500 ring-emerald-100";
    case PublishingJobStatuses.RETRYING:
      return "bg-orange-50 text-orange-700 ring-orange-100";
    case PublishingJobStatuses.FAILED:
      return "bg-rose-50 text-rose-600 ring-rose-100";
    case PublishingJobStatuses.CANCELLED:
      return "bg-slate-100 text-slate-500 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function canRetryPublishingJob(status: PublishingJobStatus): boolean {
  return status === PublishingJobStatuses.FAILED || status === PublishingJobStatuses.RETRYING;
}

export function canCancelPublishingJob(status: PublishingJobStatus): boolean {
  return (
    status === PublishingJobStatuses.QUEUED ||
    status === PublishingJobStatuses.SCHEDULED ||
    status === PublishingJobStatuses.RETRYING
  );
}

export function canPublishNowPublishingJob(status: PublishingJobStatus): boolean {
  return (
    status === PublishingJobStatuses.QUEUED ||
    status === PublishingJobStatuses.SCHEDULED ||
    status === PublishingJobStatuses.FAILED
  );
}
