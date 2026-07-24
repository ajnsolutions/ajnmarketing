"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import {
  formatApprovalDate,
  formatApprovalStatus,
} from "@/lib/content-approval/persistence";
import { patchContentApprovalRequest } from "@/lib/content-approval-client";
import { approvalStatusGuide } from "@/lib/customer-ux/workflowPresentation";
import { createPublishingQueueRequest } from "@/lib/publishing-queue-client";
import type { ContentApproval, ContentApprovalStatus } from "@/lib/content-approval/types";
import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";
import { ProcessingNotice } from "@/components/dashboard/ui/page-chrome";

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

function OutcomeStatusBadge({ status }: { status: ClientRecommendationDecisionPackage["outcomeStatus"] }) {
  const className = status.isOperationalIssue
    ? "bg-amber-50 text-amber-700 ring-amber-100"
    : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {status.label}
    </span>
  );
}

/**
 * Client-safe recommendation package -- what AJN recommends, why it matters now, the
 * expected benefit, and a plain-language confidence label. Never renders internal score
 * arithmetic or raw confidence percentages (see lib/recommendation-presentation/types.ts).
 */
function RecommendationPackagePanel({ pkg }: { pkg: ClientRecommendationDecisionPackage }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy-900">{pkg.recommendedAction}</span>
          {pkg.platform && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-900 ring-1 ring-slate-200">
              {pkg.platform.replace(/_/g, " ")}
            </span>
          )}
          <OutcomeStatusBadge status={pkg.outcomeStatus} />
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {expanded ? "Hide details" : "Why this recommendation"}
        </button>
      </div>

      {pkg.outcomeStatus.isOperationalIssue && pkg.outcomeStatus.detail && (
        <p className="mt-2 text-sm leading-6 text-amber-800">{pkg.outcomeStatus.detail}</p>
      )}

      {expanded && (
        <div id={detailsId} className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
          <p>{pkg.whyNow}</p>

          {pkg.supportingReasons.length > 0 && (
            <ul className="space-y-1.5">
              {pkg.supportingReasons.map((reason, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden="true" className="text-growth-500">
                    ✓
                  </span>
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Expected benefit</p>
            <p className="mt-1">{pkg.expectedBenefit}</p>
          </div>

          <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {pkg.confidenceLabelText}
            </p>
            <p className="mt-1">{pkg.confidenceExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  item,
  recommendationPackage,
  onUpdated,
}: {
  item: ContentApproval;
  recommendationPackage?: ClientRecommendationDecisionPackage;
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
  const [feedbackSent, setFeedbackSent] = useState(false);

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

  async function runAction(action: "approve" | "reject" | "regenerate" | "update" | "more_like_this") {
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
    if (action === "more_like_this") setFeedbackSent(true);
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
            <span
              className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100"
              title="A confidence signal for this draft — not a ranking score that changes order"
            >
              Confidence: {item.ai_score}/100
            </span>
          )}
          {item.marketing_recommendation_id && (
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-100">
              From a recommendation
            </span>
          )}
        </div>

        {/* The recommendation package stays visible during editing/rejecting, not just
            the normal view -- the explanation for why AJN suggested this shouldn't
            disappear the moment a client starts reviewing it. */}
        {recommendationPackage && <RecommendationPackagePanel pkg={recommendationPackage} />}

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
          <span>Waiting since: {formatApprovalDate(item.created_at)}</span>
          {item.status === "pending" ? <span>Review when you can</span> : null}
        </div>

        {item.status === "pending" && (
          <p className="text-xs leading-5 text-text-muted" role="note">
            {approvalStatusGuide(item.status).happening} {approvalStatusGuide(item.status).needAction}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("update")}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "update" ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(item.title);
                  setContent(item.content);
                }}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Cancel
              </button>
            </>
          ) : rejecting ? (
            <>
              <p className="w-full text-sm leading-6 text-slate-600" role="note">
                Rejecting keeps this draft out of publishing. You can regenerate a new version later.
              </p>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("reject")}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
              >
                {busy === "reject" ? "Rejecting…" : "Confirm reject"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(false);
                  setRejectionComment("");
                }}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Keep reviewing
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!!busy || item.status !== "pending"}
                onClick={() => void runAction("approve")}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={!!busy || item.status !== "pending"}
                onClick={() => setRejecting(true)}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setEditing(true)}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void runAction("regenerate")}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
              >
                {busy === "regenerate" ? "Preparing a new draft…" : "Try a new version"}
              </button>
              {item.status === "approved" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void handleAddToQueue()}
                  className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60"
                >
                  {busy === "queue" ? "Adding…" : "Send to publishing"}
                </button>
              )}
              {recommendationPackage && (
                <button
                  type="button"
                  disabled={!!busy}
                  aria-label="Do more like this recommendation"
                  onClick={() => void runAction("more_like_this")}
                  className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-growth-200 bg-growth-50 px-3.5 py-2 text-sm font-semibold text-growth-600 transition-colors hover:bg-growth-100 disabled:opacity-60"
                >
                  {busy === "more_like_this"
                    ? "Saving…"
                    : feedbackSent
                      ? "Thanks — noted!"
                      : "Do more like this"}
                </button>
              )}
            </>
          )}
        </div>
        {busy && (
          <ProcessingNotice
            label={
              busy === "approve"
                ? "Saving your approval…"
                : busy === "reject"
                  ? "Saving your decision…"
                  : busy === "regenerate"
                    ? "Preparing a new draft…"
                    : busy === "queue"
                      ? "Sending to publishing…"
                      : "Working on it…"
            }
            hint="This usually takes a moment. You can stay on this page."
          />
        )}
      </div>
    </article>
  );
}

export function ApprovalQueue({
  initialApprovals,
  recommendationPackagesByApprovalId = {},
  initialFilter = "all",
  focusApprovalId = null,
}: {
  initialApprovals: ContentApproval[];
  recommendationPackagesByApprovalId?: Record<string, ClientRecommendationDecisionPackage>;
  initialFilter?: "all" | ContentApprovalStatus;
  focusApprovalId?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ContentApprovalStatus>(initialFilter);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const filtersId = useId();

  const pendingCount = useMemo(
    () => initialApprovals.filter((item) => item.status === "pending").length,
    [initialApprovals],
  );

  const approvals = useMemo(() => {
    if (filter === "all") return initialApprovals;
    return initialApprovals.filter((item) => item.status === filter);
  }, [filter, initialApprovals]);

  useEffect(() => {
    if (!focusApprovalId) return;
    const el = document.getElementById(`approval-${focusApprovalId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusApprovalId, filter, approvals]);

  async function approveAllPending() {
    const pending = initialApprovals.filter((item) => item.status === "pending");
    if (pending.length === 0) return;

    const confirmed = window.confirm(
      `Approve all ${pending.length} item${pending.length === 1 ? "" : "s"} that need your opinion? Nothing publishes until you send approved work to publishing.`,
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setBulkMessage(`Approving ${pending.length} item${pending.length === 1 ? "" : "s"}…`);

    let failed = 0;
    for (const item of pending) {
      const { error } = await patchContentApprovalRequest({
        id: item.id,
        action: "approve",
        title: item.title,
        content: item.content,
      });
      if (error) failed += 1;
    }

    setBulkBusy(false);
    setBulkMessage(
      failed > 0
        ? `Finished with ${failed} issue${failed === 1 ? "" : "s"}. Refresh and review anything still pending.`
        : "All set — approved items are ready for publishing when you are.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={filtersId}>
          <span id={filtersId} className="sr-only">
            Filter approval queue
          </span>
          {(["all", "pending", "approved", "rejected", "published"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
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
            className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh
          </button>
        </div>

        {pendingCount > 0 ? (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void approveAllPending()}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60"
          >
            {bulkBusy ? "Approving…" : `Approve all needing review (${pendingCount})`}
          </button>
        ) : null}
      </div>

      {bulkBusy || bulkMessage ? (
        <ProcessingNotice
          label={bulkMessage ?? "Working…"}
          hint={bulkBusy ? "Please wait — approving one item at a time." : undefined}
        />
      ) : null}

      {approvals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center ring-1 ring-slate-200/60">
          {filter === "pending" ? (
            <>
              <p className="text-sm font-semibold text-navy-900">You’re caught up</p>
              <p className="mt-2 text-sm text-text-muted">
                Nothing needs your opinion right now. New drafts will appear here before anything goes
                live.
              </p>
            </>
          ) : filter === "approved" || filter === "published" || filter === "rejected" ? (
            <>
              <p className="text-sm font-semibold text-navy-900">No items in this view yet</p>
              <p className="mt-2 text-sm text-text-muted">
                Switch to “Needs your opinion” or All to see your full history.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-navy-900">Nothing in Approvals yet</p>
              <p className="mt-2 text-sm text-text-muted">
                Create a draft and I’ll bring it here for a calm review before publishing.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((item) => (
            <div
              key={item.id}
              id={`approval-${item.id}`}
              className={
                focusApprovalId === item.id
                  ? "rounded-2xl ring-2 ring-brand-600 ring-offset-2"
                  : undefined
              }
            >
              <ApprovalCard
                item={item}
                recommendationPackage={recommendationPackagesByApprovalId[item.id]}
                onUpdated={() => router.refresh()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
