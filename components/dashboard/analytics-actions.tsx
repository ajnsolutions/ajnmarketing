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
        aria-busy={refreshing}
        className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing results…" : "Refresh results"}
      </button>
      {refreshing ? (
        <p className="max-w-sm text-right text-xs text-text-muted" aria-live="polite">
          Checking for newer wins — usually a few seconds.
        </p>
      ) : null}
      {error && (
        <p className="max-w-sm text-right text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
