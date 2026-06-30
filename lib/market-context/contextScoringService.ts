import type {
  MarketContextBusinessContext,
  MarketContextCategory,
  MarketContextItemInput,
  MarketContextScoreBreakdown,
  ScoredMarketContextItem,
} from "@/lib/market-context/types";

const CATEGORY_PRIORITY: Record<MarketContextCategory, number> = {
  trend: 92,
  holiday: 90,
  weather: 85,
  local_event: 84,
  competitor: 80,
  news: 72,
  school_calendar: 68,
};

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  default: ["service", "local", "business", "customer", "community"],
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(values: string[]): string[] {
  return values.flatMap((value) => normalizeText(value).split(/[^a-z0-9]+/)).filter(Boolean);
}

function buildIndustryTokens(industry: string, services: string[]): Set<string> {
  const tokens = new Set(tokenize([industry, ...services]));
  for (const keyword of INDUSTRY_KEYWORDS.default) {
    tokens.add(keyword);
  }
  return tokens;
}

function scoreIndustryRelevance(
  item: MarketContextItemInput,
  business: MarketContextBusinessContext
): number {
  const haystack = normalizeText(`${item.title} ${item.summary}`);
  const tokens = buildIndustryTokens(business.industry, business.services);
  let matches = 0;

  for (const token of tokens) {
    if (token.length >= 4 && haystack.includes(token)) {
      matches += 1;
    }
  }

  const base = item.relevanceScore ?? 55;
  return clamp(base * 0.45 + Math.min(matches * 12, 40) + 15);
}

function scoreLocalRelevance(
  item: MarketContextItemInput,
  business: MarketContextBusinessContext
): number {
  const haystack = normalizeText(`${item.title} ${item.summary}`);
  const localTerms = tokenize([
    business.city,
    business.state,
    ...business.serviceAreas,
    ...(item.metadata?.location ? [String(item.metadata.location)] : []),
  ]);

  let matches = 0;
  for (const term of localTerms) {
    if (term.length >= 3 && haystack.includes(term)) {
      matches += 1;
    }
  }

  const base = localTerms.length > 0 ? 35 : 25;
  return clamp(base + Math.min(matches * 15, 45));
}

function scoreTimeliness(item: MarketContextItemInput, referenceDate: Date): number {
  const contextDate = new Date(`${item.contextDate}T12:00:00`);
  const diffDays = Math.abs(
    Math.ceil((contextDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (diffDays <= 3) return 95;
  if (diffDays <= 7) return 85;
  if (diffDays <= 14) return 70;
  if (diffDays <= 30) return 55;
  return 35;
}

function scoreConfidence(item: MarketContextItemInput): number {
  return clamp(item.confidenceScore ?? 50);
}

function scoreCategoryPriority(category: MarketContextCategory): number {
  return CATEGORY_PRIORITY[category] ?? 60;
}

export function scoreMarketContextItem(
  item: MarketContextItemInput,
  business: MarketContextBusinessContext,
  referenceDate: Date
): ScoredMarketContextItem {
  const industryRelevance = scoreIndustryRelevance(item, business);
  const localRelevance = scoreLocalRelevance(item, business);
  const timeliness = scoreTimeliness(item, referenceDate);
  const confidence = scoreConfidence(item);
  const categoryPriority = scoreCategoryPriority(item.category);

  const composite = clamp(
    industryRelevance * 0.28 +
      localRelevance * 0.24 +
      timeliness * 0.22 +
      confidence * 0.16 +
      categoryPriority * 0.1
  );

  return {
    ...item,
    relevanceScore: composite,
    confidenceScore: confidence,
    scoreBreakdown: {
      industryRelevance,
      localRelevance,
      timeliness,
      confidence,
      categoryPriority,
      composite,
    },
  };
}

export function scoreAndRankMarketContextItems(
  items: MarketContextItemInput[],
  business: MarketContextBusinessContext,
  referenceDate: Date
): ScoredMarketContextItem[] {
  return items
    .map((item) => scoreMarketContextItem(item, business, referenceDate))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function buildRecommendedTopics(items: ScoredMarketContextItem[]): string[] {
  return [...new Set(items.slice(0, 8).map((item) => item.title))].slice(0, 6);
}

export function buildHighOpportunityKeywords(
  items: ScoredMarketContextItem[],
  business: MarketContextBusinessContext
): string[] {
  const fromTrends = items
    .filter((item) => item.category === "trend")
    .flatMap((item) => (Array.isArray(item.metadata?.keywords) ? item.metadata.keywords : []))
    .map(String);

  const fallback = [
    `${business.industry} ${business.city}`.trim(),
    `${business.services[0] ?? business.industry} near me`.trim(),
    `${business.city} ${business.industry}`.trim(),
  ].filter(Boolean);

  return [...new Set([...fromTrends, ...fallback])].slice(0, 8);
}

export function buildContentAngles(items: ScoredMarketContextItem[]): string[] {
  return [...new Set(items.slice(0, 6).map((item) => item.summary.split(".")[0]?.trim() ?? item.title))]
    .filter(Boolean)
    .slice(0, 5);
}

export function buildOverallSummary(
  items: ScoredMarketContextItem[],
  business: MarketContextBusinessContext,
  weekLabel: string
): string {
  if (items.length === 0) {
    return `No market context signals were available for ${weekLabel}. Refresh again after your business profile is complete.`;
  }

  const topCategories = [...new Set(items.slice(0, 4).map((item) => item.category.replace("_", " ")))];
  const lead = items[0];

  return `For ${weekLabel}, ${business.businessProfile.business_name ?? "your business"} has ${items.length} ranked local market signals across ${topCategories.join(", ")}. Top opportunity: ${lead.title}. Use these signals to time educational, trust-building, and seasonal content for ${business.city || "your service area"}.`;
}
