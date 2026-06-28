"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { queueWebsiteAnalysis } from "@/lib/website-analysis-client";

export function WebsiteAnalysisPoller({ shouldPoll }: { shouldPoll: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldPoll) return;

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [shouldPoll, router]);

  return null;
}

export function WebsiteAnalysisRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await queueWebsiteAnalysis();
    router.refresh();
    setRefreshing(false);
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {refreshing ? "Analyzing..." : "Refresh Analysis"}
    </button>
  );
}
