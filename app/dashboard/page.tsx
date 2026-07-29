import { redirect } from "next/navigation";
import { FirstDaysHome } from "@/components/dashboard/first-days-home";
import { GrowthAdvisorPage } from "@/components/dashboard/growth-advisor/growth-advisor-page";
import { SetupHomReadinessPanel } from "@/components/dashboard/setup-hom-readiness";
import { getFirstDaysHomeForCurrentUser } from "@/lib/dashboard/first-days-home-server";
import {
  getCustomerSetupSnapshotForCurrentUser,
} from "@/lib/customer-setup/service";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import { runBusinessDiscoveryForCurrentUser } from "@/lib/business-discovery/service";
import { buildGrowthAdvisorBriefing } from "@/lib/growth-advisor/buildGrowthAdvisorBriefing";
import { getBusinessGoalsForCurrentUser } from "@/lib/goals/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";

export default async function DashboardPage() {
  const [briefing, firstDays, setup, goals] = await Promise.all([
    getHeadOfMarketingBriefingForCurrentUser(),
    getFirstDaysHomeForCurrentUser(),
    getCustomerSetupSnapshotForCurrentUser(),
    getBusinessGoalsForCurrentUser(),
  ]);

  // Brand-new setups keep the First Five Minutes calm path until foundations exist.
  if (firstDays?.isEarlyCustomer && firstDays.primaryAction.kind === "connect_google") {
    return <FirstDaysHome model={firstDays} />;
  }

  if (briefing) {
    // Business Discovery personalizes "What I noticed" honestly when there's
    // a real signal — never required, never blocks the page if unavailable.
    // Customer Voice is presentation-only enrichment of the same pipeline.
    const [businessDiscovery, profile] = await Promise.all([
      runBusinessDiscoveryForCurrentUser().catch(() => null),
      getBusinessProfileForUser().catch(() => null),
    ]);

    const customerVoice = profile
      ? await getCustomerVoiceIntelligence({
          userId: profile.user_id,
          businessProfileId: profile.id,
        }).catch(() => null)
      : null;

    const advisor = buildGrowthAdvisorBriefing(briefing, businessDiscovery, {
      goals,
      customerVoice,
    });
    return <GrowthAdvisorPage advisor={advisor} briefing={briefing} />;
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
