"use client";

import { useMemo, useState } from "react";
import {
  formatPublishingDate,
  formatPublishingPlatform,
  formatPublishingStatus,
} from "@/lib/publishing-queue/persistence";
import {
  patchPublishingQueueRequest,
} from "@/lib/publishing-queue-client";
import type {
  PublishingPlatform,
  PublishingQueueItem,
  PublishingQueueStats,
  PublishingQueueStatus,
} from "@/lib/publishing-queue/types";
import { PUBLISHING_PLATFORMS } from "@/lib/publishing-queue/types";
import { SchedulePostModal } from "@/components/dashboard/schedule-post-modal";

function StatusBadge({ status }: { status: PublishingQueueStatus }) {
  const label = formatPublishingStatus(status);
  const styles = {
    ready: "bg-brand-50 text-brand-600 ring-brand-100",
    scheduled: "bg-amber-50 text-amber-700 ring-amber-100",
    published: "bg-growth-50 text-growth-500 ring-emerald-100",
    failed: "bg-rose-50 text-rose-600 ring-rose-100",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: PublishingPlatform }) {
  return (
    <span className="rounded-full bg-[#081426]/5 px-2.5 py-1 text-[11px] font-semibold text-navy-900 ring-1 ring-slate-200">
      {formatPublishingPlatform(platform)}
    </span>
  );
}

function QueueItemCard({
  item,
  onUpdated,
  compact = false,
}: {
  item: PublishingQueueItem;
  onUpdated: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  async function runAction(
    action: "schedule" | "mark_published" | "remove",
    scheduledFor?: string
  ) {
    setBusy(action);

    if (action === "remove") {
      await patchPublishingQueueRequest({ id: item.id, action: "remove" });
    } else if (action === "schedule" && scheduledFor) {
      await patchPublishingQueueRequest({
        id: item.id,
        action: "schedule",
        scheduled_for: scheduledFor,
      });
    } else if (action === "mark_published") {
      await patchPublishingQueueRequest({ id: item.id, action: "mark_published" });
    }

    setBusy(null);
    setScheduleOpen(false);
    onUpdated();
  }

  return (
    <>
      <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={item.platform} />
            <StatusBadge status={item.status} />
          </div>

          <h3 className="font-semibold text-navy-900">{item.title}</h3>
          {!compact && (
            <p className="text-sm leading-7 text-slate-600">{item.content}</p>
          )}
          {compact && (
            <p className="line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <span>Scheduled: {formatPublishingDate(item.scheduled_for)}</span>
            {item.published_at && (
              <span>Published: {formatPublishingDate(item.published_at)}</span>
            )}
            {item.publish_error && (
              <span className="normal-case text-rose-600">{item.publish_error}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(item.status === "ready" || item.status === "failed") && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setScheduleOpen(true)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
              >
                Schedule
              </button>
            )}
            {item.status !== "published" && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("mark_published")}
                className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "mark_published" ? "Updating..." : "Mark Published"}
              </button>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void runAction("remove")}
              className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60"
            >
              {busy === "remove" ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      </article>

      <SchedulePostModal
        open={scheduleOpen}
        title={item.title}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(scheduledFor) => void runAction("schedule", scheduledFor)}
      />
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center ring-1 ring-slate-200/60">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function PublishingQueuePanel({
  initialItems,
  initialStats,
  compact = false,
  showFilters = true,
  showSections = true,
}: {
  initialItems: PublishingQueueItem[];
  initialStats?: PublishingQueueStats;
  compact?: boolean;
  showFilters?: boolean;
  showSections?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [platformFilter, setPlatformFilter] = useState<"all" | PublishingPlatform>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PublishingQueueStatus>("all");

  const stats = useMemo<PublishingQueueStats>(() => {
    if (initialStats) return initialStats;
    return {
      ready: items.filter((item) => item.status === "ready").length,
      scheduled: items.filter((item) => item.status === "scheduled").length,
      published: items.filter((item) => item.status === "published").length,
      failed: items.filter((item) => item.status === "failed").length,
    };
  }, [initialStats, items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, platformFilter, statusFilter]);

  const grouped = useMemo(
    () => ({
      ready: filteredItems.filter((item) => item.status === "ready"),
      scheduled: filteredItems.filter((item) => item.status === "scheduled"),
      published: filteredItems.filter((item) => item.status === "published"),
      failed: filteredItems.filter((item) => item.status === "failed"),
    }),
    [filteredItems]
  );

  async function refreshItems() {
    const response = await fetch("/api/publishing-queue");
    const payload = (await response.json()) as { items?: PublishingQueueItem[] };
    setItems(payload.items ?? []);
  }

  function renderSection(title: string, sectionItems: PublishingQueueItem[]) {
    if (sectionItems.length === 0) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">{title}</h3>
        <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
          {sectionItems.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              compact={compact}
              onUpdated={() => void refreshItems()}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Ready to Publish", value: stats.ready },
            { label: "Scheduled", value: stats.scheduled },
            { label: "Published", value: stats.published },
            { label: "Failed", value: stats.failed },
          ].map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]"
            >
              <p className="text-sm font-medium text-text-muted">{kpi.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{kpi.value}</p>
            </article>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlatformFilter("all")}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
              platformFilter === "all"
                ? "bg-brand-600 text-white ring-brand-600"
                : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300"
            }`}
          >
            All Platforms
          </button>
          {PUBLISHING_PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => setPlatformFilter(platform)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                platformFilter === platform
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300"
              }`}
            >
              {formatPublishingPlatform(platform)}
            </button>
          ))}
          <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:inline-block" />
          {(["all", "ready", "scheduled", "published", "failed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                statusFilter === value
                  ? "bg-[#081426] text-white ring-[#081426]"
                  : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300"
              }`}
            >
              {value === "all" ? "All Statuses" : formatPublishingStatus(value)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void refreshItems()}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh
          </button>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState message="No publishing queue items yet. Add approved content from the Approval Center." />
      ) : showSections ? (
        <div className="space-y-8">
          {renderSection("Ready to Publish", grouped.ready)}
          {renderSection("Scheduled Posts", grouped.scheduled)}
          {renderSection("Published History", grouped.published)}
          {renderSection("Failed Items", grouped.failed)}
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
          {filteredItems.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              compact={compact}
              onUpdated={() => void refreshItems()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
