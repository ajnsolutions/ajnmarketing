import { BillingPage } from "@/components/dashboard/billing-page";

export const metadata = {
  title: "Billing",
  description: "Manage your plan, payment method, and billing history.",
};

export default function BillingRoute() {
  return <BillingPage />;
}
