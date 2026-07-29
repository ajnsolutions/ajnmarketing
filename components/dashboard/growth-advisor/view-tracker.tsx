"use client";

import { useEffect } from "react";
import { trackGrowthAdvisorEvent } from "@/lib/growth-advisor/clientAnalytics";

/** Fires the page-view event once, client-side, after the server-rendered page mounts. */
export function GrowthAdvisorViewTracker() {
  useEffect(() => {
    trackGrowthAdvisorEvent("growth_advisor_viewed");
  }, []);

  return null;
}
