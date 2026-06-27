import { SettingsPage } from "@/components/dashboard/settings-page";

export const metadata = {
  title: "Settings",
  description:
    "Manage your business profile, notifications, brand voice, and connected platforms.",
};

export default function SettingsRoute() {
  return <SettingsPage />;
}
