import type { MarketContextItem } from "@/lib/market-context/types";
import type { MarketingOpportunityDraft, OpportunityCategory } from "@/lib/marketing-opportunities/types";
import { OpportunitySeverities } from "@/lib/marketing-opportunities/types";

function severityForRelevance(relevanceScore: number) {
  if (relevanceScore >= 70) return OpportunitySeverities.HIGH;
  if (relevanceScore >= 40) return OpportunitySeverities.MEDIUM;
  return OpportunitySeverities.LOW;
}

/**
 * Shared mapping from an unexpired market_context_items row to an opportunity draft.
 * Backs the holiday/weather/local-event detectors below — they differ only in which
 * category they filter for and their title/action copy. Each opportunity's dedupeKey is
 * the underlying market context item's own id, so it's automatically idempotent (the
 * same context item never produces two opportunities) and never collides across
 * different items (each holiday/weather window/event gets its own opportunity).
 *
 * Falls back to the item's own context_date as the expiry when the item has no explicit
 * expires_at — a reasonable simplification (may expire slightly earlier than ideal for
 * an item that's still relevant into the evening of its context_date), not a functional
 * bug, and documented here rather than guessed at silently.
 */
export function marketContextItemToOpportunityDraft(
  item: MarketContextItem,
  category: OpportunityCategory,
  titlePrefix: string,
  recommendedActionPrefix: string
): MarketingOpportunityDraft {
  return {
    category,
    severity: severityForRelevance(item.relevance_score),
    confidence: item.confidence_score,
    title: `${titlePrefix}: ${item.title}`,
    description:
      item.summary || `${item.title} is a timely local signal that may be relevant to this business's content calendar.`,
    evidence: {
      marketContextItemId: item.id,
      contextDate: item.context_date,
      relevanceScore: item.relevance_score,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
    },
    recommendedAction: `${recommendedActionPrefix}: ${item.title}.`,
    expiresAt: item.expires_at ?? item.context_date,
    dedupeKey: item.id,
  };
}

export function isUnexpired(item: MarketContextItem, now: Date): boolean {
  return !item.expires_at || new Date(item.expires_at) > now;
}
