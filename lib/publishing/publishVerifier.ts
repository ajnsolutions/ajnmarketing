import "server-only";

import type { PublishProviderResult } from "@/lib/publishing/publishingTypes";
import type { PublishingJob } from "@/lib/publishing/publishingTypes";

export type PublishVerificationResult = {
  verified: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export function verifyPublishedContentResult(
  job: PublishingJob,
  publishResult: PublishProviderResult
): PublishVerificationResult {
  if (!publishResult.providerPostId?.trim()) {
    return {
      verified: false,
      message: "Provider did not return a post identifier.",
    };
  }

  const state = String(
    publishResult.rawResponse.state ??
      publishResult.verificationHint?.state ??
      "LIVE"
  ).toUpperCase();

  if (state === "REJECTED" || state === "FAILED") {
    return {
      verified: false,
      message: `Provider reported post state ${state}.`,
      details: { state },
    };
  }

  return {
    verified: true,
    message: "Published content verified.",
    details: {
      providerPostId: publishResult.providerPostId,
      state,
      jobId: job.id,
    },
  };
}
