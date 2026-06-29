import "server-only";

import { getApprovalDashboardData } from "@/lib/content-approval-server";
import { loadContentGenerationContextForUser } from "@/lib/content-generator/service";
import { getGoogleBusinessDashboardData } from "@/lib/google-business/server";
import { getMarketingAgentDashboardData } from "@/lib/marketing-agent-server";
import { getMarketingPlanPageData } from "@/lib/marketing-planner-server";
import { getPublishingDashboardData } from "@/lib/publishing-queue-server";
import {
  getAnalysisDisplayMeta,
  getWebsiteAnalysisForCurrentUser,
} from "@/lib/website-analysis-server";
import { createClient } from "@/lib/supabase/server";

export async function loadCommandCenterContext(userId: string) {
  const [
    generationContext,
    analysis,
    approvalData,
    taskData,
    gbpData,
    planData,
    publishingData,
  ] = await Promise.all([
    loadContentGenerationContextForUser(userId),
    getWebsiteAnalysisForCurrentUser(),
    getApprovalDashboardData(),
    getMarketingAgentDashboardData(),
    getGoogleBusinessDashboardData(),
    getMarketingPlanPageData(),
    getPublishingDashboardData(),
  ]);

  const analysisMeta = getAnalysisDisplayMeta(analysis);

  return {
    userId,
    generationContext,
    analysis,
    analysisMeta,
    approvalStats: approvalData.stats,
    approvals: approvalData.approvals.slice(0, 8),
    taskData,
    gbpData,
    planData,
    publishingStats: publishingData.stats,
    publishingItems: publishingData.items.slice(0, 8),
  };
}

export async function loadCommandCenterContextForCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return loadCommandCenterContext(user.id);
}
