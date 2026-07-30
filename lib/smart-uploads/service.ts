import "server-only";

import { randomUUID } from "crypto";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { queueBackgroundJobForCurrentUser } from "@/lib/background-jobs/service";
import { BackgroundJobTypes } from "@/lib/background-jobs/types";
import { createClient } from "@/lib/supabase/server";
import { getDocumentExtractor, inferFileTypeFromFileName } from "@/lib/smart-uploads/extractors/registry";
import { DocumentExtractionError } from "@/lib/smart-uploads/extractors/types";
import { findDuplicateFacts } from "@/lib/smart-uploads/duplicateDetection";
import { formatSmartUploadOpenAiError, isSmartUploadOpenAiConfigured, OpenAIKnowledgeExtractor } from "@/lib/smart-uploads/openai-extractor";
import {
  createSmartUploadDocument,
  deleteSmartUploadDocument,
  getKnowledgeFactsForBusiness,
  getKnowledgeFactsForDocument,
  getSmartUploadDocumentForUser,
  listSmartUploadDocumentsForUser,
  markFactSuperseded,
  replaceKnowledgeFactsForDocument,
  updateSmartUploadDocumentStatus,
} from "@/lib/smart-uploads/persistence";
import { deleteSmartUploadFile, downloadSmartUploadFile, uploadSmartUploadFile } from "@/lib/smart-uploads/storage";
import {
  MAX_SMART_UPLOAD_FILE_SIZE_BYTES,
  SUPPORTED_FILE_TYPES,
  type SmartUploadDocumentRecord,
  type SmartUploadKnowledgeFactRecord,
} from "@/lib/smart-uploads/types";

export type SmartUploadDashboardData = {
  documents: SmartUploadDocumentRecord[];
  facts: SmartUploadKnowledgeFactRecord[];
  openAiConfigured: boolean;
};

export async function uploadSmartUploadDocumentForCurrentUser(input: {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}): Promise<{ document: SmartUploadDocumentRecord | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { document: null, error: "Unauthorized" };

  const profile = await getBusinessProfileForUser();
  if (!profile) return { document: null, error: "Business profile not found" };

  const fileType = inferFileTypeFromFileName(input.fileName);
  if (!fileType || !SUPPORTED_FILE_TYPES.includes(fileType)) {
    return {
      document: null,
      error: `Unsupported file type. Supported types: ${SUPPORTED_FILE_TYPES.join(", ")}.`,
    };
  }

  if (input.buffer.byteLength === 0) {
    return { document: null, error: "The file is empty." };
  }

  if (input.buffer.byteLength > MAX_SMART_UPLOAD_FILE_SIZE_BYTES) {
    return { document: null, error: "File is too large. Maximum size is 15 MB." };
  }

  const documentId = randomUUID();
  const uploadResult = await uploadSmartUploadFile(supabase, {
    userId: user.id,
    documentId,
    fileName: input.fileName,
    buffer: input.buffer,
    contentType: input.contentType,
  });

  if ("error" in uploadResult) {
    return { document: null, error: "Unable to store the uploaded file." };
  }

  const document = await createSmartUploadDocument(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    fileName: input.fileName,
    fileType,
    storagePath: uploadResult.storagePath,
    fileSizeBytes: input.buffer.byteLength,
  });

  if (!document) {
    await deleteSmartUploadFile(supabase, uploadResult.storagePath);
    return { document: null, error: "Unable to save the uploaded document." };
  }

  await logAuditEvent(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    action: AuditActions.SMART_UPLOAD_DOCUMENT_UPLOADED,
    entityType: "smart_upload_document",
    entityId: document.id,
    status: "success",
    metadata: { fileType, fileSizeBytes: input.buffer.byteLength },
  });

  await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.PROCESS_SMART_UPLOAD,
    priority: "high",
    businessProfileId: profile.id,
    payload: { documentId: document.id },
  }).catch(() => undefined);

  return { document };
}

/** Re-runs extraction for an already-uploaded document — always replaces
 * (never appends to) that document's existing facts. */
export async function reprocessSmartUploadDocumentForCurrentUser(
  documentId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const document = await getSmartUploadDocumentForUser(supabase, user.id, documentId);
  if (!document) return { success: false, error: "Document not found." };

  const { error } = await queueBackgroundJobForCurrentUser({
    jobType: BackgroundJobTypes.PROCESS_SMART_UPLOAD,
    priority: "high",
    businessProfileId: document.business_profile_id,
    payload: { documentId },
    force: true,
  });

  if (error) return { success: false, error };
  return { success: true };
}

/**
 * Extracts text, runs AI knowledge extraction, persists normalized facts, and
 * runs duplicate detection against the business's existing knowledge. Safe to
 * call more than once for the same document (reprocessing) — always fully
 * replaces that document's facts rather than appending.
 */
export async function processSmartUploadDocumentForUser(
  userId: string,
  documentId: string,
): Promise<{ success: boolean; factCount: number; error?: string }> {
  const supabase = await createClient();
  const document = await getSmartUploadDocumentForUser(supabase, userId, documentId);
  if (!document) return { success: false, factCount: 0, error: "Document not found." };

  await updateSmartUploadDocumentStatus(supabase, userId, documentId, { status: "processing" });

  await logAuditEvent(supabase, {
    userId,
    businessProfileId: document.business_profile_id,
    action: AuditActions.SMART_UPLOAD_EXTRACTION_STARTED,
    entityType: "smart_upload_document",
    entityId: document.id,
    status: "started",
    metadata: {},
  });

  try {
    if (!isSmartUploadOpenAiConfigured()) {
      throw new Error("Document extraction is not configured. Contact your workspace administrator.");
    }

    const buffer = await downloadSmartUploadFile(supabase, document.storage_path);
    if (!buffer) {
      throw new Error("Unable to read the stored file.");
    }

    const extractor = getDocumentExtractor(document.file_type);
    const documentText = await extractor.extractText(buffer);

    const knowledgeExtractor = new OpenAIKnowledgeExtractor();
    const extraction = await knowledgeExtractor.extract({ fileName: document.file_name, documentText });

    const facts = await replaceKnowledgeFactsForDocument(supabase, {
      userId,
      businessProfileId: document.business_profile_id,
      documentId: document.id,
      items: extraction.items,
    });

    // Duplicate detection runs across the whole business's knowledge (not just
    // this document) so a second document restating the same fact supersedes
    // — never duplicates — what's already known.
    const allFacts = await getKnowledgeFactsForBusiness(supabase, userId, document.business_profile_id);
    const duplicates = findDuplicateFacts(allFacts);
    for (const pair of duplicates) {
      await markFactSuperseded(supabase, userId, pair.supersede.id, pair.keep.id);
    }

    await updateSmartUploadDocumentStatus(supabase, userId, documentId, {
      status: "extracted",
      extractionError: null,
      factCount: facts.length,
    });

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: document.business_profile_id,
      action: AuditActions.SMART_UPLOAD_EXTRACTION_COMPLETED,
      entityType: "smart_upload_document",
      entityId: document.id,
      status: "success",
      metadata: { factCount: facts.length, duplicatesSuperseded: duplicates.length },
    });

    return { success: true, factCount: facts.length };
  } catch (error) {
    const message =
      error instanceof DocumentExtractionError ? error.message : formatSmartUploadOpenAiError(error);

    await updateSmartUploadDocumentStatus(supabase, userId, documentId, {
      status: "failed",
      extractionError: message,
    });

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: document.business_profile_id,
      action: AuditActions.SMART_UPLOAD_EXTRACTION_FAILED,
      entityType: "smart_upload_document",
      entityId: document.id,
      status: "failure",
      metadata: auditErrorMetadata(error, message),
    });

    return { success: false, factCount: 0, error: message };
  }
}

export async function deleteSmartUploadDocumentForCurrentUser(
  documentId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const document = await getSmartUploadDocumentForUser(supabase, user.id, documentId);
  const deleted = await deleteSmartUploadDocument(supabase, user.id, documentId);
  if (!deleted) return { success: false, error: "Document not found." };

  await deleteSmartUploadFile(supabase, deleted.storagePath);

  await logAuditEvent(supabase, {
    userId: user.id,
    businessProfileId: document?.business_profile_id ?? null,
    action: AuditActions.SMART_UPLOAD_DOCUMENT_DELETED,
    entityType: "smart_upload_document",
    entityId: documentId,
    status: "success",
    metadata: {},
  });

  return { success: true };
}

export async function getSmartUploadDashboardDataForCurrentUser(): Promise<SmartUploadDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { documents: [], facts: [], openAiConfigured: isSmartUploadOpenAiConfigured() };

  const profile = await getBusinessProfileForUser();
  const [documents, facts] = await Promise.all([
    listSmartUploadDocumentsForUser(supabase, user.id),
    profile ? getKnowledgeFactsForBusiness(supabase, user.id, profile.id) : Promise.resolve([]),
  ]);

  return { documents, facts, openAiConfigured: isSmartUploadOpenAiConfigured() };
}

export async function getKnowledgeFactsForDocumentForCurrentUser(
  documentId: string,
): Promise<SmartUploadKnowledgeFactRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return getKnowledgeFactsForDocument(supabase, user.id, documentId);
}

/** Server-scoped fetch for other Business Brain consumers (Growth Advisor, Weekly
 * Growth Plan, Content Generator) — never touches cookies/next/headers, safe for
 * privileged/service-role execution with an explicit userId. */
export async function getActiveSmartUploadKnowledgeForUser(
  supabase: Parameters<typeof getKnowledgeFactsForBusiness>[0],
  userId: string,
  businessProfileId: string,
): Promise<SmartUploadKnowledgeFactRecord[]> {
  const facts = await getKnowledgeFactsForBusiness(supabase, userId, businessProfileId);
  return facts.filter((fact) => !fact.superseded_by);
}
