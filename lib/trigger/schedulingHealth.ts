import "server-only";

/**
 * Re-export autonomous scheduling health from the recommendation pipeline status
 * module so analytics/publishing callers share one implementation.
 */
export {
  getAutonomousSchedulingHealth,
  getRecentScheduledSubsystemRuns,
  type ScheduleHealthEntry,
  type ScheduledSubsystemRunSummary,
  type SubsystemHealth,
  type RunsListClient,
  type SchedulesListClient,
} from "@/lib/trigger/recommendationPipelineStatus";
