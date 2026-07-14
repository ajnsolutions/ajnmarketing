import "server-only";

import { randomUUID } from "crypto";

export type WorkflowLogResult = "success" | "failure" | "skipped" | "retrying";

export type WorkflowLogFields = {
  correlationId: string;
  tenantUserId?: string | null;
  businessProfileId?: string | null;
  pipelineStage: string;
  durationMs?: number;
  result: WorkflowLogResult;
  retryCount?: number;
  failureCategory?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
};

const BLOCKED_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "password",
  "authorization",
  "prompt",
  "content",
  "website_content",
  "html",
  "ai_draft_reply",
  "service_role",
  "supabase_secret_key",
]);

export function createCorrelationId(): string {
  return randomUUID();
}

export function sanitizeWorkflowMetadata(
  metadata: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> {
  if (!metadata) return {};
  if (depth > 3) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.length > 300) {
      out[key] = `${value.slice(0, 300)}…`;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeWorkflowMetadata(value as Record<string, unknown>, depth + 1);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Structured workflow logger for production ops. Never logs OAuth tokens,
 * service-role secrets, prompts, or private draft content.
 */
export function logWorkflow(fields: WorkflowLogFields): void {
  const payload = {
    scope: "workflow",
    correlationId: fields.correlationId,
    tenantUserId: fields.tenantUserId ?? null,
    businessProfileId: fields.businessProfileId ?? null,
    pipelineStage: fields.pipelineStage,
    durationMs: fields.durationMs ?? null,
    result: fields.result,
    retryCount: fields.retryCount ?? 0,
    failureCategory: fields.failureCategory ?? null,
    message: fields.message ?? null,
    metadata: sanitizeWorkflowMetadata(fields.metadata),
  };

  if (fields.result === "failure") {
    console.error("[Workflow]", payload);
    return;
  }
  console.info("[Workflow]", payload);
}

export async function withWorkflowTiming<T>(
  fields: Omit<WorkflowLogFields, "durationMs" | "result"> & {
    resultOnSuccess?: WorkflowLogResult;
  },
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    const value = await fn();
    logWorkflow({
      ...fields,
      durationMs: Date.now() - started,
      result: fields.resultOnSuccess ?? "success",
    });
    return value;
  } catch (error) {
    logWorkflow({
      ...fields,
      durationMs: Date.now() - started,
      result: "failure",
      failureCategory: fields.failureCategory ?? "unhandled",
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown_error",
    });
    throw error;
  }
}
