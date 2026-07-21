import { redirect } from "next/navigation";
import { FirstDaysHome } from "@/components/dashboard/first-days-home";
import { HeadOfMarketingPage } from "@/components/dashboard/head-of-marketing-page";
import { SetupHomReadinessPanel } from "@/components/dashboard/setup-hom-readiness";
import { getFirstDaysHomeForCurrentUser } from "@/lib/dashboard/first-days-home-server";
import {
  getCustomerSetupSnapshotForCurrentUser,
} from "@/lib/customer-setup/service";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";

export default async function DashboardPage() {
  const [briefing, firstDays, setup] = await Promise.all([
    getHeadOfMarketingBriefingForCurrentUser(),
    getFirstDaysHomeForCurrentUser(),
    getCustomerSetupSnapshotForCurrentUser(),
  ]);

  // Brand-new setups keep the First Five Minutes calm path until foundations exist.
  if (firstDays?.isEarlyCustomer && firstDays.primaryAction.kind === "connect_google") {
    return <FirstDaysHome model={firstDays} />;
  }

  if (briefing) {
    return <HeadOfMarketingPage briefing={briefing} />;
  }

  // Honest readiness gate — never invent strategy when setup is insufficient.
  if (setup && !setup.headOfMarketingReady) {
    return <SetupHomReadinessPanel snapshot={setup} />;
  }

  if (firstDays) {
    return <FirstDaysHome model={firstDays} />;
  }

  redirect("/dashboard/command-center");
}
