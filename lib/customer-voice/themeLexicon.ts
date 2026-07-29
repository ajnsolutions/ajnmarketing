/**
 * Deterministic theme lexicon + synonym clusters.
 * Phase 1 extracts themes without calling a new AI engine.
 */

import type { ThemeKind } from "@/lib/customer-voice/types";
import { ThemeKinds } from "@/lib/customer-voice/types";

export type ThemeClusterDefinition = {
  key: string;
  label: string;
  kind: ThemeKind;
  /** Lowercase phrases / tokens that map to this theme. */
  phrases: readonly string[];
  /** Impact bias: acquisition | conversion | repeat | referrals | reputation */
  impactHints: readonly (
    | "acquisition"
    | "conversion"
    | "repeat"
    | "referrals"
    | "reputation"
  )[];
};

export const THEME_CLUSTERS: readonly ThemeClusterDefinition[] = [
  {
    key: "fast_service",
    label: "Fast Service",
    kind: ThemeKinds.STRENGTH,
    phrases: [
      "fast",
      "quick",
      "same-day",
      "same day",
      "prompt",
      "speedy",
      "timely",
      "right away",
      "on time",
      "quick turnaround",
      "same-day response",
    ],
    impactHints: ["conversion", "referrals", "reputation"],
  },
  {
    key: "friendly_staff",
    label: "Friendly Staff",
    kind: ThemeKinds.STRENGTH,
    phrases: [
      "friendly",
      "kind",
      "courteous",
      "welcoming",
      "nice staff",
      "great staff",
      "helpful staff",
      "pleasant",
    ],
    impactHints: ["repeat", "referrals", "reputation"],
  },
  {
    key: "professional_expertise",
    label: "Professional Expertise",
    kind: ThemeKinds.STRENGTH,
    phrases: [
      "professional",
      "knowledgeable",
      "expert",
      "skilled",
      "experienced",
      "knows what",
      "highly recommend",
    ],
    impactHints: ["acquisition", "conversion", "reputation"],
  },
  {
    key: "quality_work",
    label: "Quality Work",
    kind: ThemeKinds.STRENGTH,
    phrases: [
      "quality",
      "excellent work",
      "great job",
      "well done",
      "thorough",
      "attention to detail",
      "top notch",
      "top-notch",
    ],
    impactHints: ["repeat", "referrals", "reputation"],
  },
  {
    key: "clear_communication",
    label: "Clear Communication",
    kind: ThemeKinds.STRENGTH,
    phrases: [
      "communicat",
      "kept me informed",
      "explained",
      "transparent",
      "easy to work with",
      "responsive",
    ],
    impactHints: ["conversion", "repeat", "reputation"],
  },
  {
    key: "pricing_concerns",
    label: "Pricing Clarity",
    kind: ThemeKinds.CONCERN,
    phrases: [
      "expensive",
      "overpriced",
      "too costly",
      "price was high",
      "pricing unclear",
      "hidden fees",
      "quote changed",
    ],
    impactHints: ["conversion", "acquisition"],
  },
  {
    key: "wait_time",
    label: "Wait Time",
    kind: ThemeKinds.CONCERN,
    phrases: [
      "waited",
      "long wait",
      "took forever",
      "late",
      "delayed",
      "slow service",
      "no-show",
      "no show",
    ],
    impactHints: ["conversion", "reputation"],
  },
  {
    key: "scheduling_flexibility",
    label: "Scheduling Flexibility",
    kind: ThemeKinds.OPPORTUNITY,
    phrases: [
      "hard to schedule",
      "couldn't get an appointment",
      "weekend availability",
      "after hours",
      "flexible schedule",
      "easy to book",
    ],
    impactHints: ["acquisition", "conversion"],
  },
  {
    key: "follow_up_request",
    label: "Follow-Up Requests",
    kind: ThemeKinds.REQUEST,
    phrases: [
      "wish they",
      "would love if",
      "please offer",
      "hope they",
      "should add",
      "need more",
      "would be nice",
    ],
    impactHints: ["repeat", "conversion"],
  },
  {
    key: "cleanliness",
    label: "Cleanliness",
    kind: ThemeKinds.DIFFERENTIATOR,
    phrases: ["clean", "spotless", "tidy", "organized space", "well maintained"],
    impactHints: ["reputation", "referrals"],
  },
] as const;

const EMPLOYEE_HINT =
  /\b(?:with|by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b|(?:thank(?:s| you)?)\s+([A-Z][a-z]+)\b/g;

const SERVICE_HINT_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "their",
  "this",
  "that",
  "from",
  "were",
  "have",
  "been",
  "very",
  "really",
  "great",
  "good",
  "service",
  "business",
  "company",
  "team",
  "staff",
  "people",
  "today",
  "always",
]);

export function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMatchingClusters(text: string): ThemeClusterDefinition[] {
  const normalized = normalizePhrase(text);
  if (!normalized) return [];
  return THEME_CLUSTERS.filter((cluster) =>
    cluster.phrases.some((phrase) => normalized.includes(normalizePhrase(phrase))),
  );
}

export function extractEmployeeMentions(text: string): string[] {
  const names = new Set<string>();
  const copy = text;
  let match: RegExpExecArray | null;
  const regex = new RegExp(EMPLOYEE_HINT.source, "g");
  while ((match = regex.exec(copy)) !== null) {
    const name = (match[1] ?? match[2] ?? "").trim();
    if (name.length >= 2 && name.length <= 40) names.add(name);
  }
  return [...names];
}

/**
 * Lightweight service mention extraction from free text —
 * prefers multi-word noun-ish tokens; never invents a catalog.
 */
export function extractServiceMentions(text: string, knownServices: string[] = []): string[] {
  const found = new Set<string>();
  const normalized = normalizePhrase(text);
  for (const service of knownServices) {
    const needle = normalizePhrase(service);
    if (needle.length >= 3 && normalized.includes(needle)) {
      found.add(service.trim());
    }
  }

  // Fallback: capture "their X service/repair/install" style phrases.
  const generic =
    /\b(?:their|the|your)?\s*([a-z]{3,}(?:\s+[a-z]{3,}){0,2})\s+(?:service|repair|install|cleaning|treatment|session|membership)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = generic.exec(text)) !== null) {
    const candidate = (match[1] ?? "").trim();
    const tokens = candidate.split(/\s+/).filter((t) => !SERVICE_HINT_STOPWORDS.has(t));
    if (tokens.length > 0) {
      found.add(tokens.map((t) => t[0]!.toUpperCase() + t.slice(1)).join(" "));
    }
  }
  return [...found].slice(0, 8);
}

export function clusterKeyForVariant(variant: string): string | null {
  const normalized = normalizePhrase(variant);
  for (const cluster of THEME_CLUSTERS) {
    if (cluster.phrases.some((phrase) => normalizePhrase(phrase) === normalized)) {
      return cluster.key;
    }
    if (cluster.phrases.some((phrase) => normalized.includes(normalizePhrase(phrase)))) {
      return cluster.key;
    }
  }
  return null;
}
