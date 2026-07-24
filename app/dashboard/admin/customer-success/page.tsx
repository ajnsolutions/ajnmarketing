import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { buildCustomerSuccessDashboard } from "@/lib/assisted-pilot/customerSuccessService";
import { CustomerSuccessDashboard } from "@/components/dashboard/customer-success-dashboard";

export const metadata = {
  title: "Customer Success",
  description: "Assisted pilot customer success dashboard for AJN Marketing operators.",
};

export default async function AdminCustomerSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/admin/customer-success");
  }
  if (!isAdminUserId(user.id)) {
    redirect("/dashboard/command-center");
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-navy-900">Customer Success</h1>
        <p className="text-sm text-text-muted">
          Service-role configuration is required to load multi-tenant pilot data. Ops remains
          available for health probes that do not need service role.
        </p>
      </div>
    );
  }

  const serviceClient = createServiceRoleClient();
  const data = await buildCustomerSuccessDashboard(serviceClient);

  return <CustomerSuccessDashboard data={data} />;
}
