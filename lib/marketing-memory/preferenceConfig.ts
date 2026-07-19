import "server-only";

import {
  PreferenceContextCategories,
  PreferenceTypes,
  PreferenceToggleActions,
  PublishingDayValues,
  type PreferenceContextCategory,
  type PreferenceType,
  type PreferenceToggleAction,
  type PublishingDayValue,
} from "@/lib/marketing-memory/preferenceTypes";

/** Max length for customer-visible instruction_text / notes — keeps rows bounded. */
export const MAX_INSTRUCTION_TEXT_LENGTH = 500;
export const MAX_OVERRIDE_NOTES_LENGTH = 1000;
/** clientRequestId is folded directly into the server-computed idempotency_key
 * (lib/marketing-memory/preferenceIdempotency.ts) — bounded so a client can't bloat
 * that column with an arbitrarily long token. */
export const MAX_CLIENT_REQUEST_ID_LENGTH = 200;

/**
 * Preference types this phase will accept writes for. content_tone is absent by
 * design (Brand Voice remains authoritative). custom is allowed but never replaces
 * marketing_goals / voice_notes.
 */
export const WRITABLE_PREFERENCE_TYPES: readonly PreferenceType[] = [
  PreferenceTypes.CHANNEL_PRIORITY,
  PreferenceTypes.PUBLISHING_DAY_RESTRICTION,
  PreferenceTypes.CONTEXT_CATEGORY_TOGGLE,
  PreferenceTypes.APPROVAL_REQUIREMENT,
  PreferenceTypes.CUSTOM,
];

export const PREFERENCE_CONTEXT_CATEGORY_VALUES: readonly PreferenceContextCategory[] =
  Object.values(PreferenceContextCategories);

export const PUBLISHING_DAY_VALUES: readonly PublishingDayValue[] = Object.values(PublishingDayValues);

export const PREFERENCE_TOGGLE_ACTIONS: readonly PreferenceToggleAction[] = Object.values(
  PreferenceToggleActions
);

/**
 * Domains that remain authoritative outside marketing_memory_preferences. Preference
 * writes must not claim to own these — validation and docs both enforce the boundary.
 */
export const AUTHORITATIVE_EXTERNAL_SETTINGS = {
  marketingGoals: "business_profiles.marketing_goals",
  voiceNotes: "business_profiles.voice_notes",
  brandVoiceTone: "business_profiles.brand_voice_tone / Brand Voice settings",
  preferredWords: "business_profiles.preferred_words / avoid_words",
} as const;
