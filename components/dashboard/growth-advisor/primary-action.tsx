"use client";

import Link from "next/link";
import { trackGrowthAdvisorEvent } from "@/lib/growth-advisor/clientAnalytics";
import type { HeadOfMarketingPrimaryAction } from "@/lib/head-of-marketing/types";

const RECOMMENDATION_ACTION_KINDS = new Set(["review_recommendation", "approve_weekly_package"]);

/** The one obvious CTA — tracks selection (and acceptance, when it's acting on the shown recommendation), then navigates normally. */
export function GrowthAdvisorPrimaryAction({
  action,
  recommendationId,
}: {
  action: HeadOfMarketingPrimaryAction;
  recommendationId?: string | null;
}) {
  return (
    <Link
      href={action.href}
      onClick={() => {
        trackGrowthAdvisorEvent("primary_action_selected", { section: action.kind });
        if (recommendationId && RECOMMENDATION_ACTION_KINDS.has(action.kind)) {
          trackGrowthAdvisorEvent("recommendation_accepted", { recommendationId });
        }
      }}
      className="hom-focusable motion-safe-lift inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#081426] px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426] sm:w-auto"
    >
      {action.label}
    </Link>
  );
}
