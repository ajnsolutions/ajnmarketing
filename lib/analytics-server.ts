import {
  getAnalyticsPageDataForCurrentUser,
  runAnalyticsFeedbackLoopForUser,
} from "@/lib/analytics/analyticsEngine";
import { createClient } from "@/lib/supabase/server";

export async function getAnalyticsPageData() {
  return getAnalyticsPageDataForCurrentUser();
}

export async function refreshAnalyticsForCurrentUser(): Promise<{
  pageData: Awaited<ReturnType<typeof getAnalyticsPageData>>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { pageData: null, error: "Unauthorized" };
  }

  try {
    await runAnalyticsFeedbackLoopForUser(user.id);
    const pageData = await getAnalyticsPageData();
    return { pageData };
  } catch {
    return { pageData: null, error: "Unable to refresh analytics intelligence" };
  }
}
