import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { getCustomerSetupSnapshotForCurrentUser } from "@/lib/customer-setup/service";
import { redirect } from "next/navigation";

export default async function SetupPage() {
  const snapshot = await getCustomerSetupSnapshotForCurrentUser();
  if (!snapshot) {
    redirect("/onboarding");
  }

  return <SetupChecklist initialSnapshot={snapshot} />;
}
