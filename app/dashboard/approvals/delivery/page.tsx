import { ApprovalsDeliveryPage } from "@/components/dashboard/approvals-delivery-page";

export const metadata = {
  title: "Email & SMS Approval Delivery",
  description: "Preview how AJN sends approval requests to business owners.",
};

export default function ApprovalsDeliveryRoute() {
  return <ApprovalsDeliveryPage />;
}
