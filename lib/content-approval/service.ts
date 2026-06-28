import {
  createContentApproval,
  getContentApprovalById,
  getContentApprovalStatsForUser,
  getContentApprovalsForUser,
  updateContentApproval,
} from "@/lib/content-approval/persistence";
import type {
  ContentApproval,
  ContentApprovalCreateInput,
  ContentApprovalPatchInput,
  ContentApprovalStats,
} from "@/lib/content-approval/types";
import type { BusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

function buildRegeneratedContent(content: string, version: number): string {
  const suffix = version % 2 === 0 ? " We're here to help when you need us." : " Contact us to learn more.";
  if (content.includes(suffix.trim())) return content;
  return `${content.trim()}${suffix}`;
}

export async function getContentApprovalsForCurrentUser(): Promise<ContentApproval[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];
  return getContentApprovalsForUser(supabase, user.id);
}

export async function getContentApprovalStatsForCurrentUser(): Promise<ContentApprovalStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { pending: 0, approvedThisMonth: 0, rejected: 0 };
  }

  return getContentApprovalStatsForUser(supabase, user.id);
}

export async function submitContentForApproval(
  userId: string,
  profile: BusinessProfile,
  input: ContentApprovalCreateInput
): Promise<ContentApproval | null> {
  const supabase = await createClient();

  return createContentApproval(supabase, {
    userId,
    businessProfileId: profile.id,
    data: input,
  });
}

export async function patchContentApprovalForUser(
  userId: string,
  input: ContentApprovalPatchInput
): Promise<ContentApproval | null> {
  const supabase = await createClient();
  const existing = await getContentApprovalById(supabase, userId, input.id);

  if (!existing) return null;

  if (input.action === "approve") {
    return updateContentApproval(supabase, userId, input.id, {
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejected_reason: null,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      notes: input.notes ?? existing.notes,
    });
  }

  if (input.action === "reject") {
    return updateContentApproval(supabase, userId, input.id, {
      status: "rejected",
      rejected_reason: input.rejected_reason ?? "Rejected by reviewer",
      approved_at: null,
      approved_by: null,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      notes: input.notes ?? existing.notes,
    });
  }

  if (input.action === "regenerate") {
    const nextVersion = existing.version + 1;

    return createContentApproval(supabase, {
      userId,
      businessProfileId: existing.business_profile_id,
      version: nextVersion,
      data: {
        content_type: existing.content_type,
        title: `${existing.title.replace(/ \(Regenerated v\d+\)$/i, "")} (Regenerated v${nextVersion})`,
        content: buildRegeneratedContent(existing.content, nextVersion),
        source: "regeneration",
        ai_score: existing.ai_score,
        notes: `Regenerated from approval ${existing.id}`,
      },
    });
  }

  return updateContentApproval(supabase, userId, input.id, {
    title: input.title ?? existing.title,
    content: input.content ?? existing.content,
    notes: input.notes ?? existing.notes,
  });
}
