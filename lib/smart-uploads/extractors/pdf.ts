import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import { SmartUploadFileTypes } from "@/lib/smart-uploads/types";
import { DocumentExtractionError, type DocumentTextExtractor } from "@/lib/smart-uploads/extractors/types";

export const pdfExtractor: DocumentTextExtractor = {
  fileType: SmartUploadFileTypes.PDF,
  async extractText(buffer: Buffer): Promise<string> {
    let text: string;
    try {
      const document = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(document, { mergePages: true });
      text = result.text;
    } catch (error) {
      throw new DocumentExtractionError(
        error instanceof Error
          ? `Unable to read this PDF: ${error.message}`
          : "Unable to read this PDF."
      );
    }

    if (!text.trim()) {
      throw new DocumentExtractionError(
        "No extractable text was found in this PDF — it may be a scanned image without OCR support yet."
      );
    }

    return text;
  },
};
