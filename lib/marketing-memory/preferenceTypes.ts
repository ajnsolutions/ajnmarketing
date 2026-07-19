import "server-only";

/**
 * Marketing Memory Phase 3 — preferences and overrides types / closed vocabularies.
 * See docs/MARKETING_MEMORY_PREFERENCES.md. Every enum here has a matching `check`
 * constraint in supabase/migrations/026_marketing_memory_preferences.sql — this file
 * and that migration must be changed together.
 *
 * content_tone is intentionally absent: Brand Voice / business_profiles voice fields
 * remain authoritative for tone.
 */

export const PreferenceTypes = {
  CHANNEL_PRIORITY: "channel_priority",
  PUBLISHING_DAY_RESTRICTION: "publishing_day_restriction",
  CONTEXT_CATEGORY_TOGGLE: "context_category_toggle",
  APPROVAL_REQUIREMENT: "approval_requirement",
  CUSTOM: "custom",
} as const;

export type PreferenceType = (typeof PreferenceTypes)[keyof typeof PreferenceTypes];

export const PreferenceSources = {
  EXPLICIT_STATEMENT: "explicit_statement",
  PROMOTED_OVERRIDE: "promoted_override",
} as const;

export type PreferenceSource = (typeof PreferenceSources)[keyof typeof PreferenceSources];

export const OverrideTypes = {
  CHOSE_DIFFERENT_ACTION: "chose_different_action",
  CHOSE_DIFFERENT_TIME: "chose_different_time",
  DISABLED_CONTEXT_FACTOR: "disabled_context_factor",
  MARKED_LEARNING_INCORRECT: "marked_learning_incorrect",
  DEFERRED_RECOMMENDATION: "deferred_recommendation",
} as const;

export type OverrideType = (typeof OverrideTypes)[keyof typeof OverrideTypes];

/**
 * Context categories a customer may disable via context_category_toggle.
 * Includes today's market_context categories plus architecture-reserved cautious
 * categories (political_civic, sports_entertainment) that have no provider yet —
 * allowing an explicit pre-disable without inventing provider behavior.
 */
export const PreferenceContextCategories = {
  WEATHER: "weather",
  HOLIDAY: "holiday",
  LOCAL_EVENT: "local_event",
  SCHOOL_CALENDAR: "school_calendar",
  COMPETITOR: "competitor",
  NEWS: "news",
  TREND: "trend",
  POLITICAL_CIVIC: "political_civic",
  SPORTS_ENTERTAINMENT: "sports_entertainment",
} as const;

export type PreferenceContextCategory =
  (typeof PreferenceContextCategories)[keyof typeof PreferenceContextCategories];

export const PreferenceToggleActions = {
  DISABLE: "disable",
  ENABLE: "enable",
} as const;

export type PreferenceToggleAction =
  (typeof PreferenceToggleActions)[keyof typeof PreferenceToggleActions];

export const PublishingDayValues = {
  SUNDAY: "sunday",
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
} as const;

export type PublishingDayValue = (typeof PublishingDayValues)[keyof typeof PublishingDayValues];

/** One row of public.marketing_memory_preferences. */
export type MarketingMemoryPreference = {
  id: string;
  user_id: string;
  business_profile_id: string;
  preference_type: PreferenceType;
  factor_type: string | null;
  factor_value: string | null;
  instruction_text: string;
  is_active: boolean;
  active_until: string | null;
  source: PreferenceSource;
  promoted_from_override_id: string | null;
  supersedes_preference_id: string | null;
  created_by: string;
  updated_by: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

/** One row of public.marketing_memory_overrides. */
export type MarketingMemoryOverride = {
  id: string;
  user_id: string;
  business_profile_id: string;
  decision_link_id: string | null;
  override_type: OverrideType;
  related_learning_id: string | null;
  factor_type: string | null;
  factor_value: string | null;
  is_permanent: boolean;
  promoted_to_preference_id: string | null;
  notes: string | null;
  created_by: string;
  idempotency_key: string;
  created_at: string;
};

/**
 * Narrow, presentation-safe preference summary for future MarketingMemoryEvidencePackage
 * (Phase 4). Phase 3 returns this shape from read helpers but does not feed it into
 * resolveMarketingDirectorDecision.
 */
export type MarketingMemoryPreferenceSummary = {
  id: string;
  preferenceType: PreferenceType;
  factorType: string | null;
  factorValue: string | null;
  instructionText: string;
  source: PreferenceSource;
  isActive: boolean;
  activeUntil: string | null;
  /** Always "confirmed_preference" for explicit customer preferences — never inferred. */
  confidenceLabel: "confirmed_preference";
};

export type UpsertPreferenceInput = {
  preferenceType: PreferenceType;
  factorType?: string | null;
  factorValue?: string | null;
  instructionText: string;
  activeUntil?: string | null;
};

export type RecordOverrideInput = {
  overrideType: OverrideType;
  decisionLinkId?: string | null;
  relatedLearningId?: string | null;
  factorType?: string | null;
  factorValue?: string | null;
  isPermanent?: boolean;
  notes?: string | null;
  /** Optional client-supplied dedupe token; server still prefixes with tenant scope. */
  clientRequestId?: string | null;
};
