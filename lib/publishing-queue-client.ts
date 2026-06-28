import type {
  PublishingQueueCreateInput,
  PublishingQueueItem,
  PublishingQueuePatchInput,
} from "@/lib/publishing-queue/types";

export async function fetchPublishingQueue(): Promise<{
  items: PublishingQueueItem[];
  error?: string;
}> {
  const response = await fetch("/api/publishing-queue", { method: "GET" });
  const payload = (await response.json()) as {
    items?: PublishingQueueItem[];
    error?: string;
  };

  if (!response.ok) {
    return { items: [], error: payload.error ?? "Unable to load publishing queue" };
  }

  return { items: payload.items ?? [] };
}

export async function createPublishingQueueRequest(
  input: PublishingQueueCreateInput
): Promise<{ item: PublishingQueueItem | null; error?: string }> {
  const response = await fetch("/api/publishing-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    item?: PublishingQueueItem | null;
    error?: string;
  };

  if (!response.ok) {
    return { item: null, error: payload.error ?? "Unable to add to publishing queue" };
  }

  return { item: payload.item ?? null };
}

export async function patchPublishingQueueRequest(
  input: PublishingQueuePatchInput
): Promise<{ item: PublishingQueueItem | null; error?: string }> {
  const response = await fetch("/api/publishing-queue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    item?: PublishingQueueItem | null;
    error?: string;
  };

  if (!response.ok) {
    return { item: null, error: payload.error ?? "Unable to update publishing queue item" };
  }

  return { item: payload.item ?? null };
}
