"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshAnalyticsIntelligence } from "@/lib/analytics-client";

export function AnalyticsRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);

    const { error: refreshError } = await refreshAnalyticsIntelligence();

    setRefreshing(false);

    if (refreshError) {
      setError(refreshError);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={refreshing}
        className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing Analytics..." : "Refresh Analytics Intelligence"}
      </button>
      {error && <p className="max-w-sm text-right text-sm text-rose-600">{error}</p>}
    </div>
  );
}
