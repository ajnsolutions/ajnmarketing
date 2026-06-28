"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshAiMarketingProfile } from "@/lib/ai-marketing-profile-client";

export function AiMarketingProfileRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshAiMarketingProfile();
    router.refresh();
    setRefreshing(false);
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {refreshing ? "Refreshing..." : "Refresh AI Profile"}
    </button>
  );
}
