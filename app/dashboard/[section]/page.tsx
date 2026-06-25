import { DashboardSectionPlaceholder } from "@/components/dashboard/dashboard-section-placeholder";

const sectionTitles: Record<string, string> = {
  gbp: "Google Business Profile",
  content: "Content",
  reviews: "Reviews",
  "market-context": "Market Context",
  analytics: "Analytics",
  billing: "Billing",
  settings: "Settings",
};

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = sectionTitles[section] ?? "Dashboard";

  return <DashboardSectionPlaceholder title={title} />;
}
