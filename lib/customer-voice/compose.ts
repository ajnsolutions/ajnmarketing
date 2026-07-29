/**
 * Compose Customer Voice intelligence from normalized evidence.
 * Pure — no I/O. Providers feed evidence; compose produces Business Brain package.
 */

import { calculateThemeConfidence, rollupConfidence } from "@/lib/customer-voice/confidence";
import { calculateBusinessImpact, rollupBusinessImpact } from "@/lib/customer-voice/impact";
import { THEME_CLUSTERS } from "@/lib/customer-voice/themeLexicon";
import { calculateCustomerVoiceScore } from "@/lib/customer-voice/score";
import { extractThemesFromText } from "@/lib/customer-voice/themes";
import type {
  CustomerVoiceIntelligence,
  CustomerVoiceProviderId,
  CustomerVoiceSentiment,
  CustomerVoiceTheme,
  NormalizedCustomerEvidence,
  SentimentTrendPoint,
  ThemeKind,
  TrendDirection,
} from "@/lib/customer-voice/types";
import {
  CustomerVoiceSentiments,
  ThemeKinds,
  TrendDirections,
} from "@/lib/customer-voice/types";

type WorkingTheme = {
  key: string;
  label: string;
  kind: ThemeKind;
  impactHints: readonly string[];
  evidenceIds: string[];
  languageVariants: Set<string>;
  providerIds: Set<CustomerVoiceProviderId>;
  sentiments: CustomerVoiceSentiment[];
  dates: string[];
  weightedSupport: number;
};

function clusterMeta(key: string) {
  return THEME_CLUSTERS.find((c) => c.key === key) ?? null;
}

function ensureTheme(
  map: Map<string, WorkingTheme>,
  key: string,
  label: string,
  kind: ThemeKind,
  impactHints: readonly string[],
): WorkingTheme {
  let theme = map.get(key);
  if (!theme) {
    theme = {
      key,
      label,
      kind,
      impactHints,
      evidenceIds: [],
      languageVariants: new Set(),
      providerIds: new Set(),
      sentiments: [],
      dates: [],
      weightedSupport: 0,
    };
    map.set(key, theme);
  }
  return theme;
}

function trendForTheme(dates: string[], now: Date): TrendDirection {
  if (dates.length < 3) return TrendDirections.UNKNOWN;
  const mid = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  let recent = 0;
  let older = 0;
  for (const iso of dates) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= mid) recent += 1;
    else older += 1;
  }
  if (recent === 0 && older === 0) return TrendDirections.UNKNOWN;
  if (recent > older * 1.4) return TrendDirections.IMPROVING;
  if (older > recent * 1.4) return TrendDirections.DECLINING;
  return TrendDirections.STABLE;
}

function dominantSentiment(items: CustomerVoiceSentiment[]): CustomerVoiceSentiment {
  if (items.length === 0) return CustomerVoiceSentiments.NEUTRAL;
  const counts: Record<string, number> = {};
  for (const s of items) counts[s] = (counts[s] ?? 0) + 1;
  const positive = counts[CustomerVoiceSentiments.POSITIVE] ?? 0;
  const negative = counts[CustomerVoiceSentiments.NEGATIVE] ?? 0;
  const neutral = counts[CustomerVoiceSentiments.NEUTRAL] ?? 0;
  if (positive > 0 && negative > 0 && Math.abs(positive - negative) <= 1) {
    return CustomerVoiceSentiments.MIXED;
  }
  if (positive >= negative && positive >= neutral) return CustomerVoiceSentiments.POSITIVE;
  if (negative >= positive && negative >= neutral) return CustomerVoiceSentiments.NEGATIVE;
  return CustomerVoiceSentiments.NEUTRAL;
}

function buildSentimentTrends(
  evidence: NormalizedCustomerEvidence[],
  now: Date,
): SentimentTrendPoint[] {
  const buckets = new Map<string, NormalizedCustomerEvidence[]>();
  for (const item of evidence) {
    const d = item.occurredAt ? new Date(item.occurredAt) : now;
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([periodKey, items]) => {
      const n = items.length || 1;
      const positive = items.filter((i) => i.sentiment === "positive").length;
      const negative = items.filter((i) => i.sentiment === "negative").length;
      const neutral = items.filter((i) => i.sentiment === "neutral").length;
      return {
        periodKey,
        positiveShare: Math.round((positive / n) * 1000) / 10,
        negativeShare: Math.round((negative / n) * 1000) / 10,
        neutralShare: Math.round((neutral / n) * 1000) / 10,
        evidenceCount: items.length,
      };
    });
}

function finalizeTheme(
  working: WorkingTheme,
  totalEvidence: number,
  now: Date,
): CustomerVoiceTheme {
  const recentCutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  const recentShare =
    working.dates.length === 0
      ? 0
      : working.dates.filter((iso) => new Date(iso).getTime() >= recentCutoff).length /
        working.dates.length;

  const dominant = dominantSentiment(working.sentiments);
  const consistency =
    working.sentiments.length === 0
      ? 0
      : working.sentiments.filter((s) => s === dominant).length / working.sentiments.length;

  const { confidence, percentageOfReviews } = calculateThemeConfidence({
    evidenceCount: working.evidenceIds.length,
    totalEvidence,
    providerCount: working.providerIds.size,
    recentShare,
    consistency,
  });

  const businessImpact = calculateBusinessImpact({
    kind: working.kind,
    impactHints: working.impactHints,
    evidenceCount: working.evidenceIds.length,
    percentageOfReviews,
    confidence,
  });

  return {
    key: working.key,
    label: working.label,
    kind: working.kind,
    sentiment: dominant,
    confidence,
    businessImpact,
    evidenceCount: working.evidenceIds.length,
    percentageOfReviews,
    trendDirection: trendForTheme(working.dates, now),
    languageVariants: [...working.languageVariants].slice(0, 12),
    evidenceIds: working.evidenceIds,
    lastUpdated: now.toISOString(),
  };
}

function bySupportThenImpact(a: CustomerVoiceTheme, b: CustomerVoiceTheme): number {
  const impactRank = { high: 0, medium: 1, low: 2 } as const;
  if (a.evidenceCount !== b.evidenceCount) return b.evidenceCount - a.evidenceCount;
  return impactRank[a.businessImpact] - impactRank[b.businessImpact];
}

export function composeCustomerVoiceIntelligence(input: {
  businessProfileId: string;
  evidence: NormalizedCustomerEvidence[];
  now?: Date;
}): CustomerVoiceIntelligence {
  const now = input.now ?? new Date();
  const evidence = input.evidence;
  const generatedAt = now.toISOString();
  const providers = [...new Set(evidence.map((e) => e.sourceProviderId))];

  if (evidence.length === 0) {
    const score = calculateCustomerVoiceScore({
      evidence: [],
      themeCount: 0,
      highConfidenceThemes: 0,
      overallConfidence: "low",
      now,
    });
    return {
      businessProfileId: input.businessProfileId,
      generatedAt,
      lastUpdated: generatedAt,
      strengths: [],
      concerns: [],
      opportunities: [],
      frequentlyMentionedServices: [],
      frequentlyMentionedEmployees: [],
      commonCustomerLanguage: [],
      requests: [],
      sentimentTrends: [],
      overallSentiment: CustomerVoiceSentiments.NEUTRAL,
      confidence: "low",
      businessImpact: "low",
      evidenceCount: 0,
      percentageOfReviewsCovered: 0,
      trendDirection: TrendDirections.UNKNOWN,
      score,
      contributingProviders: [],
      emptyState: "no_evidence",
    };
  }

  const themes = new Map<string, WorkingTheme>();
  const serviceMentions = new Map<string, WorkingTheme>();
  const employeeMentions = new Map<string, WorkingTheme>();
  const languageMentions = new Map<string, WorkingTheme>();

  for (const item of evidence) {
    const extraction = extractThemesFromText(item.originalText);

    for (const hit of extraction.hits) {
      const meta = clusterMeta(hit.clusterKey);
      const theme = ensureTheme(
        themes,
        hit.clusterKey,
        hit.label,
        hit.kind,
        meta?.impactHints ?? hit.impactHints,
      );
      if (!theme.evidenceIds.includes(item.id)) theme.evidenceIds.push(item.id);
      theme.languageVariants.add(hit.matchedPhrase);
      theme.providerIds.add(item.sourceProviderId);
      theme.sentiments.push(item.sentiment);
      if (item.occurredAt) theme.dates.push(item.occurredAt);
      theme.weightedSupport += item.evidenceWeight;
      // Multi-provider duplicate themes strengthen the same bucket.
      if (theme.providerIds.size > 1) {
        theme.weightedSupport += 0.15;
      }
    }

    for (const service of item.referencedServices) {
      const key = `service:${service.toLowerCase()}`;
      const theme = ensureTheme(serviceMentions, key, service, ThemeKinds.SERVICE, [
        "acquisition",
        "conversion",
      ]);
      if (!theme.evidenceIds.includes(item.id)) theme.evidenceIds.push(item.id);
      theme.providerIds.add(item.sourceProviderId);
      theme.sentiments.push(item.sentiment);
      if (item.occurredAt) theme.dates.push(item.occurredAt);
      theme.languageVariants.add(service);
      theme.weightedSupport += item.evidenceWeight;
    }

    for (const employee of item.referencedEmployees) {
      const key = `employee:${employee.toLowerCase()}`;
      const theme = ensureTheme(employeeMentions, key, employee, ThemeKinds.EMPLOYEE, [
        "referrals",
        "reputation",
      ]);
      if (!theme.evidenceIds.includes(item.id)) theme.evidenceIds.push(item.id);
      theme.providerIds.add(item.sourceProviderId);
      theme.sentiments.push(item.sentiment);
      if (item.occurredAt) theme.dates.push(item.occurredAt);
      theme.languageVariants.add(employee);
      theme.weightedSupport += item.evidenceWeight;
    }

    for (const phrase of extraction.languagePhrases) {
      const key = `lang:${phrase.toLowerCase().slice(0, 48)}`;
      const theme = ensureTheme(languageMentions, key, phrase, ThemeKinds.LANGUAGE, [
        "reputation",
      ]);
      if (!theme.evidenceIds.includes(item.id)) theme.evidenceIds.push(item.id);
      theme.providerIds.add(item.sourceProviderId);
      theme.sentiments.push(item.sentiment);
      if (item.occurredAt) theme.dates.push(item.occurredAt);
      theme.languageVariants.add(phrase);
      theme.weightedSupport += item.evidenceWeight * 0.5;
    }
  }

  const total = evidence.length;
  const finalized = [...themes.values()].map((t) => finalizeTheme(t, total, now));
  // Never overreact: drop single-evidence concerns/strengths from top lists unless medium+.
  const meaningful = finalized.filter(
    (t) => t.evidenceCount >= 2 || t.confidence !== "low",
  );

  const strengths = meaningful
    .filter((t) => t.kind === ThemeKinds.STRENGTH || t.kind === ThemeKinds.DIFFERENTIATOR)
    .filter((t) => t.sentiment !== "negative")
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const concerns = meaningful
    .filter((t) => t.kind === ThemeKinds.CONCERN)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const opportunities = meaningful
    .filter((t) => t.kind === ThemeKinds.OPPORTUNITY)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const requests = meaningful
    .filter((t) => t.kind === ThemeKinds.REQUEST)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const frequentlyMentionedServices = [...serviceMentions.values()]
    .map((t) => finalizeTheme(t, total, now))
    .filter((t) => t.evidenceCount >= 1)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const frequentlyMentionedEmployees = [...employeeMentions.values()]
    .map((t) => finalizeTheme(t, total, now))
    .filter((t) => t.evidenceCount >= 1)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const commonCustomerLanguage = [...languageMentions.values()]
    .map((t) => finalizeTheme(t, total, now))
    .filter((t) => t.evidenceCount >= 1)
    .sort(bySupportThenImpact)
    .slice(0, 10);

  const allForRollup = [...meaningful, ...frequentlyMentionedServices];
  const confidence = rollupConfidence(allForRollup.map((t) => t.confidence));
  const businessImpact = rollupBusinessImpact(allForRollup.map((t) => t.businessImpact));
  const highConfidenceThemes = allForRollup.filter((t) => t.confidence === "high").length;

  const score = calculateCustomerVoiceScore({
    evidence,
    themeCount: allForRollup.length,
    highConfidenceThemes,
    overallConfidence: confidence,
    now,
  });

  const withThemes = evidence.filter((e) => e.extractedThemes.length > 0).length;

  return {
    businessProfileId: input.businessProfileId,
    generatedAt,
    lastUpdated: generatedAt,
    strengths,
    concerns,
    opportunities,
    frequentlyMentionedServices,
    frequentlyMentionedEmployees,
    commonCustomerLanguage,
    requests,
    sentimentTrends: buildSentimentTrends(evidence, now),
    overallSentiment: dominantSentiment(evidence.map((e) => e.sentiment)),
    confidence,
    businessImpact,
    evidenceCount: evidence.length,
    percentageOfReviewsCovered:
      evidence.length === 0 ? 0 : Math.round((withThemes / evidence.length) * 1000) / 10,
    trendDirection: trendForTheme(
      evidence.map((e) => e.occurredAt).filter(Boolean) as string[],
      now,
    ),
    score,
    contributingProviders: providers,
    emptyState: evidence.length < 3 ? "insufficient_evidence" : null,
  };
}
