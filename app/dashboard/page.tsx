import { DashboardHome } from "@/components/dashboard/dashboard-home";
import {
  getAnalysisDisplayMeta,
  getWebsiteAnalysisForCurrentUser,
} from "@/lib/website-analysis-server";

export default async function DashboardPage() {
  const analysis = await getWebsiteAnalysisForCurrentUser();
  const analysisMeta = getAnalysisDisplayMeta(analysis);

  return <DashboardHome analysisMeta={analysisMeta} />;
}
