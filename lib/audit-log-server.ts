import "server-only";

import { headers } from "next/headers";
import { getAuditLogsForUser } from "@/lib/audit-log/persistence";
import { auditErrorMetadata, logAuditEvent } from "@/lib/audit-log/service";
import type { AuditRequestContext } from "@/lib/audit-log/types";
import { AuditActions } from "@/lib/audit-log/types";
import { createClient } from "@/lib/supabase/server";

export { AuditActions, auditErrorMetadata, logAuditEvent };
export type { AuditLogCreateInput, AuditRequestContext } from "@/lib/audit-log/types";

export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  const headerList = await headers();

  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      null,
    userAgent: headerList.get("user-agent"),
  };
}

export async function getAuditLogsForCurrentUser(limit = 50) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  return getAuditLogsForUser(supabase, user.id, limit);
}
