import { getContentApprovalById } from "@/lib/content-approval/persistence";
import {
  createPublishingQueueItem,
  deletePublishingQueueItem,
  getPublishingQueueForUser,
  getPublishingQueueItemById,
  getPublishingQueueStatsForUser,
  inferPlatformFromContentType,
  updatePublishingQueueItem,
} from "@/lib/publishing-queue/persistence";
import type {
  PublishingQueueCreateInput,
  PublishingQueueItem,
  PublishingQueuePatchInput,
  PublishingQueueStats,
} from "@/lib/publishing-queue/types";
import { createClient } from "@/lib/supabase/server";

export async function getPublishingQueueForCurrentUser(): Promise<PublishingQueueItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];
  return getPublishingQueueForUser(supabase, user.id);
}

export async function getPublishingQueueStatsForCurrentUser(): Promise<PublishingQueueStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ready: 0, scheduled: 0, published: 0, failed: 0 };
  }

  return getPublishingQueueStatsForUser(supabase, user.id);
}

export async function createPublishingQueueItemForUser(
  userId: string,
  input: PublishingQueueCreateInput
): Promise<{ item: PublishingQueueItem | null; error?: string }> {
  const supabase = await createClient();

  if (!input.content_approval_id?.trim()) {
    return { item: null, error: "Content approval id is required" };
  }

  const approval = await getContentApprovalById(supabase, userId, input.content_approval_id);
  if (!approval) {
    return { item: null, error: "Approved content not found" };
  }

  if (approval.status !== "approved") {
    return { item: null, error: "Only approved content can be added to the publishing queue" };
  }

  const platform =
    input.platform ?? inferPlatformFromContentType(approval.content_type);

  const item = await createPublishingQueueItem(supabase, {
    userId,
    businessProfileId: approval.business_profile_id,
    contentApprovalId: approval.id,
    platform,
    title: approval.title,
    content: approval.content,
  });

  if (!item) {
    return { item: null, error: "Unable to add content to the publishing queue" };
  }

  return { item };
}

export async function patchPublishingQueueItemForUser(
  userId: string,
  input: PublishingQueuePatchInput
): Promise<{ item: PublishingQueueItem | null; error?: string }> {
  const supabase = await createClient();

  if (!input.id?.trim()) {
    return { item: null, error: "Queue item id is required" };
  }

  const existing = await getPublishingQueueItemById(supabase, userId, input.id);
  if (!existing) {
    return { item: null, error: "Publishing queue item not found" };
  }

  if (input.action === "remove") {
    const removed = await deletePublishingQueueItem(supabase, userId, input.id);
    return removed ? { item: existing } : { item: null, error: "Unable to remove queue item" };
  }

  if (input.action === "schedule") {
    if (!input.scheduled_for) {
      return { item: null, error: "Scheduled date is required" };
    }

    const item = await updatePublishingQueueItem(supabase, userId, input.id, {
      status: "scheduled",
      scheduled_for: input.scheduled_for,
      publish_error: null,
    });

    return item ? { item } : { item: null, error: "Unable to schedule queue item" };
  }

  if (input.action === "mark_published") {
    const item = await updatePublishingQueueItem(supabase, userId, input.id, {
      status: "published",
      published_at: new Date().toISOString(),
      publish_error: null,
    });

    return item ? { item } : { item: null, error: "Unable to mark item as published" };
  }

  if (input.action === "mark_failed") {
    const item = await updatePublishingQueueItem(supabase, userId, input.id, {
      status: "failed",
      publish_error: input.publish_error ?? "Publishing failed",
    });

    return item ? { item } : { item: null, error: "Unable to mark item as failed" };
  }

  const item = await updatePublishingQueueItem(supabase, userId, input.id, {
    status: input.status ?? existing.status,
    scheduled_for:
      input.scheduled_for !== undefined ? input.scheduled_for : existing.scheduled_for,
    publish_error:
      input.publish_error !== undefined ? input.publish_error : existing.publish_error,
  });

  return item ? { item } : { item: null, error: "Unable to update queue item" };
}
