import "server-only";

import { APIError } from "openai";

export type AiMarketingProfileFailureDetails = {
  provider: "openai" | "unknown";
  model?: string;
  status?: number;
  code?: string | null;
  type?: string | null;
  requestId?: string | null;
  message: string;
};

/**
 * Thrown by an AiMarketingProfileGenerator implementation on any failure. Carries enough
 * structured detail (provider/model/status/request id) to log and troubleshoot without ever
 * being treated as a successful generation — callers must never catch this and substitute
 * placeholder content silently.
 */
export class AiMarketingProfileGenerationError extends Error {
  readonly details: AiMarketingProfileFailureDetails;

  constructor(details: AiMarketingProfileFailureDetails, options?: { cause?: unknown }) {
    super(details.message);
    this.name = "AiMarketingProfileGenerationError";
    this.details = details;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Builds structured failure details from an OpenAI SDK error, preserving status/code/request id when available. */
export function buildOpenAiFailureDetails(
  error: unknown,
  model: string
): AiMarketingProfileFailureDetails {
  if (error instanceof APIError) {
    return {
      provider: "openai",
      model,
      status: error.status,
      code: error.code ?? null,
      type: error.type ?? null,
      requestId: error.requestID ?? null,
      message: error.message,
    };
  }

  return {
    provider: "openai",
    model,
    message: error instanceof Error ? error.message : String(error),
  };
}
