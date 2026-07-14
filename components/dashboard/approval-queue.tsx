"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatApprovalDate,
  formatApprovalStatus,
} from "@/lib/content-approval/persistence";
import { patchContentApprovalRequest } from "@/lib/content-approval-client";
import { createPublishingQueueRequest } from "@/lib/publishing-queue-client";
import type { ContentApproval, ContentApprovalStatus } from "@/lib/content-approval/types";

const REJECTION_REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "too_promotional", label: "Too promotional" },
  { value: "wrong_tone", label: "Wrong tone" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "off_brand_topic", label: "Off-brand topic" },
  { value: "poor_timing", label: "Poor timing" },
  { value: "duplicate_content", label: "Duplicate content" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: ContentApprovalStatus }) {
  const label = formatApprovalStatus(status);
  const styles = {
    pending: "bg-amber-50 text-amber-700 ring-amber-100",
    approved: "bg-growth-50 text-growth-500 ring-emerald-100",
    rejected: "bg-rose-50 text-rose-600 ring-rose-100",
    published: "bg-brand-50 text-brand-600 ring-brand-100",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {label}
    </span>
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded-full bg-[#081426]/5 px-2.5 py-1 text-[11px] font-semibold text-navy-900 ring-1 ring-slate-200">
      {type}
    </span>
  );
}

function ApprovalCard({
  item,
  onUpdated,
}: {
  item: ContentApproval;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [rejectionReasonCode, setRejectionReasonCode] = useState("too_promotional");
  const [rejectionComment, setRejectionComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAddToQueue() {
    setBusy("queue");

    const { error } = await createPublishingQueueRequest({
      content_approval_id: item.id,
    });

    setBusy(null);
    onUpdated();
    router.refresh();

    if (error) {
      window.alert(error);
    }
  }

  async function runAction(action: "approve" | "reject" | "regenerate" | "update") {
    setBusy(action);

    await patchContentApprovalRequest({
      id: item.id,
      action,
      title,
      content,
      rejected_reason: action === "reject" ? rejectionComment || "Rejected by reviewer" : undefined,
      rejection_reason_code: action === "reject" ? rejectionReasonCode : undefined,
    });

    setBusy(null);
    setEditing(false);
    setRejecting(false);
    onUpdated();
    router.refresh();
  }

  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ContentTypeBadge type={item.content_type} />
          <StatusBadge status={item.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            v{item.version}
          </span>
          {item.ai_score != null && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
              AI Score: {item.ai_score}
            </span>
          )}
          {item.marketing_recommendation_id && (
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-100">
              From Recommendation
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Content</span>
              <textarea
                rows={5}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        ) : rejecting ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Rejection reason
              </span>
              <select
                value={rejectionReasonCode}
                onChange={(event) => setRejectionReasonCode(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {REJECTION_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Comment (optional)
              </span>
              <input
                value={rejectionComment}
                onChange={(event) => setRejectionComment(event.target.value)}
                placeholder="Needs revision before publishing"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-navy-900">{item.title}</h3>
            <p className="text-sm leading-7 text-slate-600">{item.content}</p>
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span>Created: {formatApprovalDate(item.created_at)}</span>
          <span>Source: {item.source}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("update")}
                className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "update" ? "Saving..." : "Save Edit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(item.title);
                  setContent(item.content);
                }}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Cancel
              </button>
            </>
          ) : rejecting ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("reject")}
                className="rounded-full bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
              >
                {busy === "reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(false);
                  setRejectionComment("");
                }}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!!busy || item.status !== "pending"}
                onClick={() => void runAction("approve")}
                className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "approve" ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                disabled={!!busy || item.status !== "pending"}
                onClick={() => setRejecting(true)}
                className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setEditing(true)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("regenerate")}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
              >
                {busy === "regenerate" ? "Regenerating..." : "Regenerate"}
              </button>
              {item.status === "approved" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void handleAddToQueue()}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60"
                >
                  {busy === "queue" ? "Adding..." : "Add to Publishing Queue"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function ApprovalQueue({ initialApprovals }: { initialApprovals: ContentApproval[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ContentApprovalStatus>("all");

  const approvals = useMemo(() => {
    if (filter === "all") return initialApprovals;
    return initialApprovals.filter((item) => item.status === filter);
  }, [filter, initialApprovals]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected", "published"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
              filter === value
                ? "bg-brand-600 text-white ring-brand-600"
                : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {value === "all" ? "All" : formatApprovalStatus(value)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          Refresh Queue
        </button>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center ring-1 ring-slate-200/60">
          <p className="text-sm font-semibold text-navy-900">No approval items yet</p>
          <p className="mt-2 text-sm text-text-muted">
            Send content from the AI Content Generator to start your approval queue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((item) => (
            <ApprovalCard key={item.id} item={item} onUpdated={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
