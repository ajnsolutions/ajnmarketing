import { getGoogleBusinessProfileConnectionStatusForCurrentUser } from "@/lib/google-business-profile/service";

export async function getGoogleBusinessProfileConnectPageData() {
  return getGoogleBusinessProfileConnectionStatusForCurrentUser();
}
