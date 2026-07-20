/**
 * Request parsing for Experimentation APIs.
 */

import {
  ExperimentTypes,
  type ExperimentType,
  type ProposeExperimentInput,
} from "@/lib/marketing-experimentation/experiment-types";

const TYPE_SET = new Set<string>(Object.values(ExperimentTypes));
const MAX_HYPOTHESIS_LENGTH = 280;

export function parseProposeExperimentRequestBody(
  body: unknown,
): { ok: true; value: ProposeExperimentInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;

  if (record.proposedBy !== "marketing_director") {
    return {
      ok: false,
      error:
        'proposedBy must be "marketing_director" — Experimentation Engine never self-proposes',
    };
  }

  const experimentType = record.experimentType;
  if (typeof experimentType !== "string" || !TYPE_SET.has(experimentType)) {
    return { ok: false, error: "experimentType is required and must be supported" };
  }

  const decisionKey = record.marketingDirectorDecisionKey;
  if (typeof decisionKey !== "string" || !decisionKey.trim()) {
    return { ok: false, error: "marketingDirectorDecisionKey is required" };
  }

  const recommendationId = record.createdFromRecommendationId;
  if (typeof recommendationId !== "string" || !recommendationId.trim()) {
    return {
      ok: false,
      error: "createdFromRecommendationId is required",
    };
  }

  if (
    typeof record.hypothesis === "string" &&
    record.hypothesis.trim().length > MAX_HYPOTHESIS_LENGTH
  ) {
    return {
      ok: false,
      error: `hypothesis must be ${MAX_HYPOTHESIS_LENGTH} characters or fewer`,
    };
  }

  const hypothesis =
    typeof record.hypothesis === "string" && record.hypothesis.trim()
      ? record.hypothesis.trim()
      : undefined;

  const relatedCampaignId =
    typeof record.relatedCampaignId === "string"
      ? record.relatedCampaignId
      : record.relatedCampaignId === null
        ? null
        : undefined;

  return {
    ok: true,
    value: {
      experimentType: experimentType as ExperimentType,
      createdFromRecommendationId: recommendationId.trim(),
      marketingDirectorDecisionKey: decisionKey.trim(),
      relatedCampaignId,
      hypothesis,
      proposedBy: "marketing_director",
    },
  };
}
