import "server-only";

import mammoth from "mammoth";
import { SmartUploadFileTypes } from "@/lib/smart-uploads/types";
import { DocumentExtractionError, type DocumentTextExtractor } from "@/lib/smart-uploads/extractors/types";

export const docxExtractor: DocumentTextExtractor = {
  fileType: SmartUploadFileTypes.DOCX,
  async extractText(buffer: Buffer): Promise<string> {
    let result: { value: string };
    try {
      result = await mammoth.extractRawText({ buffer });
    } catch (error) {
      throw new DocumentExtractionError(
        error instanceof Error
          ? `Unable to read this .docx file: ${error.message}`
          : "Unable to read this .docx file."
      );
    }

    if (!result.value.trim()) {
      throw new DocumentExtractionError("No readable text was found in this document.");
    }

    return result.value;
  },
};
