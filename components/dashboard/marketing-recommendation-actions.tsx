"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRecommendationContentDraft } from "@/lib/marketing-decisions-client";
import type { RecommendationDraftAction } from "@/lib/marketing-decisions/ui";

type MarketingRecommendationActionsProps = {
  recommendationId: string;
  draftAction: RecommendationDraftAction;
  linkedDraftTitle?: string | null;
};

export function MarketingRecommendationActions({
  recommendationId,
  draftAction,
  linkedDraftTitle,
}: MarketingRecommendationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSuccessTitle(null);

    const { result, error: createError } = await createRecommendationContentDraft(
      recommendationId
    );

    setLoading(false);

    if (createError || !result) {
      setError(createError ?? "Unable to create a draft right now. Please try again.");
      return;
    }

    setSuccessTitle(result.title);
    router.refresh();
  }

  if (draftAction === "manual") {
    return null;
  }

  if (draftAction === "view") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/approvals"
          className="inline-flex rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          View Draft in Approval Center
        </Link>
        {linkedDraftTitle && (
          <p className="text-sm text-text-muted">
            Draft: <span className="font-medium text-navy-900">{linkedDraftTitle}</span>
          </p>
        )}
      </div>
    );
  }

  const label =
    draftAction === "regenerate"
      ? loading
        ? "Creating new draft..."
        : "Regenerate Draft"
      : loading
        ? "Creating draft..."
        : "Generate Draft";

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleGenerate()}
        aria-busy={loading}
        className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>

      {loading && (
        <p className="text-sm text-text-muted" aria-live="polite">
          Writing a draft based on this recommendation. This usually takes a few seconds…
        </p>
      )}

      {successTitle && (
        <div
          className="rounded-xl border border-emerald-200 bg-growth-50 px-3 py-2 text-sm text-growth-600"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">Draft ready: {successTitle}</p>
          <Link
            href="/dashboard/approvals"
            className="mt-1 inline-block font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Review in Approval Center →
          </Link>
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
