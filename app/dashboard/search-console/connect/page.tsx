import { Suspense } from "react";
import { SearchConsoleConnectPage } from "@/components/dashboard/search-console-connect-page";
import { getSearchConsoleConnectPageData } from "@/lib/google-search-console-server";

export const metadata = {
  title: "Connect Search Console",
  description: "Connect Google Search Console so AJN can learn which searches bring people to your site.",
};

export default async function SearchConsoleConnectRoute() {
  const { status, properties } = await getSearchConsoleConnectPageData();

  return (
    <Suspense fallback={null}>
      <SearchConsoleConnectPage initialStatus={status} initialProperties={properties} />
    </Suspense>
  );
}
