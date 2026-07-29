import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { GuidedSetupExperiencePage } from "@/components/dashboard/guided-setup-experience";
import { getCustomerSetupSnapshotForCurrentUser } from "@/lib/customer-setup/service";
import { getGuidedSetupExperienceForCurrentUser } from "@/lib/guided-setup/service";
import { redirect } from "next/navigation";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const showChecklist = params.view === "checklist";

  if (showChecklist) {
    const snapshot = await getCustomerSetupSnapshotForCurrentUser();
    if (!snapshot) {
      redirect("/onboarding");
    }
    return <SetupChecklist initialSnapshot={snapshot} />;
  }

  const experience = await getGuidedSetupExperienceForCurrentUser();
  if (!experience) {
    redirect("/onboarding");
  }

  return <GuidedSetupExperiencePage experience={experience} />;
}
