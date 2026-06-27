import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OnboardingGuard } from "@/components/onboarding/onboarding-guard";
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

  return (
    <OnboardingGuard>
      <DashboardShell>{children}</DashboardShell>
    </OnboardingGuard>
  );
}
