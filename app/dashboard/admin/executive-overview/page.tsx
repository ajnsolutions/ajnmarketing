import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { getAdminExecutiveOverviewForCurrentAdmin } from "@/lib/head-of-marketing-orchestrator/service";
import { AdminExecutiveOverviewDashboard } from "@/components/dashboard/admin-executive-overview";

export const metadata = {
  title: "Executive Overview",
  description: "Cross-business rollup of the Head of Marketing Orchestrator for AJN Marketing operators.",
};

export default async function AdminExecutiveOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/admin/executive-overview");
  }
  if (!isAdminUserId(user.id)) {
    redirect("/dashboard/command-center");
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-navy-900">Executive Overview</h1>
        <p className="text-sm text-text-muted">
          Service-role configuration is required to load multi-tenant data.
        </p>
      </div>
    );
  }

  const overview = await getAdminExecutiveOverviewForCurrentAdmin();
  if (!overview) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-navy-900">Executive Overview</h1>
        <p className="text-sm text-text-muted">No data available right now.</p>
      </div>
    );
  }

  return <AdminExecutiveOverviewDashboard overview={overview} />;
}
