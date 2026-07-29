import type { ContentOpportunity, WebsiteExtractionResult } from "@/lib/website-analysis/types";
import type { WebsiteExtractor } from "@/lib/website-analysis/types";

type ExtractionInput = Parameters<WebsiteExtractor["extract"]>[0];
type ExtractionContext = Pick<
  WebsiteExtractionResult,
  | "businessName"
  | "industry"
  | "primaryServices"
  | "secondaryServices"
  | "keywords"
  | "customerPersona"
>;

const FORBIDDEN_TITLE_PATTERNS = [
  /guide for local homeowners/i,
  /for local homeowners/i,
  /local homeowners/i,
  /home service customers?/i,
  /local service customers?/i,
  /homeowners? guide/i,
];

const GENERIC_AUDIENCE_TERMS = [
  "homeowner",
  "property manager",
  "plumber",
  "local service",
  "home service",
  "residential customer",
];

const B2B_BENEFITS_OPPORTUNITIES: ContentOpportunity[] = [
  {
    title: "How Section 125 Plans Help Employers Reduce Payroll Taxes",
    seoScore: 88,
    competition: "Low",
  },
  {
    title: "A Simple Guide to Employee Benefit Savings for Small Businesses",
    seoScore: 85,
    competition: "Low",
  },
  {
    title: "Why Business Owners Should Review Their Benefits Strategy",
    seoScore: 82,
    competition: "Medium",
  },
  {
    title: "How Employees Can Save More Through Pre-Tax Benefit Plans",
    seoScore: 84,
    competition: "Medium",
  },
];

const B2B_SOURCE_TERMS = [
  "section 125",
  "cafeteria plan",
  "premium reimbursement",
  "employee benefit",
  "employee benefits",
  "benefits strategy",
  "payroll tax",
  "pre-tax",
  "hr ",
  "human resources",
  "employer",
  "business owner",
];

function buildSourceBlob(input: ExtractionInput): string {
  return [
    input.website.textContent,
    input.website.html,
    input.profile.business_name,
    input.profile.industry,
    input.profile.primary_services,
    input.profile.emergency_services,
    input.profile.seasonal_services,
    input.profile.specialty_services,
    input.profile.primary_service_area,
    input.profile.nearby_cities,
    input.profile.city,
    input.profile.state,
    input.profile.voice_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildSummarySource(extraction: ExtractionContext): string {
  return [
    extraction.industry,
    extraction.customerPersona,
    extraction.businessName,
    ...extraction.primaryServices,
    ...extraction.secondaryServices,
    ...extraction.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sourceContainsTerm(source: string, term: string): boolean {
  return source.includes(term.toLowerCase());
}

function isBenefitsFocused(source: string): boolean {
  return B2B_SOURCE_TERMS.some((term) => sourceContainsTerm(source, term));
}

function titleUsesForbiddenPattern(title: string): boolean {
  return FORBIDDEN_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function titleUsesUnsupportedAudience(title: string, source: string): boolean {
  const lowerTitle = title.toLowerCase();

  return GENERIC_AUDIENCE_TERMS.some(
    (term) => lowerTitle.includes(term) && !sourceContainsTerm(source, term)
  );
}

function isValidContentOpportunityTitle(title: string, source: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (titleUsesForbiddenPattern(trimmed)) return false;
  if (titleUsesUnsupportedAudience(trimmed, source)) return false;
  return true;
}

function readCompetition(value: unknown): ContentOpportunity["competition"] {
  if (value === "Low" || value === "Medium" || value === "High") return value;
  return "Medium";
}

function readSeoScore(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(50, Math.min(98, Math.round(parsed)));
}

type TopicWithSource = { topic: string; centrality: "primary" | "secondary" | "keyword" };

/** Tags each topic by where it came from — primaryServices is the most central to the business, keywords the least — so the "score" below can be grounded in something real instead of pure list position. */
function uniqueTopicsWithSource(extraction: ExtractionContext): TopicWithSource[] {
  const seen = new Set<string>();
  const results: TopicWithSource[] = [];

  const sources: Array<[string[], TopicWithSource["centrality"]]> = [
    [extraction.primaryServices, "primary"],
    [extraction.secondaryServices, "secondary"],
    [extraction.keywords, "keyword"],
  ];

  for (const [items, centrality] of sources) {
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed.length <= 1) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ topic: trimmed, centrality });
    }
  }

  return results.slice(0, 6);
}

function uniqueTopics(extraction: ExtractionContext): string[] {
  return uniqueTopicsWithSource(extraction).map((item) => item.topic);
}

/** Grounds the "relevance score" in how central the topic is to the business (a primary service beats an incidental keyword) plus its position within that tier — not a bare, unexplained list-position countdown. */
const CENTRALITY_BASE_SCORE: Record<TopicWithSource["centrality"], number> = {
  primary: 88,
  secondary: 80,
  keyword: 72,
};

function scoreForTopic(topic: TopicWithSource, indexWithinTier: number): number {
  return Math.max(50, CENTRALITY_BASE_SCORE[topic.centrality] - indexWithinTier * 2);
}

const MAX_AUDIENCE_LENGTH = 48;

/**
 * Shortens a persona for use inline in a title. Previously this bailed
 * straight to the generic "Their Customers" whenever a real, specific
 * persona happened to run a little long and had no comma/period to split
 * on — which, found via the Internal Alpha eval dataset, was silently
 * discarding good personas (e.g. "Individuals and businesses seeking legal
 * guidance or representation for a specific matter") for the exact generic
 * fallback this whole file exists to avoid. Now it truncates at a clean word
 * boundary instead of giving up.
 */
function shortenAudience(customerPersona: string): string {
  const trimmed = customerPersona.trim();
  if (!trimmed) return "Their Customers";

  if (trimmed.length <= MAX_AUDIENCE_LENGTH) return trimmed;

  const firstClause = trimmed.split(/[.;,]/)[0]?.trim() ?? trimmed;
  if (firstClause.length <= MAX_AUDIENCE_LENGTH) return firstClause;

  const words = firstClause.split(/\s+/);
  let result = "";
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > MAX_AUDIENCE_LENGTH) break;
    result = candidate;
  }

  return result || "Their Customers";
}

function buildNeutralOpportunities(extraction: ExtractionContext): ContentOpportunity[] {
  const topics = uniqueTopicsWithSource(extraction);
  const businessType = extraction.industry.trim() || extraction.businessName.trim() || "This Business";
  const audience = shortenAudience(extraction.customerPersona);

  if (topics.length === 0) {
    return [
      {
        title: `What Customers Should Know About ${businessType}`,
        seoScore: 80,
        competition: "Medium",
      },
      {
        title: `How ${businessType} Helps ${audience}`,
        seoScore: 78,
        competition: "Medium",
      },
    ];
  }

  const patterns: Array<(topic: string) => string> = [
    (topic) => `A Practical Guide to ${topic}`,
    (topic) => `What Customers Should Know About ${topic}`,
    (topic) => `How ${businessType} Helps ${audience} With ${topic}`,
    (topic) => `${topic}: Common Questions, Answered`,
  ];

  const withinTierIndex = new Map<TopicWithSource["centrality"], number>();

  return topics.slice(0, 4).map((topicEntry, index) => {
    const tierIndex = withinTierIndex.get(topicEntry.centrality) ?? 0;
    withinTierIndex.set(topicEntry.centrality, tierIndex + 1);

    return {
      title: patterns[index]?.(topicEntry.topic) ?? `A Practical Guide to ${topicEntry.topic}`,
      seoScore: scoreForTopic(topicEntry, tierIndex),
      competition: index % 2 === 0 ? "Low" : "Medium",
    };
  });
}

function buildBenefitsOpportunities(extraction: ExtractionContext): ContentOpportunity[] {
  const topics = uniqueTopics(extraction);
  const customized = B2B_BENEFITS_OPPORTUNITIES.map((item, index) => {
    const topic = topics[index];
    if (!topic) return item;

    if (index === 0 && /section 125/i.test(topic)) {
      return item;
    }

    if (index === 1) {
      return {
        ...item,
        title: `A Simple Guide to ${topic} for Small Businesses`,
      };
    }

    return item;
  });

  return customized.slice(0, 4);
}

export function inferContentOpportunitiesFromSource(
  input: ExtractionInput,
  extraction: ExtractionContext
): ContentOpportunity[] {
  const source = buildSourceBlob(input);

  if (isBenefitsFocused(source) || isBenefitsFocused(buildSummarySource(extraction))) {
    return buildBenefitsOpportunities(extraction);
  }

  return buildNeutralOpportunities(extraction);
}

export function inferContentOpportunitiesFromSummary(
  extraction: ExtractionContext
): ContentOpportunity[] {
  const source = buildSummarySource(extraction);

  if (isBenefitsFocused(source)) {
    return buildBenefitsOpportunities(extraction);
  }

  return buildNeutralOpportunities(extraction);
}

export function readContentOpportunities(raw: unknown): ContentOpportunity[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";

      if (!title) return null;

      return {
        title,
        seoScore: readSeoScore(record.seoScore, Math.max(72, 86 - index * 3)),
        competition: readCompetition(record.competition),
      };
    })
    .filter((item): item is ContentOpportunity => item !== null);
}

export function normalizeContentOpportunities(
  opportunities: ContentOpportunity[],
  input: ExtractionInput,
  extraction: ExtractionContext
): ContentOpportunity[] {
  const source = `${buildSourceBlob(input)} ${buildSummarySource(extraction)}`;
  const valid = opportunities.filter((item) => isValidContentOpportunityTitle(item.title, source));

  if (valid.length >= 2) {
    return valid.slice(0, 4);
  }

  return inferContentOpportunitiesFromSource(input, extraction);
}

export function resolveContentOpportunities(
  extraction: WebsiteExtractionResult | null | undefined
): ContentOpportunity[] {
  if (!extraction) return [];

  const source = buildSummarySource(extraction);

  if (extraction.contentOpportunities?.length) {
    const valid = extraction.contentOpportunities.filter((item) =>
      isValidContentOpportunityTitle(item.title, source)
    );

    if (valid.length >= 2) {
      return valid.slice(0, 4);
    }
  }

  return inferContentOpportunitiesFromSummary(extraction);
}
