import { NotificationsPage } from "@/components/dashboard/notifications-page";

export const metadata = {
  title: "Notifications",
  description:
    "Stay on top of approvals, reviews, performance updates, and account activity.",
};

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
