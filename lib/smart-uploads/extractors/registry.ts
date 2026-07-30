import "server-only";

import { docxExtractor } from "@/lib/smart-uploads/extractors/docx";
import { pdfExtractor } from "@/lib/smart-uploads/extractors/pdf";
import { markdownExtractor, plainTextExtractor } from "@/lib/smart-uploads/extractors/plainText";
import { DocumentExtractionError, type DocumentTextExtractor } from "@/lib/smart-uploads/extractors/types";
import { SUPPORTED_FILE_TYPES, type SmartUploadFileType } from "@/lib/smart-uploads/types";

const EXTRACTOR_REGISTRY: Partial<Record<SmartUploadFileType, DocumentTextExtractor>> = {
  pdf: pdfExtractor,
  docx: docxExtractor,
  txt: plainTextExtractor,
  markdown: markdownExtractor,
  // powerpoint / excel / image / csv: no extractor registered yet — adding one
  // here is the entire integration point for those future file types.
};

export function getDocumentExtractor(fileType: SmartUploadFileType): DocumentTextExtractor {
  const extractor = EXTRACTOR_REGISTRY[fileType];
  if (!extractor) {
    throw new DocumentExtractionError(
      `${fileType} isn't supported yet. Supported types: ${SUPPORTED_FILE_TYPES.join(", ")}.`
    );
  }
  return extractor;
}

const EXTENSION_TO_FILE_TYPE: Record<string, SmartUploadFileType> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "markdown",
  markdown: "markdown",
};

export function inferFileTypeFromFileName(fileName: string): SmartUploadFileType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return EXTENSION_TO_FILE_TYPE[extension] ?? null;
}
