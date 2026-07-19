import { MarketingMemoryPreferencesPage } from "@/components/dashboard/marketing-memory-preferences-page";

export const metadata = {
  title: "Marketing preferences",
  description: "Standing marketing instructions remembered for your business.",
};

export default function MarketingPreferencesRoute() {
  return <MarketingMemoryPreferencesPage />;
}
