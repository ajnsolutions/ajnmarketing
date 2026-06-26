import { ApprovalsPage } from "@/components/dashboard/approvals-page";

export const metadata = {
  title: "Approval Center",
  description:
    "Review and approve everything AJN AI has prepared for your business.",
};

export default function ApprovalsRoute() {
  return <ApprovalsPage />;
}
