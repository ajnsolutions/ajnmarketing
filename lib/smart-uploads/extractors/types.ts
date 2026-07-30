import type { SmartUploadFileType } from "@/lib/smart-uploads/types";

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

/**
 * One file-type's text extractor. Adding PowerPoint, Excel, image OCR, or CSV
 * support later means implementing this interface and registering it in
 * extractors/registry.ts — no changes anywhere else in the pipeline.
 */
export interface DocumentTextExtractor {
  readonly fileType: SmartUploadFileType;
  extractText(buffer: Buffer): Promise<string>;
}
