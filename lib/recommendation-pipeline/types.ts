export type PipelineStageName =
  | "website_analysis"
  | "ai_marketing_profile"
  | "market_context"
  | "opportunity_detection"
  | "decision_engine";

/** Fixed execution order — every result array from the orchestrator follows this order. */
export const PIPELINE_STAGE_ORDER: PipelineStageName[] = [
  "website_analysis",
  "ai_marketing_profile",
  "market_context",
  "opportunity_detection",
  "decision_engine",
];

export type PipelineStageStatus = "completed" | "skipped" | "failed";

export type PipelineStageResult = {
  stage: PipelineStageName;
  status: PipelineStageStatus;
  reason: string;
  details?: Record<string, unknown>;
};

export type RecommendationPipelineResult = {
  userId: string;
  businessProfileId: string | null;
  stages: PipelineStageResult[];
};
