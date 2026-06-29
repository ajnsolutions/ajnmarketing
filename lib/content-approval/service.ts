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
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
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

  const approval = await createContentApproval(supabase, {
    userId,
    businessProfileId: profile.id,
    data: input,
  });

  if (approval) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId: profile.id,
      action: AuditActions.CONTENT_SENT_TO_APPROVAL,
      entityType: "content_approval",
      entityId: approval.id,
      status: "success",
      metadata: {
        contentType: approval.content_type,
        source: approval.source,
        title: approval.title,
      },
    });
  }

  return approval;
}

export async function patchContentApprovalForUser(
  userId: string,
  input: ContentApprovalPatchInput
): Promise<ContentApproval | null> {
  const supabase = await createClient();
  const existing = await getContentApprovalById(supabase, userId, input.id);

  if (!existing) return null;

  if (input.action === "approve") {
    const updated = await updateContentApproval(supabase, userId, input.id, {
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejected_reason: null,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      notes: input.notes ?? existing.notes,
    });

    if (updated) {
      await logAuditEvent(supabase, {
        userId,
        businessProfileId: existing.business_profile_id,
        action: AuditActions.CONTENT_APPROVED,
        entityType: "content_approval",
        entityId: updated.id,
        status: "success",
        metadata: { contentType: updated.content_type, source: updated.source },
      });
    }

    return updated;
  }

  if (input.action === "reject") {
    const updated = await updateContentApproval(supabase, userId, input.id, {
      status: "rejected",
      rejected_reason: input.rejected_reason ?? "Rejected by reviewer",
      approved_at: null,
      approved_by: null,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      notes: input.notes ?? existing.notes,
    });

    if (updated) {
      await logAuditEvent(supabase, {
        userId,
        businessProfileId: existing.business_profile_id,
        action: AuditActions.CONTENT_REJECTED,
        entityType: "content_approval",
        entityId: updated.id,
        status: "success",
        metadata: {
          contentType: updated.content_type,
          source: updated.source,
          reasonProvided: Boolean(input.rejected_reason?.trim()),
        },
      });
    }

    return updated;
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
