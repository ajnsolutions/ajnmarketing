import "server-only";

import {
  AUTHORITATIVE_EXTERNAL_SETTINGS,
  MAX_INSTRUCTION_TEXT_LENGTH,
  MAX_OVERRIDE_NOTES_LENGTH,
  PREFERENCE_CONTEXT_CATEGORY_VALUES,
  PREFERENCE_TOGGLE_ACTIONS,
  PUBLISHING_DAY_VALUES,
  WRITABLE_PREFERENCE_TYPES,
} from "@/lib/marketing-memory/preferenceConfig";
import {
  OverrideTypes,
  PreferenceTypes,
  type OverrideType,
  type RecordOverrideInput,
  type UpsertPreferenceInput,
} from "@/lib/marketing-memory/preferenceTypes";

export type PreferenceValidationResult =
  | { ok: true; value: UpsertPreferenceInput }
  | { ok: false; error: string };

export type OverrideValidationResult =
  | { ok: true; value: Required<Pick<RecordOverrideInput, "overrideType">> & RecordOverrideInput }
  | { ok: false; error: string };

const OVERRIDE_TYPE_VALUES = new Set<string>(Object.values(OverrideTypes));
const WRITABLE_TYPE_SET = new Set<string>(WRITABLE_PREFERENCE_TYPES);
const CONTEXT_CATEGORY_SET = new Set<string>(PREFERENCE_CONTEXT_CATEGORY_VALUES);
const DAY_SET = new Set<string>(PUBLISHING_DAY_VALUES);
const TOGGLE_SET = new Set<string>(PREFERENCE_TOGGLE_ACTIONS);

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates a preference upsert. Rejects anything that would compete with
 * authoritative Brand Voice / marketing_goals surfaces, and enforces closed
 * vocabularies for structured preference types.
 */
export function validateUpsertPreferenceInput(body: unknown): PreferenceValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;
  const preferenceType = asTrimmedString(record.preferenceType ?? record.preference_type);

  if (!preferenceType) {
    return { ok: false, error: "preferenceType is required" };
  }

  if (preferenceType === "content_tone") {
    return {
      ok: false,
      error: `content_tone preferences are not accepted — use ${AUTHORITATIVE_EXTERNAL_SETTINGS.brandVoiceTone}`,
    };
  }

  if (!WRITABLE_TYPE_SET.has(preferenceType)) {
    return {
      ok: false,
      error: `preferenceType must be one of: ${WRITABLE_PREFERENCE_TYPES.join(", ")}`,
    };
  }

  let factorType = asOptionalString(record.factorType ?? record.factor_type);
  let factorValue = asOptionalString(record.factorValue ?? record.factor_value);
  const instructionText = asTrimmedString(record.instructionText ?? record.instruction_text);
  const activeUntilRaw = record.activeUntil ?? record.active_until;
  let activeUntil: string | null = null;

  if (activeUntilRaw != null) {
    if (typeof activeUntilRaw !== "string" || Number.isNaN(Date.parse(activeUntilRaw))) {
      return { ok: false, error: "activeUntil must be a valid ISO timestamp when provided" };
    }
    activeUntil = new Date(activeUntilRaw).toISOString();
  }

  if (instructionText.length > MAX_INSTRUCTION_TEXT_LENGTH) {
    return {
      ok: false,
      error: `instructionText must be at most ${MAX_INSTRUCTION_TEXT_LENGTH} characters`,
    };
  }

  if (preferenceType === PreferenceTypes.CONTEXT_CATEGORY_TOGGLE) {
    if (!factorType || !CONTEXT_CATEGORY_SET.has(factorType)) {
      return {
        ok: false,
        error: `factorType must be a known context category for context_category_toggle`,
      };
    }
    if (!factorValue || !TOGGLE_SET.has(factorValue)) {
      return {
        ok: false,
        error: `factorValue must be "disable" or "enable" for context_category_toggle`,
      };
    }
  }

  if (preferenceType === PreferenceTypes.PUBLISHING_DAY_RESTRICTION) {
    const day = (factorValue ?? factorType)?.toLowerCase() ?? null;
    if (!day || !DAY_SET.has(day)) {
      return {
        ok: false,
        error: `factorValue must be a weekday name for publishing_day_restriction`,
      };
    }
    factorType = "day_of_week";
    factorValue = day;
  }

  if (preferenceType === PreferenceTypes.CHANNEL_PRIORITY) {
    if (!factorValue && !factorType) {
      return {
        ok: false,
        error: "factorValue (channel) is required for channel_priority",
      };
    }
    if (!factorType) factorType = "channel";
    if (!factorValue) factorValue = factorType;
  }

  if (preferenceType === PreferenceTypes.APPROVAL_REQUIREMENT) {
    factorType = factorType ?? "publishing";
    factorValue = factorValue ?? "require_approval";
  }

  if (preferenceType === PreferenceTypes.CUSTOM) {
    if (!instructionText) {
      return { ok: false, error: "instructionText is required for custom preferences" };
    }
    // custom may carry optional factor tags but must not masquerade as goals/voice.
    const lowered = instructionText.toLowerCase();
    if (
      lowered.includes("brand voice") ||
      lowered.includes("marketing goal") ||
      lowered.includes("preferred words")
    ) {
      return {
        ok: false,
        error: `Use existing settings for goals and brand voice (${AUTHORITATIVE_EXTERNAL_SETTINGS.marketingGoals}, ${AUTHORITATIVE_EXTERNAL_SETTINGS.brandVoiceTone}) rather than a custom preference`,
      };
    }
  }

  const normalized: UpsertPreferenceInput = {
    preferenceType: preferenceType as UpsertPreferenceInput["preferenceType"],
    factorType,
    factorValue,
    instructionText,
    activeUntil,
  };

  // Structured types may omit instructionText; fill a deterministic default before return.
  if (!normalized.instructionText) {
    normalized.instructionText = defaultInstructionText(normalized);
  }

  if (!normalized.instructionText) {
    return { ok: false, error: "instructionText is required" };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function validateRecordOverrideInput(body: unknown): OverrideValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;
  const overrideType = asTrimmedString(record.overrideType ?? record.override_type);

  if (!overrideType || !OVERRIDE_TYPE_VALUES.has(overrideType)) {
    return {
      ok: false,
      error: `overrideType must be one of: ${Object.values(OverrideTypes).join(", ")}`,
    };
  }

  const notes = asOptionalString(record.notes);
  if (notes && notes.length > MAX_OVERRIDE_NOTES_LENGTH) {
    return {
      ok: false,
      error: `notes must be at most ${MAX_OVERRIDE_NOTES_LENGTH} characters`,
    };
  }

  const relatedLearningId = asOptionalString(
    record.relatedLearningId ?? record.related_learning_id
  );
  if (overrideType === OverrideTypes.MARKED_LEARNING_INCORRECT && !relatedLearningId) {
    return {
      ok: false,
      error: "relatedLearningId is required when overrideType is marked_learning_incorrect",
    };
  }

  const factorType = asOptionalString(record.factorType ?? record.factor_type);
  const factorValue = asOptionalString(record.factorValue ?? record.factor_value);

  if (overrideType === OverrideTypes.DISABLED_CONTEXT_FACTOR) {
    if (!factorType || !CONTEXT_CATEGORY_SET.has(factorType)) {
      return {
        ok: false,
        error: "factorType must be a known context category when disabling a context factor",
      };
    }
  }

  const isPermanent =
    typeof record.isPermanent === "boolean"
      ? record.isPermanent
      : typeof record.is_permanent === "boolean"
        ? record.is_permanent
        : false;

  return {
    ok: true,
    value: {
      overrideType: overrideType as OverrideType,
      decisionLinkId: asOptionalString(record.decisionLinkId ?? record.decision_link_id),
      relatedLearningId,
      factorType,
      factorValue:
        overrideType === OverrideTypes.DISABLED_CONTEXT_FACTOR
          ? factorValue ?? "disable"
          : factorValue,
      isPermanent,
      notes,
      clientRequestId: asOptionalString(record.clientRequestId ?? record.client_request_id),
    },
  };
}

export function defaultInstructionText(input: UpsertPreferenceInput): string {
  if (input.instructionText.trim()) return input.instructionText.trim();

  switch (input.preferenceType) {
    case PreferenceTypes.CONTEXT_CATEGORY_TOGGLE:
      return input.factorValue === "enable"
        ? `You may use ${input.factorType} context when relevant.`
        : `Don't use ${input.factorType} events as marketing context.`;
    case PreferenceTypes.PUBLISHING_DAY_RESTRICTION:
      return `Avoid publishing on ${input.factorValue}s.`;
    case PreferenceTypes.CHANNEL_PRIORITY:
      return `Prefer the ${input.factorValue} channel when choosing where to publish.`;
    case PreferenceTypes.APPROVAL_REQUIREMENT:
      return "Always require my approval before publishing.";
    default:
      return input.instructionText;
  }
}
