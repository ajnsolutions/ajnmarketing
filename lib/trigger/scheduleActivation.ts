/**
 * Declarative Trigger.dev schedule activation gate.
 *
 * PRODUCTION workers can be deployed and manually tested without attaching recurring
 * schedules. Flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` to `true` (and deploy) only after
 * explicit schedule-activation approval — that is the entire activation change.
 *
 * Do not rely on deploy-then-race-to-deactivate. With the gate false, `schedules.task`
 * definitions omit `cron`, so deploy/dev sync creates no declarative schedules.
 */
import "server-only";

export const ATTACH_DECLARATIVE_PRODUCTION_CRONS = false;

export const SCHEDULED_SWEEP_TASK_IDS = [
  "analytics-capture-sweep",
  "publishing-due-sweep",
  "recommendation-pipeline-sweep",
] as const;

export type ScheduledSweepTaskId = (typeof SCHEDULED_SWEEP_TASK_IDS)[number];

export const ALL_TRIGGER_TASK_IDS = [
  "recommendation-pipeline-for-tenant",
  "recommendation-pipeline-sweep",
  "analytics-capture-for-tenant",
  "analytics-capture-sweep",
  "publishing-execute-job",
  "publishing-due-sweep",
] as const;

export type TriggerTaskId = (typeof ALL_TRIGGER_TASK_IDS)[number];

/**
 * Approved production cadences (UTC). Kept here so activation is a one-line gate flip
 * plus deploy — cron values are not forgotten or reinvented.
 */
export const INTENDED_PRODUCTION_CRONS: Record<
  ScheduledSweepTaskId,
  { pattern: string; timezone: "UTC"; environments: ["PRODUCTION"] }
> = {
  "analytics-capture-sweep": {
    pattern: "0 6 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  "publishing-due-sweep": {
    pattern: "5 * * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  "recommendation-pipeline-sweep": {
    pattern: "0 14 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
};

/**
 * Spread into `schedules.task({ ... })`. Returns `{}` while the gate is closed so no
 * declarative cron is synced on deploy. When the gate is open, returns `{ cron: ... }`.
 */
export function declarativeProductionCron(
  taskId: ScheduledSweepTaskId
): { cron: (typeof INTENDED_PRODUCTION_CRONS)[ScheduledSweepTaskId] } | Record<string, never> {
  if (!ATTACH_DECLARATIVE_PRODUCTION_CRONS) {
    return {};
  }
  return { cron: INTENDED_PRODUCTION_CRONS[taskId] };
}
