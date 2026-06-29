"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  draftGoogleReviewReplyClient,
  markGoogleReviewRespondedClient,
} from "@/lib/google-business-client";
import type { GoogleBusinessReview } from "@/lib/google-business/types";

export function GoogleBusinessReviewCard({ review }: { review: GoogleBusinessReview }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftReply, setDraftReply] = useState(review.ai_draft_reply);

  async function handleDraftReply() {
    setBusy("draft");
    setError(null);

    const { error: draftError } = await draftGoogleReviewReplyClient(review.id);

    setBusy(null);

    if (draftError) {
      setError(draftError);
      return;
    }

    router.refresh();
  }

  async function handleMarkResponded() {
    setBusy("mark");
    setError(null);

    const { error: markError } = await markGoogleReviewRespondedClient(review.id);

    setBusy(null);

    if (markError) {
      setError(markError);
      return;
    }

    router.refresh();
  }

  return (
    <article className="rounded-xl border border-slate-100 bg-white p-4 ring-1 ring-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-900">{review.reviewer_name ?? "Google reviewer"}</p>
          <p className="mt-1 text-sm font-semibold text-amber-500">★ {review.rating.toFixed(1)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {review.reply_status.replace(/_/g, " ")}
        </span>
      </div>

      {review.comment && (
        <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
      )}

      {review.review_reply && (
        <p className="mt-3 rounded-lg bg-growth-50 px-3 py-2 text-sm leading-6 text-slate-700 ring-1 ring-emerald-100">
          <span className="font-semibold text-navy-900">Published reply:</span> {review.review_reply}
        </p>
      )}

      {draftReply && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">
          <span className="font-semibold text-navy-900">AI draft:</span> {draftReply}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void handleDraftReply()}
          className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "draft" ? "Drafting..." : "Reply with AI"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void handleMarkResponded()}
          className="rounded-full border border-emerald-200 bg-growth-50 px-3.5 py-2 text-sm font-semibold text-growth-600 transition-colors hover:bg-emerald-100 disabled:opacity-60"
        >
          {busy === "mark" ? "Updating..." : "Mark Responded"}
        </button>
        {review.google_review_url && (
          <a
            href={review.google_review_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            View on Google
          </a>
        )}
      </div>
    </article>
  );
}
