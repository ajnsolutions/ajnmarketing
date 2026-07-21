import { CommandCenterPage } from "@/components/dashboard/command-center-page";
import { DashboardSetupCard } from "@/components/dashboard/dashboard-setup-card";
import { getCommandCenterPageData } from "@/lib/command-center/server";
import {
  getCustomerSetupSnapshotForCurrentUser,
  shouldShowDashboardSetupCard,
} from "@/lib/customer-setup/service";

export const metadata = {
  title: "Command Center",
  description:
    "AI Marketing Command Center — executive summary, priorities, health scores, and recommended actions.",
};

export default async function CommandCenterRoute() {
  const [data, setup] = await Promise.all([
    getCommandCenterPageData(),
    getCustomerSetupSnapshotForCurrentUser(),
  ]);
  const showSetupCard = setup ? shouldShowDashboardSetupCard(setup) : false;

  return (
    <>
      {showSetupCard && setup ? (
        <div className="mb-8">
          <DashboardSetupCard snapshot={setup} />
        </div>
      ) : null}
      <CommandCenterPage data={data} />
    </>
  );
}
