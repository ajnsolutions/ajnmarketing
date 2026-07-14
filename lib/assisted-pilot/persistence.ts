import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultChecklistItems,
  mergeChecklistState,
} from "@/lib/assisted-pilot/checklist";
import type {
  PilotBusinessStatus,
  PilotChecklistStageKey,
  PilotIssue,
  PilotIssueCategory,
  PilotIssueSeverity,
  PilotIssueStatus,
  PilotManualActionKey,
  PilotManualActionRun,
  PilotStageStatus,
} from "@/lib/assisted-pilot/types";

export type PilotBusinessRow = {
  id: string;
  user_id: string;
  business_profile_id: string;
  display_name: string;
  status: PilotBusinessStatus;
  start_date: string;
  current_cycle: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listPilotBusinesses(supabase: SupabaseClient): Promise<PilotBusinessRow[]> {
  const { data, error } = await supabase
    .from("pilot_businesses")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PilotBusinessRow[];
}

export async function getPilotBusinessById(
  supabase: SupabaseClient,
  id: string
): Promise<PilotBusinessRow | null> {
  const { data, error } = await supabase
    .from("pilot_businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PilotBusinessRow | null) ?? null;
}

export async function upsertPilotBusiness(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    displayName: string;
    status?: PilotBusinessStatus;
    startDate?: string;
    currentCycle?: number;
    notes?: string | null;
  }
): Promise<PilotBusinessRow> {
  const { data, error } = await supabase
    .from("pilot_businesses")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        display_name: input.displayName,
        status: input.status ?? "active",
        start_date: input.startDate,
        current_cycle: input.currentCycle ?? 1,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_profile_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const pilot = data as PilotBusinessRow;
  await ensureChecklistRows(supabase, pilot.id);
  return pilot;
}

export async function ensureChecklistRows(
  supabase: SupabaseClient,
  pilotBusinessId: string
): Promise<void> {
  const defaults = defaultChecklistItems();
  const rows = defaults.map((item) => ({
    pilot_business_id: pilotBusinessId,
    stage_key: item.stageKey,
    status: item.status,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("pilot_checklist_items")
    .upsert(rows, { onConflict: "pilot_business_id,stage_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function listChecklistItems(
  supabase: SupabaseClient,
  pilotBusinessId: string
) {
  await ensureChecklistRows(supabase, pilotBusinessId);
  const { data, error } = await supabase
    .from("pilot_checklist_items")
    .select("stage_key, status, started_at, finished_at, error_message")
    .eq("pilot_business_id", pilotBusinessId);
  if (error) throw new Error(error.message);
  return mergeChecklistState(data ?? []);
}

export async function updateChecklistStage(
  supabase: SupabaseClient,
  pilotBusinessId: string,
  stageKey: PilotChecklistStageKey,
  status: PilotStageStatus,
  errorMessage: string | null = null
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
    error_message: errorMessage,
  };
  if (status === "running") {
    patch.started_at = now;
    patch.finished_at = null;
    patch.error_message = null;
  } else if (status === "completed" || status === "failed" || status === "blocked") {
    patch.finished_at = now;
  } else if (status === "pending") {
    patch.started_at = null;
    patch.finished_at = null;
    patch.error_message = null;
  }

  const { error } = await supabase
    .from("pilot_checklist_items")
    .upsert(
      {
        pilot_business_id: pilotBusinessId,
        stage_key: stageKey,
        ...patch,
      },
      { onConflict: "pilot_business_id,stage_key" }
    );
  if (error) throw new Error(error.message);
}

export async function listPilotIssues(
  supabase: SupabaseClient,
  pilotBusinessId?: string
): Promise<PilotIssue[]> {
  let query = supabase.from("pilot_issues").select("*").order("created_at", { ascending: false });
  if (pilotBusinessId) query = query.eq("pilot_business_id", pilotBusinessId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIssue);
}

export async function createPilotIssue(
  supabase: SupabaseClient,
  input: {
    pilotBusinessId?: string | null;
    severity: PilotIssueSeverity;
    category: PilotIssueCategory;
    workflowStage?: string | null;
    description: string;
    owner?: string | null;
  }
): Promise<PilotIssue> {
  const { data, error } = await supabase
    .from("pilot_issues")
    .insert({
      pilot_business_id: input.pilotBusinessId ?? null,
      severity: input.severity,
      category: input.category,
      workflow_stage: input.workflowStage ?? null,
      description: input.description,
      owner: input.owner ?? null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapIssue(data);
}

export async function updatePilotIssue(
  supabase: SupabaseClient,
  id: string,
  patch: {
    status?: PilotIssueStatus;
    owner?: string | null;
    resolution?: string | null;
    severity?: PilotIssueSeverity;
  }
): Promise<PilotIssue> {
  const { data, error } = await supabase
    .from("pilot_issues")
    .update({
      ...("status" in patch ? { status: patch.status } : {}),
      ...("owner" in patch ? { owner: patch.owner } : {}),
      ...("resolution" in patch ? { resolution: patch.resolution } : {}),
      ...("severity" in patch ? { severity: patch.severity } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapIssue(data);
}

export async function startManualActionRun(
  supabase: SupabaseClient,
  input: {
    pilotBusinessId: string;
    actionKey: PilotManualActionKey | string;
    triggeredBy: string | null;
  }
): Promise<PilotManualActionRun> {
  const { data, error } = await supabase
    .from("pilot_manual_action_runs")
    .insert({
      pilot_business_id: input.pilotBusinessId,
      action_key: input.actionKey,
      triggered_by: input.triggeredBy,
      result: "running",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data);
}

export async function finishManualActionRun(
  supabase: SupabaseClient,
  id: string,
  result: "success" | "failure" | "skipped",
  errorMessage: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<PilotManualActionRun> {
  const finishedAt = new Date();
  const { data: existing } = await supabase
    .from("pilot_manual_action_runs")
    .select("started_at")
    .eq("id", id)
    .maybeSingle();
  const startedAt = existing?.started_at ? new Date(existing.started_at as string) : finishedAt;
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  const { data, error } = await supabase
    .from("pilot_manual_action_runs")
    .update({
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      result,
      error_message: errorMessage,
      metadata,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data);
}

export async function listRecentManualRuns(
  supabase: SupabaseClient,
  pilotBusinessId: string,
  limit = 8
): Promise<PilotManualActionRun[]> {
  const { data, error } = await supabase
    .from("pilot_manual_action_runs")
    .select("*")
    .eq("pilot_business_id", pilotBusinessId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRun);
}

function mapIssue(row: Record<string, unknown>): PilotIssue {
  return {
    id: String(row.id),
    pilotBusinessId: (row.pilot_business_id as string | null) ?? null,
    severity: row.severity as PilotIssue["severity"],
    category: row.category as PilotIssue["category"],
    workflowStage: (row.workflow_stage as string | null) ?? null,
    description: String(row.description),
    status: row.status as PilotIssue["status"],
    owner: (row.owner as string | null) ?? null,
    resolution: (row.resolution as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRun(row: Record<string, unknown>): PilotManualActionRun {
  return {
    id: String(row.id),
    pilotBusinessId: String(row.pilot_business_id),
    actionKey: String(row.action_key),
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? null,
    result: row.result as PilotManualActionRun["result"],
    errorMessage: (row.error_message as string | null) ?? null,
  };
}
