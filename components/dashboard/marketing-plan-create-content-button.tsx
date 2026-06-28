"use client";

import Link from "next/link";
import { useState } from "react";
import { createMarketingPlanContent } from "@/lib/marketing-planner-client";
import type { MarketingPlanCreateContentInput } from "@/lib/marketing-planner/types";

type CreateContentButtonProps = {
  itemKey: string;
  input: MarketingPlanCreateContentInput;
};

export function MarketingPlanCreateContentButton({ itemKey, input }: CreateContentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCreateContent() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { result, error: createError } = await createMarketingPlanContent(input);

    setLoading(false);

    if (createError || !result) {
      setError(createError ?? "Unable to create content");
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleCreateContent()}
        className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating Content..." : "Create Content"}
      </button>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-growth-50 px-3 py-2 text-sm text-growth-600">
          <p className="font-medium">Content created and sent to Approval Center.</p>
          <Link
            href="/dashboard/approvals"
            className="mt-1 inline-block font-semibold text-brand-700 hover:text-brand-800"
          >
            View in Approval Center →
          </Link>
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-600" data-item-key={itemKey}>
          {error}
        </p>
      )}
    </div>
  );
}
