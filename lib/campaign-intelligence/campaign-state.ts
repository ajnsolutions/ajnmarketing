/**
 * Deterministic campaign lifecycle transitions. Cancellation is reserved for later.
 */

import {
  CampaignStatuses,
  type CampaignStatus,
} from "@/lib/campaign-intelligence/campaign-types";

const TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  [CampaignStatuses.DRAFT]: [CampaignStatuses.PLANNED],
  [CampaignStatuses.PLANNED]: [CampaignStatuses.APPROVED],
  [CampaignStatuses.APPROVED]: [CampaignStatuses.SCHEDULED],
  [CampaignStatuses.SCHEDULED]: [CampaignStatuses.IN_PROGRESS],
  [CampaignStatuses.IN_PROGRESS]: [CampaignStatuses.COMPLETED],
  [CampaignStatuses.COMPLETED]: [CampaignStatuses.MEASURED],
  [CampaignStatuses.MEASURED]: [CampaignStatuses.ARCHIVED],
  [CampaignStatuses.ARCHIVED]: [],
};

export function canTransitionCampaignStatus(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextCampaignStatus(from: CampaignStatus): CampaignStatus | null {
  return TRANSITIONS[from][0] ?? null;
}

/** Advance one step along the canonical happy path when allowed. */
export function advanceCampaignStatus(from: CampaignStatus): CampaignStatus {
  return nextCampaignStatus(from) ?? from;
}

export const ACTIVE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  CampaignStatuses.DRAFT,
  CampaignStatuses.PLANNED,
  CampaignStatuses.APPROVED,
  CampaignStatuses.SCHEDULED,
  CampaignStatuses.IN_PROGRESS,
];

export function isActiveCampaignStatus(status: CampaignStatus): boolean {
  return ACTIVE_CAMPAIGN_STATUSES.includes(status);
}
