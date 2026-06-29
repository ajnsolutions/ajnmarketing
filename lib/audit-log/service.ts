import "server-only";

import { insertAuditLog } from "@/lib/audit-log/persistence";
import type { AuditLogCreateInput, AuditRequestContext } from "@/lib/audit-log/types";
import { sanitizeUserErrorMessage } from "@/lib/security/safe-error-message";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAuditEvent(
  supabase: SupabaseClient,
  input: AuditLogCreateInput,
  requestContext?: AuditRequestContext
): Promise<void> {
  try {
    await insertAuditLog(supabase, {
      ...input,
      ipAddress: input.ipAddress ?? requestContext?.ipAddress ?? null,
      userAgent: input.userAgent ?? requestContext?.userAgent ?? null,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error(
      "[AuditLog] Failed to write audit log:",
      error instanceof Error ? error.message : error
    );
  }
}

export function auditErrorMetadata(error: unknown, fallback: string): Record<string, unknown> {
  const message =
    error instanceof Error
      ? sanitizeUserErrorMessage(error.message, fallback)
      : sanitizeUserErrorMessage(String(error), fallback);

  return { error: message };
}
