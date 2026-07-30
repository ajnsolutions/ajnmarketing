import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExtractedKnowledgeItem,
  SmartUploadDocumentRecord,
  SmartUploadDocumentStatus,
  SmartUploadFileType,
  SmartUploadKnowledgeFactRecord,
} from "@/lib/smart-uploads/types";

export async function createSmartUploadDocument(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    fileName: string;
    fileType: SmartUploadFileType;
    storagePath: string;
    fileSizeBytes: number;
  },
): Promise<SmartUploadDocumentRecord | null> {
  const { data, error } = await supabase
    .from("smart_upload_documents")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      file_name: input.fileName,
      file_type: input.fileType,
      storage_path: input.storagePath,
      file_size_bytes: input.fileSizeBytes,
      status: "uploaded",
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as SmartUploadDocumentRecord;
}

export async function getSmartUploadDocumentForUser(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<SmartUploadDocumentRecord | null> {
  const { data, error } = await supabase
    .from("smart_upload_documents")
    .select("*")
    .eq("user_id", userId)
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SmartUploadDocumentRecord;
}

export async function listSmartUploadDocumentsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SmartUploadDocumentRecord[]> {
  const { data, error } = await supabase
    .from("smart_upload_documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as SmartUploadDocumentRecord[];
}

export async function updateSmartUploadDocumentStatus(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  input: { status: SmartUploadDocumentStatus; extractionError?: string | null; factCount?: number },
): Promise<SmartUploadDocumentRecord | null> {
  const update: Record<string, unknown> = { status: input.status };
  if (input.extractionError !== undefined) update.extraction_error = input.extractionError;
  if (input.factCount !== undefined) update.fact_count = input.factCount;
  if (input.status === "extracted" || input.status === "failed") {
    update.processed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("smart_upload_documents")
    .update(update)
    .eq("user_id", userId)
    .eq("id", documentId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return data as SmartUploadDocumentRecord;
}

/** Real deletion — removes the document row (facts cascade via FK) and returns
 * the deleted record's storage_path so the caller can also remove the stored file. */
export async function deleteSmartUploadDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<{ storagePath: string } | null> {
  const existing = await getSmartUploadDocumentForUser(supabase, userId, documentId);
  if (!existing) return null;

  const { error } = await supabase
    .from("smart_upload_documents")
    .delete()
    .eq("user_id", userId)
    .eq("id", documentId);

  if (error) return null;
  return { storagePath: existing.storage_path };
}

export async function replaceKnowledgeFactsForDocument(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    documentId: string;
    items: ExtractedKnowledgeItem[];
  },
): Promise<SmartUploadKnowledgeFactRecord[]> {
  await supabase.from("smart_upload_knowledge_facts").delete().eq("document_id", input.documentId);

  if (input.items.length === 0) return [];

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("smart_upload_knowledge_facts")
    .insert(
      input.items.map((item) => ({
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        document_id: input.documentId,
        category: item.category,
        fact: item.fact,
        source_excerpt: item.sourceExcerpt,
        confidence: item.confidence,
        date_learned: now,
        last_verified_at: now,
      })),
    )
    .select("*");

  if (error || !data) return [];
  return data as SmartUploadKnowledgeFactRecord[];
}

export async function getKnowledgeFactsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<SmartUploadKnowledgeFactRecord[]> {
  const { data, error } = await supabase
    .from("smart_upload_knowledge_facts")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("date_learned", { ascending: false });

  if (error || !data) return [];
  return data as SmartUploadKnowledgeFactRecord[];
}

export async function getKnowledgeFactsForDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<SmartUploadKnowledgeFactRecord[]> {
  const { data, error } = await supabase
    .from("smart_upload_knowledge_facts")
    .select("*")
    .eq("user_id", userId)
    .eq("document_id", documentId);

  if (error || !data) return [];
  return data as SmartUploadKnowledgeFactRecord[];
}

export async function markFactSuperseded(
  supabase: SupabaseClient,
  userId: string,
  factId: string,
  supersededByFactId: string,
): Promise<void> {
  await supabase
    .from("smart_upload_knowledge_facts")
    .update({ superseded_by: supersededByFactId })
    .eq("user_id", userId)
    .eq("id", factId);
}
