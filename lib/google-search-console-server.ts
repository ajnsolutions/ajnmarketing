import {
  getGoogleSearchConsoleConnectionStatusForCurrentUser,
  listSearchConsolePropertiesForCurrentUser,
} from "@/lib/google-search-console/service";

export async function getSearchConsoleConnectPageData() {
  const [status, properties] = await Promise.all([
    getGoogleSearchConsoleConnectionStatusForCurrentUser(),
    listSearchConsolePropertiesForCurrentUser(),
  ]);

  return { status, properties };
}
