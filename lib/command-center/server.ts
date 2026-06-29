import { getCommandCenterPageDataForCurrentUser } from "@/lib/command-center/service";

export async function getCommandCenterPageData() {
  return getCommandCenterPageDataForCurrentUser();
}
