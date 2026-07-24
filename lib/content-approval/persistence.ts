import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentApproval,
  ContentApprovalCreateInput,
  ContentApprovalStats,
  ContentApprovalStatus,
} from "@/lib/content-approval/types";

export function formatApprovalStatus(status: ContentApprovalStatus | null | undefined): string {
  // Customer-facing labels (Phase 4B). Internal statuses unchanged.
  switch (status) {
    case "pending":
      return "Needs your opinion";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "published":
      return "Published";
    default:
      return "Unknown";
  }
}

export function formatApprovalDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

export async function getContentApprovalsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ContentApproval[]> {
  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ContentApproval[];
}

export async function getContentApprovalById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ContentApproval | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as ContentApproval;
}

export async function createContentApproval(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    data: ContentApprovalCreateInput;
    version?: number;
  }
): Promise<ContentApproval | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      content_type: input.data.content_type,
      title: input.data.title,
      content: input.data.content,
      status: "pending",
      source: input.data.source ?? "content_generator",
      version: input.version ?? 1,
      ai_score: input.data.ai_score ?? null,
      notes: input.data.notes ?? null,
      marketing_recommendation_id: input.data.marketing_recommendation_id ?? null,
    })
    .select("*")
    .single();

  if (error) return null;
  return data as ContentApproval;
}

const ACTIVE_RECOMMENDATION_DRAFT_STATUSES = ["pending", "approved", "published"] as const;

/**
 * Returns the active (non-rejected) draft linked to a recommendation for this user.
 * Ownership is enforced via user_id — never trust the FK alone.
 */
export async function getActiveContentApprovalForRecommendation(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<ContentApproval | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("user_id", userId)
    .eq("marketing_recommendation_id", recommendationId)
    .in("status", [...ACTIVE_RECOMMENDATION_DRAFT_STATUSES])
    .maybeSingle();

  if (error || !data) return null;
  return data as ContentApproval;
}

export type CreateContentApprovalResult =
  | { approval: ContentApproval; uniqueViolation: false }
  | { approval: null; uniqueViolation: true; error: { code?: string; message?: string } }
  | { approval: null; uniqueViolation: false; error: { code?: string; message?: string } };

/**
 * Insert path used by recommendation-to-content drafting. Surfaces unique-constraint
 * races (partial unique index on active marketing_recommendation_id) so callers can
 * re-query and return the winning draft.
 */
export async function createContentApprovalWithConflict(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    data: ContentApprovalCreateInput;
    version?: number;
  }
): Promise<CreateContentApprovalResult> {
  const { data, error } = await supabase
    .from("content_approvals")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      content_type: input.data.content_type,
      title: input.data.title,
      content: input.data.content,
      status: "pending",
      source: input.data.source ?? "content_generator",
      version: input.version ?? 1,
      ai_score: input.data.ai_score ?? null,
      notes: input.data.notes ?? null,
      marketing_recommendation_id: input.data.marketing_recommendation_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      // content_approvals has exactly one other unique constraint besides this: the
      // primary key (id, a gen_random_uuid()). A 23505 here is assumed to be the
      // partial unique index on active marketing_recommendation_id (the only
      // realistic source given normal insert volume) -- a PK collision would also
      // raise 23505 but is astronomically unlikely and not specifically handled.
      return { approval: null, uniqueViolation: true, error };
    }
    return { approval: null, uniqueViolation: false, error };
  }

  return { approval: data as ContentApproval, uniqueViolation: false };
}

export async function updateContentApproval(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      ContentApproval,
      | "title"
      | "content"
      | "status"
      | "notes"
      | "approved_at"
      | "approved_by"
      | "rejected_reason"
      | "rejection_reason_code"
    >
  >
): Promise<ContentApproval | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return null;
  return data as ContentApproval;
}

export async function getContentApprovalStatsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ContentApprovalStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from("content_approvals")
    .select("status, created_at, approved_at")
    .eq("user_id", userId);

  if (error || !data) {
    return { pending: 0, approvedThisMonth: 0, rejected: 0 };
  }

  const rows = data as Array<{
    status: ContentApprovalStatus;
    created_at: string;
    approved_at: string | null;
  }>;

  return {
    pending: rows.filter((row) => row.status === "pending").length,
    approvedThisMonth: rows.filter(
      (row) =>
        row.status === "approved" &&
        (row.approved_at ?? row.created_at) >= monthStart
    ).length,
    rejected: rows.filter((row) => row.status === "rejected").length,
  };
}
