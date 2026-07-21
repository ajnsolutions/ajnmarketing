import { NextResponse } from "next/server";
import { getCustomerSetupSnapshotForCurrentUser } from "@/lib/customer-setup/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getCustomerSetupSnapshotForCurrentUser();
  if (!snapshot) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  return NextResponse.json({ setup: snapshot });
}
