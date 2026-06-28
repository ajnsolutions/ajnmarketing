import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isOnboardingCompleteForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard",
  description: "AJN Marketing customer dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onboardingComplete = await isOnboardingCompleteForUser();

  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
