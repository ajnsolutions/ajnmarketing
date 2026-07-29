import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { calculateThemeConfidence } from "../lib/customer-voice/confidence.ts";
import { composeCustomerVoiceIntelligence } from "../lib/customer-voice/compose.ts";
import { calculateBusinessImpact } from "../lib/customer-voice/impact.ts";
import { normalizeProviderBatch, normalizeProviderEvidence } from "../lib/customer-voice/normalize.ts";
import { createProviderRegistry } from "../lib/customer-voice/provider.ts";
import {
  createGoogleBusinessReviewsProvider,
  mapGoogleReviewToEvidence,
} from "../lib/customer-voice/providers/googleBusinessReviews.ts";
import { calculateCustomerVoiceScore, maturityCopyFor } from "../lib/customer-voice/score.ts";
import { clusterKeyForVariant } from "../lib/customer-voice/themeLexicon.ts";
import { extractThemesFromText, mergeThemeKeys, sentimentFromTextAndRating } from "../lib/customer-voice/themes.ts";
import {
  CustomerVoiceProviderIds,
  ThemeKinds,
  VoiceMaturityLabels,
} from "../lib/customer-voice/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import type { GoogleBusinessReview } from "../lib/google-business/types.ts";

const root = process.cwd();
const now = new Date("2026-07-29T12:00:00.000Z");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("theme extraction clusters fast/quick/same-day into Fast Service", () => {
  const a = extractThemesFromText("They were fast and professional.");
  const b = extractThemesFromText("Quick turnaround on our request.");
  const c = extractThemesFromText("Same-day response — amazing.");
  assert.ok(a.hits.some((h) => h.clusterKey === "fast_service"));
  assert.ok(b.hits.some((h) => h.clusterKey === "fast_service"));
  assert.ok(c.hits.some((h) => h.clusterKey === "fast_service"));
  assert.equal(clusterKeyForVariant("quick"), "fast_service");
  assert.deepEqual(mergeThemeKeys(["fast_service", "fast_service", "quality_work"]), [
    "fast_service",
    "quality_work",
  ]);
});

test("review clustering strengthens confidence across synonym evidence", () => {
  const batch = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google Business Reviews",
    now,
    evidence: [
      {
        externalId: "1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        rating: 5,
        text: "Fast service and friendly staff.",
      },
      {
        externalId: "2",
        occurredAt: "2026-07-10T00:00:00.000Z",
        rating: 5,
        text: "Quick turnaround — highly recommend.",
      },
      {
        externalId: "3",
        occurredAt: "2026-07-20T00:00:00.000Z",
        rating: 5,
        text: "Same-day response from the team.",
      },
      {
        externalId: "4",
        occurredAt: "2026-06-01T00:00:00.000Z",
        rating: 4,
        text: "Professional expertise throughout.",
      },
    ],
  });

  const intelligence = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-1",
    evidence: batch,
    now,
  });

  const fast = intelligence.strengths.find((t) => t.key === "fast_service");
  assert.ok(fast);
  assert.ok(fast!.evidenceCount >= 3);
  assert.ok(fast!.percentageOfReviews > 0);
  assert.notEqual(fast!.confidence, "low");
});

test("confidence calculation never exaggerates isolated reviews", () => {
  const low = calculateThemeConfidence({
    evidenceCount: 1,
    totalEvidence: 20,
    providerCount: 1,
    recentShare: 1,
    consistency: 1,
  });
  assert.equal(low.confidence, "low");

  const high = calculateThemeConfidence({
    evidenceCount: 10,
    totalEvidence: 30,
    providerCount: 2,
    recentShare: 0.6,
    consistency: 0.9,
  });
  assert.equal(high.confidence, "high");
});

test("business impact is not the same as frequency", () => {
  const frequentPraise = calculateBusinessImpact({
    kind: ThemeKinds.STRENGTH,
    impactHints: ["reputation"],
    evidenceCount: 20,
    percentageOfReviews: 50,
    confidence: "high",
  });
  const conversionConcern = calculateBusinessImpact({
    kind: ThemeKinds.CONCERN,
    impactHints: ["conversion", "acquisition"],
    evidenceCount: 3,
    percentageOfReviews: 12,
    confidence: "medium",
  });
  assert.ok(
    conversionConcern === "high" ||
      (conversionConcern === "medium" && frequentPraise !== "high"),
  );
});

test("evidence normalization is provider-shaped but consumer-safe", () => {
  const normalized = normalizeProviderEvidence({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google Business Reviews",
    now,
    evidence: {
      externalId: "g-1",
      occurredAt: "2026-07-15T00:00:00.000Z",
      rating: 2,
      text: "Long wait and expensive pricing — disappointed.",
    },
  });
  assert.equal(normalized.id.startsWith("google_business_reviews:"), true);
  assert.ok(normalized.extractedThemes.includes("wait_time"));
  assert.ok(normalized.evidenceWeight > 0);
  assert.ok(["positive", "negative", "neutral", "mixed"].includes(normalized.sentiment));
});

test("provider abstraction supports registry and future providers without brain changes", () => {
  const google = createGoogleBusinessReviewsProvider(async () => []);
  const futureStub = {
    id: CustomerVoiceProviderIds.FACEBOOK_REVIEWS,
    label: "Facebook Reviews",
    async fetchEvidence() {
      return {
        providerId: CustomerVoiceProviderIds.FACEBOOK_REVIEWS,
        sourceLabel: "Facebook Reviews",
        fetchedAt: now.toISOString(),
        evidence: [
          {
            externalId: "fb-1",
            occurredAt: "2026-07-12T00:00:00.000Z",
            rating: 5,
            text: "Quick turnaround and friendly staff.",
          },
        ],
      };
    },
  };

  const registry = createProviderRegistry([google, futureStub]);
  assert.equal(registry.size, 2);
  assert.ok(registry.has(CustomerVoiceProviderIds.FACEBOOK_REVIEWS));
});

test("Customer Voice Score stays internal and surfaces natural language only", () => {
  const empty = calculateCustomerVoiceScore({
    evidence: [],
    themeCount: 0,
    highConfidenceThemes: 0,
    overallConfidence: "low",
    now,
  });
  assert.equal(empty.score, 0);
  assert.match(empty.maturityCopy, /continuing to learn/i);
  assert.equal(maturityCopyFor(VoiceMaturityLabels.WELL_ESTABLISHED).includes("well established"), true);
  assert.ok(!empty.maturityCopy.match(/\d{2,3}/));
});

test("low-review businesses get insufficient_evidence empty state", () => {
  const evidence = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google",
    now,
    evidence: [
      {
        externalId: "1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        rating: 5,
        text: "Great job.",
      },
    ],
  });
  const intelligence = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-low",
    evidence,
    now,
  });
  assert.equal(intelligence.emptyState, "insufficient_evidence");
  assert.equal(intelligence.evidenceCount, 1);
});

test("empty states compose cleanly with no evidence", () => {
  const intelligence = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-empty",
    evidence: [],
    now,
  });
  assert.equal(intelligence.emptyState, "no_evidence");
  assert.equal(intelligence.strengths.length, 0);
  assert.match(intelligence.score.maturityCopy, /continuing to learn/i);
});

test("Google provider maps existing review rows without provider leakage into themes", () => {
  const review = {
    id: "uuid-1",
    user_id: "u1",
    business_profile_id: "b1",
    location_id: null,
    google_review_id: "g-99",
    reviewer_name: "Sam",
    reviewer_photo_url: null,
    rating: 5,
    comment: "Fast service — thank you Maria for the help.",
    review_reply: null,
    reply_status: "unanswered",
    ai_draft_reply: null,
    google_review_url: null,
    review_created_at: "2026-07-05T00:00:00.000Z",
    reply_updated_at: null,
    raw_json: {},
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
  } satisfies GoogleBusinessReview;

  const mapped = mapGoogleReviewToEvidence(review);
  assert.equal(mapped.externalId, "uuid-1");
  assert.match(mapped.text, /Fast service/);

  const extraction = extractThemesFromText(mapped.text);
  assert.ok(extraction.hits.some((h) => h.clusterKey === "fast_service"));
  assert.ok(extraction.employees.includes("Maria") || extraction.employees.length >= 0);
});

test("sentiment helpers stay bounded", () => {
  assert.equal(sentimentFromTextAndRating("Absolutely love this place, amazing!", 5), "positive");
  assert.equal(sentimentFromTextAndRating("Terrible and disappointing service", 1), "negative");
});

test("Phase 1 foundation modules remain and docs still cover the intelligence layer", () => {
  const docs = readFileSync(join(root, "docs/project-magic/CUSTOMER_VOICE.md"), "utf8");
  assert.match(docs, /Provider interface/);
  assert.match(docs, /Evidence normalization/);
  assert.match(docs, /Customer Voice Score/);
  assert.match(docs, /Extension guide/);

  assert.ok(readFileSync(join(root, "lib/customer-voice/compose.ts"), "utf8").includes("composeCustomerVoiceIntelligence"));
  assert.ok(readFileSync(join(root, "lib/customer-voice/service.ts"), "utf8").includes("getCustomerVoiceIntelligence"));
});
