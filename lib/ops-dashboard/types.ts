export type OpsQueueCounts = {
  pending: number;
  running: number;
  failed: number;
  completed: number;
  retrying: number;
};

export type OpsSectionSummary = {
  id: string;
  title: string;
  counts: OpsQueueCounts;
  lastExecutionAt: string | null;
  lastError: string | null;
  averageDurationMs: number | null;
  queueDepth: number;
  notes?: string;
};

export type OpsDashboardSummary = {
  generatedAt: string;
  correlationId: string;
  scheduleGateOpen: boolean;
  sections: OpsSectionSummary[];
  alertCounts: { info: number; warning: number; critical: number };
};
