/**
 * Request parsers for customer setup preference writes.
 */

import { getSetupStepDefinition, isSetupStepKey, isSkippableSetupStep } from "@/lib/customer-setup/steps";
import type { SetupStepKey } from "@/lib/customer-setup/types";

const ACKNOWLEDGEABLE_NON_EDUCATIONAL = new Set<SetupStepKey>([
  "notifications",
  "marketing_preferences",
]);

export function parseSetupStepKeyBody(
  body: unknown,
): { ok: true; stepKey: SetupStepKey } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const stepKey = (body as { stepKey?: unknown }).stepKey;
  if (typeof stepKey !== "string" || !isSetupStepKey(stepKey)) {
    return { ok: false, error: "Unknown setup step." };
  }
  return { ok: true, stepKey };
}

export function assertStepCanSkip(
  stepKey: SetupStepKey,
): { ok: true } | { ok: false; error: string } {
  if (!isSkippableSetupStep(stepKey)) {
    return { ok: false, error: "This setup step cannot be skipped." };
  }
  return { ok: true };
}

export function assertStepCanAcknowledge(
  stepKey: SetupStepKey,
): { ok: true } | { ok: false; error: string } {
  const definition = getSetupStepDefinition(stepKey);
  if (!definition) {
    return { ok: false, error: "Unknown setup step." };
  }
  if (definition.educationalOnly || ACKNOWLEDGEABLE_NON_EDUCATIONAL.has(stepKey)) {
    return { ok: true };
  }
  return { ok: false, error: "This setup step cannot be acknowledged directly." };
}

export function parseSetupPreferencesBody(
  body: unknown,
):
  | {
      ok: true;
      dismissOnboarding?: boolean;
      acknowledgeCompletion?: boolean;
      lastVisitedStepKey?: SetupStepKey | null;
      clearDismiss?: boolean;
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const record = body as Record<string, unknown>;
  const result: {
    dismissOnboarding?: boolean;
    acknowledgeCompletion?: boolean;
    lastVisitedStepKey?: SetupStepKey | null;
    clearDismiss?: boolean;
  } = {};

  if ("dismissOnboarding" in record) {
    if (typeof record.dismissOnboarding !== "boolean") {
      return { ok: false, error: "dismissOnboarding must be a boolean." };
    }
    result.dismissOnboarding = record.dismissOnboarding;
  }
  if ("acknowledgeCompletion" in record) {
    if (typeof record.acknowledgeCompletion !== "boolean") {
      return { ok: false, error: "acknowledgeCompletion must be a boolean." };
    }
    result.acknowledgeCompletion = record.acknowledgeCompletion;
  }
  if ("clearDismiss" in record) {
    if (typeof record.clearDismiss !== "boolean") {
      return { ok: false, error: "clearDismiss must be a boolean." };
    }
    result.clearDismiss = record.clearDismiss;
  }
  if ("lastVisitedStepKey" in record) {
    if (record.lastVisitedStepKey === null) {
      result.lastVisitedStepKey = null;
    } else if (
      typeof record.lastVisitedStepKey === "string" &&
      isSetupStepKey(record.lastVisitedStepKey)
    ) {
      result.lastVisitedStepKey = record.lastVisitedStepKey;
    } else {
      return { ok: false, error: "Unknown setup step." };
    }
  }

  if (
    result.dismissOnboarding === undefined &&
    result.acknowledgeCompletion === undefined &&
    result.lastVisitedStepKey === undefined &&
    result.clearDismiss === undefined
  ) {
    return { ok: false, error: "No preference updates provided." };
  }

  if (
    "requiredPercentComplete" in record ||
    "overallStatus" in record ||
    "markComplete" in record ||
    "completedStepKeys" in record
  ) {
    return { ok: false, error: "Derived setup completion cannot be set by the client." };
  }

  return { ok: true, ...result };
}
