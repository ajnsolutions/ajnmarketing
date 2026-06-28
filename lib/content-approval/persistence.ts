import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentApproval,
  ContentApprovalCreateInput,
  ContentApprovalStats,
  ContentApprovalStatus,
} from "@/lib/content-approval/types";

export function formatApprovalStatus(status: ContentApprovalStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
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
    })
    .select("*")
    .single();

  if (error) return null;
  return data as ContentApproval;
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
