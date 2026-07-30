import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const SMART_UPLOADS_STORAGE_BUCKET = "smart-uploads";

function buildStoragePath(userId: string, documentId: string, fileName: string): string {
  // Storage RLS policies (supabase/migrations) key off the first path segment
  // being the owner's auth uid — never change this shape without updating them.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return `${userId}/${documentId}/${safeName}`;
}

export async function uploadSmartUploadFile(
  supabase: SupabaseClient,
  input: { userId: string; documentId: string; fileName: string; buffer: Buffer; contentType: string },
): Promise<{ storagePath: string } | { error: string }> {
  const storagePath = buildStoragePath(input.userId, input.documentId, input.fileName);

  const { error } = await supabase.storage.from(SMART_UPLOADS_STORAGE_BUCKET).upload(storagePath, input.buffer, {
    contentType: input.contentType,
    upsert: false,
  });

  if (error) return { error: error.message };
  return { storagePath };
}

export async function downloadSmartUploadFile(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(SMART_UPLOADS_STORAGE_BUCKET).download(storagePath);
  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteSmartUploadFile(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<boolean> {
  const { error } = await supabase.storage.from(SMART_UPLOADS_STORAGE_BUCKET).remove([storagePath]);
  return !error;
}
