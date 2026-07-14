export const AlertSeverities = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type AlertSeverity = (typeof AlertSeverities)[keyof typeof AlertSeverities];

export type OpsAlertCategory =
  | "publishing"
  | "oauth"
  | "retries"
  | "recommendation_execution"
  | "analytics"
  | "email"
  | "approval"
  | "schedules"
  | "health";

export type OpsAlert = {
  id: string;
  category: OpsAlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  detectedAt: string;
  entityType?: string | null;
  entityId?: string | null;
  tenantUserId?: string | null;
  businessProfileId?: string | null;
};

export type OpsAlertSnapshot = {
  generatedAt: string;
  alerts: OpsAlert[];
  counts: Record<AlertSeverity, number>;
};
