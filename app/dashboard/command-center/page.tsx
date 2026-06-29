import { CommandCenterPage } from "@/components/dashboard/command-center-page";
import { getCommandCenterPageData } from "@/lib/command-center/server";

export const metadata = {
  title: "Command Center",
  description:
    "AI Marketing Command Center — executive summary, priorities, health scores, and recommended actions.",
};

export default async function CommandCenterRoute() {
  const data = await getCommandCenterPageData();
  return <CommandCenterPage data={data} />;
}
