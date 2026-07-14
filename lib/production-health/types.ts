export const HealthStatuses = {
  HEALTHY: "healthy",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type HealthStatus = (typeof HealthStatuses)[keyof typeof HealthStatuses];

export type HealthCheckCategory =
  | "database"
  | "supabase"
  | "trigger_dev"
  | "openai"
  | "google_business_profile"
  | "publishing"
  | "email"
  | "analytics"
  | "oauth"
  | "recommendation_engine"
  | "schedules";

export type HealthCheckResult = {
  category: HealthCheckCategory;
  status: HealthStatus;
  title: string;
  diagnostic: string;
  checkedAt: string;
  details?: Record<string, unknown>;
};

export type ProductionHealthReport = {
  overall: HealthStatus;
  checks: HealthCheckResult[];
  generatedAt: string;
  correlationId: string;
};
