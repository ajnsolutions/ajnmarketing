import {
  formatAnalysisStatus,
  formatRelativeTime,
  getWebsiteAnalysisForUser,
} from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { createClient } from "@/lib/supabase/server";

export async function getWebsiteAnalysisForCurrentUser(): Promise<WebsiteAnalysis | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getWebsiteAnalysisForUser(supabase, user.id);
}

export function getAnalysisDisplayMeta(analysis: WebsiteAnalysis | null) {
  return {
    statusLabel: formatAnalysisStatus(analysis?.analysis_status),
    lastAnalyzed: formatRelativeTime(analysis?.updated_at ?? analysis?.created_at),
    score: analysis?.analysis_score ?? null,
    seoScore: analysis?.seo_score ?? null,
    isAnalyzing:
      analysis?.analysis_status === "pending" || analysis?.analysis_status === "running",
    isComplete: analysis?.analysis_status === "completed",
    isFailed: analysis?.analysis_status === "failed",
  };
}
