import "server-only";

import { SmartUploadFileTypes } from "@/lib/smart-uploads/types";
import { DocumentExtractionError, type DocumentTextExtractor } from "@/lib/smart-uploads/extractors/types";

function decodeUtf8(buffer: Buffer): string {
  const text = buffer.toString("utf8");
  if (!text.trim()) {
    throw new DocumentExtractionError("The file appears to be empty.");
  }
  return text;
}

export const plainTextExtractor: DocumentTextExtractor = {
  fileType: SmartUploadFileTypes.TXT,
  async extractText(buffer: Buffer): Promise<string> {
    return decodeUtf8(buffer);
  },
};

export const markdownExtractor: DocumentTextExtractor = {
  fileType: SmartUploadFileTypes.MARKDOWN,
  async extractText(buffer: Buffer): Promise<string> {
    // Markdown syntax (headings, emphasis, links) carries real signal for
    // extraction (e.g. `## Services` reads as a section header) — pass it
    // through as-is rather than stripping formatting.
    return decodeUtf8(buffer);
  },
};
