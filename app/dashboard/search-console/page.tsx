import { SearchConsolePage } from "@/components/dashboard/search-console-page";
import { getSearchConsoleDashboardDataForCurrentUser } from "@/lib/google-search-console/dashboard";

export const metadata = {
  title: "Search Console",
  description: "Search performance evidence for your Business Brain.",
};

export default async function SearchConsoleRoute() {
  const data = await getSearchConsoleDashboardDataForCurrentUser();
  return <SearchConsolePage data={data} />;
}
