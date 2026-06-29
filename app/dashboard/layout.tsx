import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardSessionContext } from "@/lib/dashboard/session-context";
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

  const session = await getDashboardSessionContext();

  return (
    <DashboardShell
      businessName={session.businessName}
      userName={session.userName}
      userInitials={session.userInitials}
    >
      {children}
    </DashboardShell>
  );
}
