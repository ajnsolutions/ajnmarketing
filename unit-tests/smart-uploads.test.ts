import test from "node:test";
import assert from "node:assert/strict";
import { getDocumentExtractor, inferFileTypeFromFileName } from "../lib/smart-uploads/extractors/registry.ts";
import { DocumentExtractionError } from "../lib/smart-uploads/extractors/types.ts";
import { plainTextExtractor, markdownExtractor } from "../lib/smart-uploads/extractors/plainText.ts";
import { docxExtractor } from "../lib/smart-uploads/extractors/docx.ts";
import { pdfExtractor } from "../lib/smart-uploads/extractors/pdf.ts";
import { normalizeKnowledgeExtraction } from "../lib/smart-uploads/openai-extractor.ts";
import { factSimilarity, findDuplicateFacts } from "../lib/smart-uploads/duplicateDetection.ts";
import { smartUploadFactToBusinessInsight } from "../lib/smart-uploads/toBusinessInsight.ts";
import { formatSmartUploadKnowledgeForContentPrompt } from "../lib/smart-uploads/contentPromptBlock.ts";
import { findSearchDemandCrossovers, findWebsiteContentGaps } from "../lib/smart-uploads/crossover.ts";
import {
  createSmartUploadDocument,
  deleteSmartUploadDocument,
  getKnowledgeFactsForBusiness,
  getSmartUploadDocumentForUser,
  listSmartUploadDocumentsForUser,
  markFactSuperseded,
  replaceKnowledgeFactsForDocument,
  updateSmartUploadDocumentStatus,
} from "../lib/smart-uploads/persistence.ts";
import { getActiveSmartUploadKnowledgeForUser } from "../lib/smart-uploads/service.ts";
import { cosineSimilarity } from "../lib/embeddings/provider.ts";
import { generateEmbeddingsForFacts, findSimilarFacts } from "../lib/embeddings/service.ts";
import { synthesizePlanEvidence } from "../lib/growth-planner/evidence.ts";
import { buildWhatINoticedObservations } from "../lib/growth-advisor/observations.ts";
import { resolveBusinessConnections } from "../lib/business-connections/resolve.ts";
import { ConnectionProviderIds, ConnectionStatuses } from "../lib/business-connections/types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import type { SmartUploadKnowledgeFactRecord } from "../lib/smart-uploads/types.ts";
import type { ExternalIntelligence, ExternalIntelligenceInsight } from "../lib/external-intelligence/types.ts";
import type { HeadOfMarketingBriefing } from "../lib/head-of-marketing/types.ts";

// ---------------------------------------------------------------------------
// Extractors — registry, plain text/markdown (real), error handling
// ---------------------------------------------------------------------------

test("inferFileTypeFromFileName maps extensions; unknown extensions return null", () => {
  assert.equal(inferFileTypeFromFileName("brochure.pdf"), "pdf");
  assert.equal(inferFileTypeFromFileName("services.DOCX"), "docx");
  assert.equal(inferFileTypeFromFileName("notes.txt"), "txt");
  assert.equal(inferFileTypeFromFileName("readme.md"), "markdown");
  assert.equal(inferFileTypeFromFileName("archive.zip"), null);
  assert.equal(inferFileTypeFromFileName("noextension"), null);
});

test("getDocumentExtractor returns the right extractor per supported type; throws for future types", () => {
  assert.equal(getDocumentExtractor("pdf"), pdfExtractor);
  assert.equal(getDocumentExtractor("docx"), docxExtractor);
  assert.equal(getDocumentExtractor("txt"), plainTextExtractor);
  assert.equal(getDocumentExtractor("markdown"), markdownExtractor);

  assert.throws(() => getDocumentExtractor("powerpoint"), DocumentExtractionError);
  assert.throws(() => getDocumentExtractor("csv"), DocumentExtractionError);
});

test("plainTextExtractor and markdownExtractor decode real UTF-8 buffers", async () => {
  const text = await plainTextExtractor.extractText(Buffer.from("Our commercial roofing service covers flat roofs.", "utf8"));
  assert.match(text, /commercial roofing/);

  const md = await markdownExtractor.extractText(Buffer.from("## Services\n- Roofing\n- Gutters", "utf8"));
  assert.match(md, /## Services/);
});

test("plainTextExtractor throws a clear error for an empty file", async () => {
  await assert.rejects(() => plainTextExtractor.extractText(Buffer.from("")), DocumentExtractionError);
});

test("docxExtractor throws a clear DocumentExtractionError on a non-docx buffer", async () => {
  await assert.rejects(() => docxExtractor.extractText(Buffer.from("not a real docx file")), DocumentExtractionError);
});

test("pdfExtractor throws a clear DocumentExtractionError on a non-pdf buffer", async () => {
  await assert.rejects(() => pdfExtractor.extractText(Buffer.from("not a real pdf file")), DocumentExtractionError);
});

// ---------------------------------------------------------------------------
// AI extraction normalization — defensive against malformed model output
// ---------------------------------------------------------------------------

test("normalizeKnowledgeExtraction drops malformed items and defaults confidence", () => {
  const result = normalizeKnowledgeExtraction({
    items: [
      { category: "service", fact: "We install commercial roofing.", sourceExcerpt: "commercial roofing installs", confidence: "high" },
      { category: "not_a_real_category", fact: "Should be dropped" },
      { category: "pricing", fact: "" }, // empty fact — dropped
      { category: "guarantee", fact: "5-year warranty on all work." }, // missing confidence -> medium
      "not even an object",
    ],
  });

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]!.category, "service");
  assert.equal(result.items[0]!.confidence, "high");
  assert.equal(result.items[1]!.category, "guarantee");
  assert.equal(result.items[1]!.confidence, "medium");
});

test("normalizeKnowledgeExtraction caps item count and truncates long text", () => {
  const items = Array.from({ length: 150 }, (_, i) => ({
    category: "faq",
    fact: "x".repeat(1000) + i,
    confidence: "low",
  }));
  const result = normalizeKnowledgeExtraction({ items });
  assert.equal(result.items.length, 100);
  assert.ok(result.items[0]!.fact.length <= 600);
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

function fact(overrides: Partial<SmartUploadKnowledgeFactRecord> = {}): SmartUploadKnowledgeFactRecord {
  return {
    id: overrides.id ?? "fact-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    document_id: "doc-1",
    category: "service",
    fact: "We offer commercial roofing installation.",
    source_excerpt: null,
    confidence: "medium",
    date_learned: "2026-01-01T00:00:00.000Z",
    last_verified_at: "2026-01-01T00:00:00.000Z",
    superseded_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("factSimilarity is high for near-duplicate text and low for unrelated text", () => {
  const similarity = factSimilarity(
    "We offer commercial roofing installation services.",
    "Commercial roofing installation is one of our services.",
  );
  assert.ok(similarity > 0.5, `expected high similarity, got ${similarity}`);

  const unrelated = factSimilarity("We offer commercial roofing installation.", "Open Monday through Friday, 9am to 5pm.");
  assert.ok(unrelated < 0.2, `expected low similarity, got ${unrelated}`);
});

test("findDuplicateFacts keeps the higher-confidence fact and never crosses categories", () => {
  const facts = [
    fact({ id: "a", confidence: "medium", date_learned: "2026-01-01T00:00:00.000Z" }),
    fact({ id: "b", confidence: "high", date_learned: "2026-01-05T00:00:00.000Z" }),
    // Same wording, different category — must never be treated as a duplicate.
    fact({ id: "c", category: "pricing", fact: "We offer commercial roofing installation." }),
  ];

  const pairs = findDuplicateFacts(facts);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]!.keep.id, "b");
  assert.equal(pairs[0]!.supersede.id, "a");
});

test("findDuplicateFacts ignores facts already superseded", () => {
  const facts = [
    fact({ id: "a", superseded_by: "z" }),
    fact({ id: "b" }),
  ];
  const pairs = findDuplicateFacts(facts);
  assert.equal(pairs.length, 0);
});

// ---------------------------------------------------------------------------
// Business Brain adapter
// ---------------------------------------------------------------------------

test("smartUploadFactToBusinessInsight cites the source document and preserves confidence", () => {
  const insight = smartUploadFactToBusinessInsight(fact({ fact: "5-year warranty on all roofing work." }), {
    id: "doc-1",
    file_name: "brochure.pdf",
  });

  assert.equal(insight.id, "smart_uploads:fact-1");
  assert.equal(insight.category, "smart_uploads_service");
  assert.equal(insight.insight, "5-year warranty on all roofing work.");
  assert.equal(insight.confidence, "medium");
  assert.equal(insight.evidence.length, 1);
  assert.equal(insight.evidence[0]!.id, "doc-1");
  assert.equal(insight.evidence[0]!.sourceProviderId, "smart_uploads");
  assert.match(insight.evidence[0]!.sourceLabel, /brochure\.pdf/);
});

// ---------------------------------------------------------------------------
// Content Generator prompt block
// ---------------------------------------------------------------------------

test("formatSmartUploadKnowledgeForContentPrompt groups by category and excludes superseded facts", () => {
  const block = formatSmartUploadKnowledgeForContentPrompt([
    fact({ id: "a", category: "service", fact: "Commercial roofing installation." }),
    fact({ id: "b", category: "guarantee", fact: "5-year warranty." }),
    fact({ id: "c", category: "service", fact: "Superseded fact.", superseded_by: "a" }),
  ]);

  assert.ok(block);
  assert.match(block!, /Commercial roofing installation/);
  assert.match(block!, /5-year warranty/);
  assert.doesNotMatch(block!, /Superseded fact/);
});

test("formatSmartUploadKnowledgeForContentPrompt returns null when there is no active knowledge", () => {
  assert.equal(formatSmartUploadKnowledgeForContentPrompt([]), null);
  assert.equal(formatSmartUploadKnowledgeForContentPrompt(null), null);
  assert.equal(
    formatSmartUploadKnowledgeForContentPrompt([fact({ superseded_by: "other" })]),
    null,
  );
});

// ---------------------------------------------------------------------------
// Crossover reasoning (Part 6 + Part 8 worked examples)
// ---------------------------------------------------------------------------

test("findWebsiteContentGaps flags an offering with little website representation", () => {
  const facts = [fact({ category: "service", fact: "Commercial roofing installation and repair." })];
  const gaps = findWebsiteContentGaps(facts, new Map([["doc-1", "brochure.pdf"]]), ["residential plumbing", "hvac maintenance"]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.documentFileName, "brochure.pdf");
});

test("findWebsiteContentGaps does not flag an offering already well represented on the website", () => {
  const facts = [fact({ category: "service", fact: "Commercial roofing installation." })];
  const gaps = findWebsiteContentGaps(facts, new Map(), ["commercial roofing installation and repair"]);
  assert.equal(gaps.length, 0);
});

function makeSearchDemandInsight(overrides: Partial<ExternalIntelligenceInsight> = {}): ExternalIntelligenceInsight {
  return {
    id: "external:search_demand_trends:commercial_roofing",
    category: "search_demand_trends",
    clusterKey: "search_demand_trends:commercial_roofing",
    corroboratingProviderCount: 1,
    insight: "Organic clicks for \"commercial roofing\" grew from 5 to 40 over the last period.",
    confidence: "high",
    businessImpact: "medium",
    timeHorizon: "near_term",
    evidence: [],
    possibleActions: [],
    relatedGoals: [],
    lastUpdated: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("findSearchDemandCrossovers pairs an upload fact with a matching Search Console demand signal", () => {
  const facts = [fact({ category: "service", fact: "We install and repair commercial roofing." })];
  const matches = findSearchDemandCrossovers(facts, [makeSearchDemandInsight()]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.fact.id, "fact-1");
  assert.match(matches[0]!.insight.insight, /commercial roofing/);
});

test("findSearchDemandCrossovers finds nothing when topics don't overlap", () => {
  const facts = [fact({ category: "service", fact: "We offer residential window cleaning." })];
  const matches = findSearchDemandCrossovers(facts, [makeSearchDemandInsight()]);
  assert.equal(matches.length, 0);
});

// ---------------------------------------------------------------------------
// Growth Advisor citation (Part 6 example) + crossover observation (Part 8 example)
// ---------------------------------------------------------------------------

function baseBriefing(): HeadOfMarketingBriefing {
  return {
    greeting: "Hi",
    businessName: "Acme Roofing",
    relationshipMemory: "",
    isEarlyCustomer: false,
    thisWeek: [],
    noticed: [],
    recommendation: null,
    topRecommendationDetail: null,
    timeRespectLabel: "Nothing to review",
    primaryAction: { kind: "none" },
    journal: { intro: "", entries: [] },
    confidence: {
      gbpConnected: true,
      pendingApprovals: 0,
      publishFailures: 0,
      openRecommendations: 0,
      weeklyNewReviews: 0,
      weeklyPublishedPosts: 0,
      hasMarketingPlan: true,
    },
    health: { state: "healthy", label: "Healthy", message: "" },
  } as unknown as HeadOfMarketingBriefing;
}

test("Growth Advisor cites Smart Upload knowledge when a website content gap is found", () => {
  const observations = buildWhatINoticedObservations({
    briefing: baseBriefing(),
    businessDiscovery: {
      primaryServices: { value: ["residential plumbing"], confidenceTier: "known" },
    } as never,
    smartUploadFacts: [fact({ category: "service", fact: "Commercial roofing installation and repair." })],
    smartUploadDocuments: [
      { id: "doc-1", file_name: "brochure.pdf" } as never,
    ],
  });

  const gapObservation = observations.find((o) => o.evidenceSource.startsWith("smart_uploads:"));
  assert.ok(gapObservation, "expected a website-content-gap observation citing Smart Uploads");
  assert.match(gapObservation!.headline, /brochure\.pdf highlights "Commercial roofing installation and repair\." but your website has very little content/);
});

test("Growth Advisor crossover observation cites both Search Console and Smart Upload evidence explicitly", () => {
  const externalIntelligence = {
    emptyState: null,
    searchDemandTrends: [makeSearchDemandInsight()],
    insights: [makeSearchDemandInsight()],
  } as unknown as ExternalIntelligence;

  const observations = buildWhatINoticedObservations({
    briefing: baseBriefing(),
    externalIntelligence,
    smartUploadFacts: [fact({ category: "service", fact: "We install and repair commercial roofing." })],
  });

  const crossover = observations.find((o) => o.evidenceSource === "crossover:external_intelligence+smart_uploads");
  assert.ok(crossover, "expected a crossover observation citing both sources");
  assert.match(crossover!.headline, /commercial roofing/i);
  assert.match(crossover!.headline, /uploaded documents also mention/i);
});

// ---------------------------------------------------------------------------
// Weekly Growth Plan evidence (Part 3 + Part 8)
// ---------------------------------------------------------------------------

test("synthesizePlanEvidence includes a smart_uploads item citing the fact directly", () => {
  const evidence = synthesizePlanEvidence({
    briefing: baseBriefing(),
    goals: [],
    smartUploadFacts: [fact({ confidence: "high", fact: "5-year warranty on all roofing work." })],
  });

  const item = evidence.find((e) => e.source === "smart_uploads");
  assert.ok(item);
  assert.equal(item!.statement, "5-year warranty on all roofing work.");
});

test("synthesizePlanEvidence prefers a Search Console crossover over a plain fact citation", () => {
  const externalIntelligence = {
    emptyState: null,
    seasonalOpportunities: [],
    competitorActivity: [],
    searchDemandTrends: [makeSearchDemandInsight()],
  } as unknown as ExternalIntelligence;

  const evidence = synthesizePlanEvidence({
    briefing: baseBriefing(),
    goals: [],
    externalIntelligence,
    smartUploadFacts: [fact({ category: "service", fact: "We install and repair commercial roofing." })],
  });

  const item = evidence.find((e) => e.id === "smart_uploads_search_crossover");
  assert.ok(item, "expected the crossover-specific evidence item");
  assert.equal(item!.source, "smart_uploads");
  assert.match(item!.statement, /commercial roofing/i);
});

// ---------------------------------------------------------------------------
// Business Connections resolution
// ---------------------------------------------------------------------------

const emptyConnectionSignals = {
  gbpConnected: false,
  gbpNeedsAttention: false,
  gbpLastSyncAt: null,
  hasWebsite: false,
  websiteAnalyzed: false,
  websiteAnalyzedAt: null,
  searchConsoleConnected: false,
  searchConsoleNeedsAttention: false,
  searchConsoleLastSyncAt: null,
  smartUploadsConnected: false,
  smartUploadsNeedsAttention: false,
  smartUploadsLastSyncAt: null,
};

test("resolveBusinessConnections maps Smart Uploads connected/attention/not-connected distinctly", () => {
  const notConnected = resolveBusinessConnections(emptyConnectionSignals).find(
    (c) => c.providerId === ConnectionProviderIds.SMART_UPLOADS,
  )!;
  assert.equal(notConnected.status, ConnectionStatuses.NOT_CONNECTED);

  const connected = resolveBusinessConnections({
    ...emptyConnectionSignals,
    smartUploadsConnected: true,
    smartUploadsLastSyncAt: "2026-07-29T00:00:00.000Z",
  }).find((c) => c.providerId === ConnectionProviderIds.SMART_UPLOADS)!;
  assert.equal(connected.status, ConnectionStatuses.CONNECTED);
  assert.equal(connected.lastSyncAt, "2026-07-29T00:00:00.000Z");

  const attention = resolveBusinessConnections({
    ...emptyConnectionSignals,
    smartUploadsNeedsAttention: true,
  }).find((c) => c.providerId === ConnectionProviderIds.SMART_UPLOADS)!;
  assert.equal(attention.status, ConnectionStatuses.NEEDS_ATTENTION);
});

// ---------------------------------------------------------------------------
// Persistence — tenant isolation, deletion, reprocessing
// ---------------------------------------------------------------------------

test("createSmartUploadDocument and getSmartUploadDocumentForUser are scoped to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_documents: {
      data: {
        id: "doc-1",
        user_id: "user-1",
        business_profile_id: "biz-1",
        file_name: "brochure.pdf",
        file_type: "pdf",
        storage_path: "user-1/doc-1/brochure.pdf",
        file_size_bytes: 1000,
        status: "uploaded",
        extraction_error: null,
        fact_count: 0,
        uploaded_at: "2026-01-01T00:00:00.000Z",
        processed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    },
  });

  const created = await createSmartUploadDocument(client, {
    userId: "user-1",
    businessProfileId: "biz-1",
    fileName: "brochure.pdf",
    fileType: "pdf",
    storagePath: "user-1/doc-1/brochure.pdf",
    fileSizeBytes: 1000,
  });
  assert.ok(created);

  await getSmartUploadDocumentForUser(client, "user-1", "doc-1");
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

test("listSmartUploadDocumentsForUser scopes the list query to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_documents: { data: [], error: null },
  });

  await listSmartUploadDocumentsForUser(client, "user-42");
  assert.deepEqual(userIdsQueried(calls), ["user-42"]);
});

test("updateSmartUploadDocumentStatus scopes the update to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_documents: { data: { id: "doc-1", status: "extracted" }, error: null },
  });

  await updateSmartUploadDocumentStatus(client, "user-1", "doc-1", { status: "extracted", factCount: 3 });
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

test("deleteSmartUploadDocument requires the document to exist for that user before deleting", async () => {
  const { client } = createFakeSupabaseClient({
    smart_upload_documents: { data: null, error: null },
  });

  const result = await deleteSmartUploadDocument(client, "user-1", "doc-missing");
  assert.equal(result, null);
});

test("deleteSmartUploadDocument returns the storage path so the caller can also remove the file", async () => {
  const { client } = createFakeSupabaseClient({
    smart_upload_documents: {
      data: { id: "doc-1", user_id: "user-1", storage_path: "user-1/doc-1/brochure.pdf" },
      error: null,
    },
  });

  const result = await deleteSmartUploadDocument(client, "user-1", "doc-1");
  assert.ok(result);
  assert.equal(result!.storagePath, "user-1/doc-1/brochure.pdf");
});

test("replaceKnowledgeFactsForDocument replaces (never appends to) a document's facts", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_knowledge_facts: (op) =>
      op === "delete"
        ? { data: null, error: null }
        : { data: [{ id: "fact-1" }, { id: "fact-2" }], error: null },
  });

  const facts = await replaceKnowledgeFactsForDocument(client, {
    userId: "user-1",
    businessProfileId: "biz-1",
    documentId: "doc-1",
    items: [
      { category: "service", fact: "Commercial roofing.", sourceExcerpt: null, confidence: "high" },
      { category: "pricing", fact: "Free estimates.", sourceExcerpt: null, confidence: "medium" },
    ],
  });

  assert.equal(facts.length, 2);
  assert.ok(calls.some((c) => c.table === "smart_upload_knowledge_facts" && c.op === "delete"));
  assert.ok(calls.some((c) => c.table === "smart_upload_knowledge_facts" && c.op === "insert"));
});

test("getKnowledgeFactsForBusiness and getActiveSmartUploadKnowledgeForUser scope reads to the given userId and business", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_knowledge_facts: {
      data: [fact({ superseded_by: null }), fact({ id: "fact-2", superseded_by: "fact-1" })],
      error: null,
    },
  });

  const all = await getKnowledgeFactsForBusiness(client, "user-1", "biz-1");
  assert.equal(all.length, 2);
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);

  const active = await getActiveSmartUploadKnowledgeForUser(client, "user-1", "biz-1");
  assert.equal(active.length, 1);
  assert.equal(active[0]!.superseded_by, null);
});

test("markFactSuperseded scopes the update to the given userId", async () => {
  const { client, calls } = createFakeSupabaseClient({
    smart_upload_knowledge_facts: { data: null, error: null },
  });

  await markFactSuperseded(client, "user-1", "fact-old", "fact-new");
  assert.deepEqual(userIdsQueried(calls), ["user-1"]);
});

// ---------------------------------------------------------------------------
// Embedding provider abstraction — pluggable, never tightly coupled
// ---------------------------------------------------------------------------

test("cosineSimilarity is 1 for identical vectors and 0 for orthogonal vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([], []), 0);
});

test("generateEmbeddingsForFacts and findSimilarFacts work against any EmbeddingProvider implementation", async () => {
  const fakeProvider = {
    id: "fake:test-provider",
    dimensions: 3,
    async embed(text: string) {
      const [vector] = await this.embedBatch([text]);
      return vector!;
    },
    async embedBatch(texts: string[]) {
      // Deterministic fake vectors — never calls a real embedding API.
      return texts.map((t) => [t.length % 7, t.length % 5, t.length % 3]);
    },
  };

  const { client } = createFakeSupabaseClient({
    smart_upload_fact_embeddings: { data: [], error: null },
  });

  const facts = [
    fact({ id: "a", fact: "Commercial roofing installation." }),
    fact({ id: "b", fact: "Superseded", superseded_by: "a" }),
  ];

  const result = await generateEmbeddingsForFacts(client, fakeProvider, {
    userId: "user-1",
    businessProfileId: "biz-1",
    facts,
  });
  // Only the active (non-superseded) fact is embedded.
  assert.equal(result.embedded, 1);

  const { client: readClient } = createFakeSupabaseClient({
    smart_upload_fact_embeddings: {
      data: [
        { fact_id: "a", embedding: [1, 0, 0] },
        { fact_id: "b", embedding: [0, 1, 0] },
      ],
      error: null,
    },
  });

  const matches = await findSimilarFacts(readClient, {
    userId: "user-1",
    businessProfileId: "biz-1",
    providerId: fakeProvider.id,
    queryEmbedding: [1, 0, 0],
  });
  assert.equal(matches[0]!.factId, "a");
  assert.equal(matches[0]!.similarity, 1);
});
