import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  insertOverride,
  learningBelongsToBusiness,
  linkOverrideAsContradictingEvidence,
  linkOverrideToPreference,
  listOverridesForBusiness,
} from "@/lib/marketing-memory/overridePersistence";
import { upsertPreferenceWithSupersession } from "@/lib/marketing-memory/preferencePersistence";
import {
  OverrideTypes,
  PreferenceSources,
  PreferenceTypes,
  type MarketingMemoryOverride,
  type MarketingMemoryPreference,
} from "@/lib/marketing-memory/preferenceTypes";
import { validateRecordOverrideInput } from "@/lib/marketing-memory/preferenceValidation";

export type OverrideServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

async function resolveClient(supabaseClient?: SupabaseClient): Promise<SupabaseClient> {
  return supabaseClient ?? (await createClient());
}

/** Structured, secret-free server log — mirrors the `console.info/error("[Scope]",
 * {...})` convention already established in lib/marketing-memory/service.ts. */
function logOverrideEvent(line: {
  event: string;
  businessProfileId: string;
  overrideId?: string;
  preferenceId?: string;
  result?: "success" | "error";
}): void {
  if (line.result === "error") {
    console.error("[MarketingMemoryOverrides]", line);
  } else {
    console.info("[MarketingMemoryOverrides]", line);
  }
}

function instructionForPermanentOverride(input: {
  overrideType: string;
  factorType?: string | null;
  factorValue?: string | null;
  notes?: string | null;
}): { preferenceType: (typeof PreferenceTypes)[keyof typeof PreferenceTypes]; factorType: string | null; factorValue: string | null; instructionText: string } | null {
  if (input.overrideType === OverrideTypes.DISABLED_CONTEXT_FACTOR && input.factorType) {
    return {
      preferenceType: PreferenceTypes.CONTEXT_CATEGORY_TOGGLE,
      factorType: input.factorType,
      factorValue: "disable",
      instructionText:
        input.notes?.trim() ||
        `Don't use ${input.factorType} events as marketing context.`,
    };
  }

  if (input.overrideType === OverrideTypes.CHOSE_DIFFERENT_TIME && input.factorValue) {
    return {
      preferenceType: PreferenceTypes.PUBLISHING_DAY_RESTRICTION,
      factorType: "day_of_week",
      factorValue: input.factorValue.toLowerCase(),
      instructionText:
        input.notes?.trim() || `Avoid publishing on ${input.factorValue.toLowerCase()}s.`,
    };
  }

  // Permanent but unstructured — store as custom only when notes carry the instruction.
  if (input.notes?.trim()) {
    return {
      preferenceType: PreferenceTypes.CUSTOM,
      factorType: input.overrideType,
      factorValue: null,
      instructionText: input.notes.trim(),
    };
  }

  return null;
}

export async function getOverridesForBusiness(
  userId: string,
  businessProfileId: string,
  options: { supabaseClient?: SupabaseClient } = {}
): Promise<MarketingMemoryOverride[]> {
  const supabase = await resolveClient(options.supabaseClient);
  return listOverridesForBusiness(supabase, userId, businessProfileId);
}

/**
 * Records an override (append-only). When is_permanent is true, promotes into a
 * durable preference via supersession — never inferred, never written by a job.
 * Does not alter Marketing Director or recommendation behavior.
 */
export async function recordOverrideForBusiness(
  userId: string,
  businessProfileId: string,
  body: unknown,
  options: { supabaseClient?: SupabaseClient; actorUserId?: string } = {}
): Promise<
  OverrideServiceResult<{
    override: MarketingMemoryOverride;
    preference: MarketingMemoryPreference | null;
  }>
> {
  const parsed = validateRecordOverrideInput(body);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, status: 400 };
  }

  const supabase = await resolveClient(options.supabaseClient);
  const actorUserId = options.actorUserId ?? userId;

  if (parsed.value.relatedLearningId) {
    const owned = await learningBelongsToBusiness(
      supabase,
      userId,
      businessProfileId,
      parsed.value.relatedLearningId
    );
    if (!owned) {
      return { ok: false, error: "relatedLearningId does not belong to this business", status: 400 };
    }
  }

  const override = await insertOverride(supabase, {
    userId,
    businessProfileId,
    actorUserId,
    input: parsed.value,
  });

  if (!override) {
    return { ok: false, error: "Failed to record override", status: 500 };
  }

  if (
    override.override_type === OverrideTypes.MARKED_LEARNING_INCORRECT &&
    override.related_learning_id
  ) {
    await linkOverrideAsContradictingEvidence(supabase, {
      userId,
      businessProfileId,
      learningId: override.related_learning_id,
      overrideId: override.id,
    });
  }

  let preference: MarketingMemoryPreference | null = null;

  if (override.is_permanent && !override.promoted_to_preference_id) {
    const promotion = instructionForPermanentOverride({
      overrideType: override.override_type,
      factorType: override.factor_type,
      factorValue: override.factor_value,
      notes: override.notes,
    });

    if (promotion) {
      const { preference: created } = await upsertPreferenceWithSupersession(supabase, {
        userId,
        businessProfileId,
        actorUserId,
        input: {
          preferenceType: promotion.preferenceType,
          factorType: promotion.factorType,
          factorValue: promotion.factorValue,
          instructionText: promotion.instructionText,
        },
        source: PreferenceSources.PROMOTED_OVERRIDE,
        promotedFromOverrideId: override.id,
      });

      preference = created;
      if (created) {
        const linked = await linkOverrideToPreference(
          supabase,
          userId,
          override.id,
          created.id
        );
        if (linked) {
          logOverrideEvent({
            event: "override_promoted",
            businessProfileId,
            overrideId: override.id,
            preferenceId: created.id,
          });
          return { ok: true, value: { override: linked, preference } };
        }

        // The preference was created (and is durable — findActivePreferenceByIdentity
        // will find it on any retry, so upsertPreferenceWithSupersession's idempotent
        // no-op path prevents a duplicate), but the override's own forward link could
        // not be written. Never silently lose this: log it so it's observable, even
        // though the response below still honestly reports override.promoted_to_
        // preference_id as null (the response never claims a link that doesn't exist).
        logOverrideEvent({
          event: "override_promotion_link_failed",
          businessProfileId,
          overrideId: override.id,
          preferenceId: created.id,
          result: "error",
        });
      }
    }
  }

  return { ok: true, value: { override, preference } };
}
