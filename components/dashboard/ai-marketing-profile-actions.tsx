"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshAiMarketingProfile } from "@/lib/ai-marketing-profile-client";

export function AiMarketingProfileRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);

    const result = await refreshAiMarketingProfile();

    if (result.error) {
      setError(result.error);
    }

    router.refresh();
    setRefreshing(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing..." : "Refresh AI Profile"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-sm font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
