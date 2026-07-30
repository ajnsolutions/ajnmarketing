import { SmartUploadsPage } from "@/components/dashboard/smart-uploads-page";
import { getSmartUploadDashboardDataForCurrentUser } from "@/lib/smart-uploads/service";

export const metadata = {
  title: "Smart Uploads",
  description: "Upload business documents and see what the Business Brain learned from them.",
};

export default async function SmartUploadsRoute() {
  const data = await getSmartUploadDashboardDataForCurrentUser();

  return (
    <SmartUploadsPage
      initialDocuments={data.documents}
      initialFacts={data.facts}
      openAiConfigured={data.openAiConfigured}
    />
  );
}
