/**
 * Marketing Experiment Proposals — closed vocabularies and entity shapes.
 * See docs/MARKETING_EXPERIMENTATION_ENGINE.md and migration 029.
 *
 * A proposal is the durable, server-authored record of Marketing Director's
 * determination that a specific recommendation is suitable for controlled
 * experimentation. It is never created by an authenticated client request — only by
 * lib/marketing-experimentation/proposal-service.ts's evaluation path, itself reachable
 * only from the admin-gated app/api/admin/trigger-experiment-proposal-evaluation route.
 * A recommendation existing is not, by itself, a proposal.
 */

import type { ExperimentKpiMetric, ExperimentType, ExperimentVariant } from "@/lib/marketing-experimentation/experiment-types";

export const ExperimentProposalStatuses = {
  PENDING: "pending",
  APPROVED: "approved",
  EXPIRED: "expired",
} as const;

export type ExperimentProposalStatus =
  (typeof ExperimentProposalStatuses)[keyof typeof ExperimentProposalStatuses];

export type MarketingExperimentProposal = {
  id: string;
  user_id: string;
  business_profile_id: string;
  recommendation_id: string;
  campaign_id: string | null;
  experiment_type: ExperimentType;
  title: string;
  hypothesis: string;
  control_definition: ExperimentVariant;
  treatment_definition: ExperimentVariant;
  primary_kpi: ExperimentKpiMetric;
  secondary_kpis: ExperimentKpiMetric[];
  measurement_window_days: number;
  proposal_status: ExperimentProposalStatus;
  decision_reason: string;
  marketing_director_decision_key: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  converted_experiment_id: string | null;
};

/** Customer-safe dashboard card — no internal eligibility scoring. */
export type ExperimentProposalCard = {
  id: string;
  experimentType: ExperimentType;
  title: string;
  hypothesis: string;
  controlDefinition: ExperimentVariant;
  treatmentDefinition: ExperimentVariant;
  primaryKpi: ExperimentKpiMetric;
  measurementWindowDays: number;
  recommendationId: string;
  campaignId: string | null;
  proposalStatus: ExperimentProposalStatus;
};

/** Server-computed draft — never accepted from a client request body. */
export type PlannedExperimentProposalDraft = {
  user_id: string;
  business_profile_id: string;
  recommendation_id: string;
  campaign_id: string | null;
  experiment_type: ExperimentType;
  title: string;
  hypothesis: string;
  control_definition: ExperimentVariant;
  treatment_definition: ExperimentVariant;
  primary_kpi: ExperimentKpiMetric;
  secondary_kpis: ExperimentKpiMetric[];
  measurement_window_days: number;
  decision_reason: string;
  marketing_director_decision_key: string;
  template_id: string;
};
