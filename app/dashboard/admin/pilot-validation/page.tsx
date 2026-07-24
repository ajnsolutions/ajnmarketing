import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { buildPilotValidationDashboard } from "@/lib/assisted-pilot/pilotValidationService";
import { PilotValidationDashboard } from "@/components/dashboard/pilot-validation-dashboard";

export const metadata = {
  title: "Pilot Validation",
  description: "Pilot validation and production go-live readiness for AJN Marketing operators.",
};

export default async function AdminPilotValidationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/admin/pilot-validation");
  }
  if (!isAdminUserId(user.id)) {
    redirect("/dashboard/command-center");
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-navy-900">Pilot Validation</h1>
        <p className="text-sm text-text-muted">
          Service-role configuration is required to load multi-tenant validation state. Ops remains
          available for configuration probes that do not need service role.
        </p>
      </div>
    );
  }

  const serviceClient = createServiceRoleClient();
  const data = await buildPilotValidationDashboard(serviceClient);

  return <PilotValidationDashboard data={data} />;
}
