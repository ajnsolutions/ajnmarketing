import { SettingsHub } from "@/components/dashboard/settings-hub";

export const metadata = {
  title: "Settings",
  description: "Configure how your Growth Advisor works with your business.",
};

export default function SettingsRoute() {
  return <SettingsHub />;
}
