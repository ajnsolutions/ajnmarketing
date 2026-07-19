import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestMarketContextBriefWithItemsForUser } from "@/lib/market-context/persistence";
import { getLearningsForBusiness } from "@/lib/marketing-memory/learningPersistence";
import {
  LearningStatuses,
  type MarketingMemoryLearning,
} from "@/lib/marketing-memory/learningTypes";
import type {
  MarketingMemoryEvidencePackage,
  MarketingMemoryIgnoredItem,
  MarketingMemoryLearningSummary,
  MarketingMemoryPreferenceEvidence,
} from "@/lib/marketing-memory/evidenceTypes";
import { listPreferencesForBusiness } from "@/lib/marketing-memory/preferencePersistence";
import type { MarketingMemoryPreference } from "@/lib/marketing-memory/preferenceTypes";

const LIVE_LEARNING_STATUSES = [
  LearningStatuses.EMERGING,
  LearningStatuses.ACTIVE,
  LearningStatuses.WEAKENING,
] as const;

function isPreferenceExpired(preference: MarketingMemoryPreference, now: Date): boolean {
  if (!preference.active_until) return false;
  const until = Date.parse(preference.active_until);
  if (Number.isNaN(until)) return false;
  return until <= now.getTime();
}

function toPreferenceEvidence(preference: MarketingMemoryPreference): MarketingMemoryPreferenceEvidence {
  return {
    id: preference.id,
    preferenceType: preference.preference_type,
    factorType: preference.factor_type,
    factorValue: preference.factor_value,
    instructionText: preference.instruction_text,
    source: preference.source,
    activeUntil: preference.active_until,
  };
}

function toLearningSummary(learning: MarketingMemoryLearning): MarketingMemoryLearningSummary {
  return {
    id: learning.id,
    learningFamily: learning.learning_family,
    subjectKey: learning.subject_key,
    timeDimension: learning.time_dimension,
    direction: learning.direction,
    confidenceLevel: learning.confidence_level,
    status: learning.status,
    summary: learning.summary,
  };
}

function partitionPreferences(
  rows: MarketingMemoryPreference[],
  now: Date
): {
  active: MarketingMemoryPreferenceEvidence[];
  ignored: MarketingMemoryIgnoredItem[];
} {
  const active: MarketingMemoryPreferenceEvidence[] = [];
  const ignored: MarketingMemoryIgnoredItem[] = [];

  for (const row of rows) {
    if (!row.is_active) {
      ignored.push({ id: row.id, reason: "revoked_or_inactive" });
      continue;
    }
    if (isPreferenceExpired(row, now)) {
      ignored.push({ id: row.id, reason: "temporary_preference_expired" });
      continue;
    }
    active.push(toPreferenceEvidence(row));
  }

  // Deterministic order: preference type, then factor, then id.
  active.sort((a, b) => {
    const typeCmp = a.preferenceType.localeCompare(b.preferenceType);
    if (typeCmp !== 0) return typeCmp;
    const factorCmp = (a.factorType ?? "").localeCompare(b.factorType ?? "");
    if (factorCmp !== 0) return factorCmp;
    return a.id.localeCompare(b.id);
  });

  return { active, ignored };
}

function partitionLearnings(rows: MarketingMemoryLearning[]): {
  eligible: MarketingMemoryLearningSummary[];
  ignored: MarketingMemoryIgnoredItem[];
} {
  const eligible: MarketingMemoryLearningSummary[] = [];
  const ignored: MarketingMemoryIgnoredItem[] = [];

  for (const row of rows) {
    if (row.status === LearningStatuses.SUPERSEDED) {
      ignored.push({ id: row.id, reason: "superseded" });
      continue;
    }
    if (row.status === LearningStatuses.ARCHIVED) {
      ignored.push({ id: row.id, reason: "archived" });
      continue;
    }
    if (row.status === LearningStatuses.INCONCLUSIVE) {
      ignored.push({ id: row.id, reason: "insufficient_evidence_inconclusive" });
      continue;
    }
    if (!LIVE_LEARNING_STATUSES.includes(row.status as (typeof LIVE_LEARNING_STATUSES)[number])) {
      ignored.push({ id: row.id, reason: `inactive_status:${row.status}` });
      continue;
    }
    if (row.direction === "neutral" || row.direction === "inconclusive") {
      ignored.push({ id: row.id, reason: "no_directional_claim" });
      continue;
    }
    if (row.sample_size < 2) {
      ignored.push({ id: row.id, reason: "insufficient_evidence_sample" });
      continue;
    }
    eligible.push(toLearningSummary(row));
  }

  eligible.sort((a, b) => {
    const confidenceOrder = { strong_pattern: 0, developing_pattern: 1, early_signal: 2 } as const;
    const confCmp = confidenceOrder[a.confidenceLevel] - confidenceOrder[b.confidenceLevel];
    if (confCmp !== 0) return confCmp;
    return a.id.localeCompare(b.id);
  });

  return { eligible, ignored };
}

/**
 * Batched, tenant-scoped evidence load for Marketing Director. Parallel reads only —
 * no N+1. Failures degrade to empty evidence (cold start), never throw into the briefing.
 */
export async function buildMarketingMemoryEvidencePackage(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  options: { activeGoals?: string[]; now?: Date } = {}
): Promise<MarketingMemoryEvidencePackage> {
  const now = options.now ?? new Date();
  const evaluatedAt = now.toISOString();

  const empty: MarketingMemoryEvidencePackage = {
    businessProfileId,
    preferences: [],
    learnings: [],
    ignoredLearnings: [],
    ignoredPreferences: [],
    disabledContextTypes: [],
    marketContextSignals: [],
    activeGoals: options.activeGoals ?? [],
    isColdStart: true,
    evaluatedAt,
  };

  try {
    const [preferenceRows, learningRows, briefWithItems] = await Promise.all([
      listPreferencesForBusiness(supabase, userId, businessProfileId, { activeOnly: false }),
      getLearningsForBusiness(supabase, userId, businessProfileId),
      getLatestMarketContextBriefWithItemsForUser(supabase, userId),
    ]);

    const { active: preferences, ignored: ignoredPreferences } = partitionPreferences(
      preferenceRows,
      now
    );
    const { eligible: learnings, ignored: ignoredLearnings } = partitionLearnings(learningRows);

    const disabledContextTypes = [
      ...new Set(
        preferences
          .filter(
            (preference) =>
              preference.preferenceType === "context_category_toggle" &&
              preference.factorValue === "disable" &&
              preference.factorType
          )
          .map((preference) => preference.factorType as string)
      ),
    ].sort();

    const marketContextSignals = (briefWithItems?.items ?? [])
      .filter((item) => !disabledContextTypes.includes(item.category))
      .map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const isColdStart = preferences.length === 0 && learnings.length === 0;

    return {
      businessProfileId,
      preferences,
      learnings,
      ignoredLearnings,
      ignoredPreferences,
      disabledContextTypes,
      marketContextSignals,
      activeGoals: options.activeGoals ?? [],
      isColdStart,
      evaluatedAt,
    };
  } catch {
    return empty;
  }
}
