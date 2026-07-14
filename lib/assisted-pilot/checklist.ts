import {
  PILOT_CHECKLIST_STAGE_ORDER,
  PilotChecklistStageKeys,
  PilotStageStatuses,
  type PilotChecklistItem,
  type PilotChecklistStageKey,
  type PilotStageStatus,
} from "@/lib/assisted-pilot/types";

export const PILOT_STAGE_LABELS: Record<PilotChecklistStageKey, string> = {
  [PilotChecklistStageKeys.BUSINESS_ONBOARDING]: "Business onboarding",
  [PilotChecklistStageKeys.WEBSITE_ANALYSIS]: "Website analysis",
  [PilotChecklistStageKeys.MARKETING_PROFILE]: "Marketing profile",
  [PilotChecklistStageKeys.RECOMMENDATION_GENERATION]: "Recommendation generation",
  [PilotChecklistStageKeys.APPROVAL_PACKAGE]: "Approval package",
  [PilotChecklistStageKeys.EMAIL_REVIEW]: "Email review",
  [PilotChecklistStageKeys.APPROVALS]: "Approvals",
  [PilotChecklistStageKeys.PUBLISHING]: "Publishing",
  [PilotChecklistStageKeys.ANALYTICS]: "Analytics",
  [PilotChecklistStageKeys.LEARNING_UPDATE]: "Learning update",
  [PilotChecklistStageKeys.PILOT_SIGNOFF]: "Pilot signoff",
};

export function defaultChecklistItems(): PilotChecklistItem[] {
  return PILOT_CHECKLIST_STAGE_ORDER.map((stageKey) => ({
    stageKey,
    label: PILOT_STAGE_LABELS[stageKey],
    status: PilotStageStatuses.PENDING,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  }));
}

export function mergeChecklistState(
  persisted: Array<{
    stage_key: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
  }>
): PilotChecklistItem[] {
  const byKey = new Map(persisted.map((row) => [row.stage_key, row]));
  return defaultChecklistItems().map((item) => {
    const row = byKey.get(item.stageKey);
    if (!row) return item;
    return {
      ...item,
      status: row.status as PilotStageStatus,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      errorMessage: row.error_message,
    };
  });
}

export function computeCompletionPercentage(checklist: PilotChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const completed = checklist.filter((item) => item.status === PilotStageStatuses.COMPLETED).length;
  return Math.round((completed / checklist.length) * 100);
}

export function countManualActionsRemaining(checklist: PilotChecklistItem[]): number {
  return checklist.filter(
    (item) =>
      item.status === PilotStageStatuses.PENDING ||
      item.status === PilotStageStatuses.RUNNING ||
      item.status === PilotStageStatuses.FAILED ||
      item.status === PilotStageStatuses.BLOCKED
  ).length;
}

export function transitionChecklistItem(
  item: PilotChecklistItem,
  nextStatus: PilotStageStatus,
  nowIso: string,
  errorMessage: string | null = null
): PilotChecklistItem {
  if (nextStatus === PilotStageStatuses.RUNNING) {
    return {
      ...item,
      status: nextStatus,
      startedAt: item.startedAt ?? nowIso,
      finishedAt: null,
      errorMessage: null,
    };
  }
  if (
    nextStatus === PilotStageStatuses.COMPLETED ||
    nextStatus === PilotStageStatuses.FAILED ||
    nextStatus === PilotStageStatuses.BLOCKED
  ) {
    return {
      ...item,
      status: nextStatus,
      startedAt: item.startedAt ?? nowIso,
      finishedAt: nowIso,
      errorMessage: nextStatus === PilotStageStatuses.COMPLETED ? null : errorMessage,
    };
  }
  return {
    ...item,
    status: PilotStageStatuses.PENDING,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  };
}

export function isValidStageKey(value: string): value is PilotChecklistStageKey {
  return (PILOT_CHECKLIST_STAGE_ORDER as string[]).includes(value);
}
