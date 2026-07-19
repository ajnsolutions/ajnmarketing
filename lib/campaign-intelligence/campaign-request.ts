/**
 * Request parsing for Campaign Intelligence APIs.
 */

import {
  CampaignTypes,
  type CampaignType,
  type InitiateCampaignInput,
} from "@/lib/campaign-intelligence/campaign-types";

const CAMPAIGN_TYPE_SET = new Set<string>(Object.values(CampaignTypes));

export function parseInitiateCampaignRequestBody(
  body: unknown,
): { ok: true; value: InitiateCampaignInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;

  if (record.initiatedBy !== "marketing_director") {
    return {
      ok: false,
      error: "initiatedBy must be \"marketing_director\" — Campaign Engine never self-initiates",
    };
  }

  const campaignType = record.campaignType;
  if (typeof campaignType !== "string" || !CAMPAIGN_TYPE_SET.has(campaignType)) {
    return { ok: false, error: "campaignType is required and must be a supported template" };
  }

  const decisionKey = record.marketingDirectorDecisionKey;
  if (typeof decisionKey !== "string" || !decisionKey.trim()) {
    return { ok: false, error: "marketingDirectorDecisionKey is required" };
  }

  const objective =
    typeof record.objective === "string" && record.objective.trim()
      ? record.objective.trim()
      : undefined;

  const createdFromRecommendationId =
    typeof record.createdFromRecommendationId === "string"
      ? record.createdFromRecommendationId
      : record.createdFromRecommendationId === null
        ? null
        : undefined;

  const startDate =
    typeof record.startDate === "string"
      ? record.startDate
      : record.startDate === null
        ? null
        : undefined;

  return {
    ok: true,
    value: {
      campaignType: campaignType as CampaignType,
      objective,
      marketingDirectorDecisionKey: decisionKey.trim(),
      createdFromRecommendationId,
      startDate,
      initiatedBy: "marketing_director",
    },
  };
}
