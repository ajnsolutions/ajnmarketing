import { redirect } from "next/navigation";
import { DecisionIntelligencePage } from "@/components/dashboard/decision-intelligence-page";
import { getDecisionIntelligenceSummaryForCurrentUser } from "@/lib/decision-intelligence/service";

export const metadata = {
  title: "Decision Intelligence",
  description: "Why the plan changed, what evidence supports it, and what remains uncertain.",
};

export default async function DecisionIntelligenceRoute() {
  const result = await getDecisionIntelligenceSummaryForCurrentUser();
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    redirect("/dashboard");
  }

  return <DecisionIntelligencePage summary={result.summary} />;
}
