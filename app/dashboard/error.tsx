"use client";

import { useEffect } from "react";
import { DashboardErrorState } from "@/components/dashboard/ui/dashboard-states";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard]", error);
  }, [error]);

  return (
    <DashboardErrorState
      title="Dashboard unavailable"
      description="We couldn't load this dashboard section. Please try again."
      onRetry={reset}
    />
  );
}
