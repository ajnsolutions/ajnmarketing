import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLog, AuditLogCreateInput } from "@/lib/audit-log/types";

const BLOCKED_METADATA_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "password",
  "prompt",
  "content",
  "website_content",
  "html",
]);

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_METADATA_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined || value === null) continue;

    if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}…`;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export async function insertAuditLog(
  supabase: SupabaseClient,
  input: AuditLogCreateInput
): Promise<AuditLog | null> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      status: input.status,
      metadata: sanitizeMetadata(input.metadata),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[AuditLog] Insert failed:", error.message);
    return null;
  }

  return data as AuditLog;
}

export async function getAuditLogsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[AuditLog] Fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as AuditLog[];
}
