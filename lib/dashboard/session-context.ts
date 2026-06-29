import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";

function getInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }

  const local = email.split("@")[0] ?? "U";
  return local.slice(0, 2).toUpperCase();
}

export async function getDashboardSessionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getBusinessProfileForUser();

  const businessName = profile?.business_name?.trim() || "Your Business";
  const userEmail = user?.email ?? "";
  const userName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.name as string | undefined)?.trim() ||
    userEmail.split("@")[0] ||
    "Account";

  return {
    businessName,
    userEmail,
    userName,
    userInitials: getInitials(userName, userEmail),
  };
}
