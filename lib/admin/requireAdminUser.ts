import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/admin/isAdminUser";

export type RequireAdminUserResult = { user: User } | { error: NextResponse };

/**
 * Shared auth gate for every app/api/admin/** route: requires a signed-in session AND
 * membership in the ADMIN_USER_IDS allowlist (see lib/admin/isAdminUser.ts), returning
 * the same 401/403 JSON shape every admin route already relied on before this was
 * extracted from per-route copies.
 */
export async function requireAdminUser(): Promise<RequireAdminUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminUserId(user.id)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
