import { ContentGeneratorPage } from "@/components/dashboard/content-generator-page";

export const metadata = {
  title: "AI Content Generator",
  description:
    "Generate ready-to-review marketing content using your business profile, brand voice, and local market context.",
};

export default function ContentGeneratorRoute() {
  return <ContentGeneratorPage />;
}
