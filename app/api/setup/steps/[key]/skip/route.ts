import { NextResponse } from "next/server";
import { isSetupStepKey } from "@/lib/customer-setup/steps";
import { skipCustomerSetupStepForCurrentUser } from "@/lib/customer-setup/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  if (!isSetupStepKey(key)) {
    return NextResponse.json({ error: "Unknown setup step." }, { status: 400 });
  }

  const result = await skipCustomerSetupStepForCurrentUser({ stepKey: key });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ setup: result.snapshot });
}
