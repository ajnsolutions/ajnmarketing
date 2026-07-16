import type { CommandCenterBusinessHealth, CommandCenterWeeklyWins } from "@/lib/command-center/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";
import type {
  HeadOfMarketingJournal,
  HeadOfMarketingJournalEntry,
  JournalCategory,
  JournalDetailSupport,
} from "@/lib/head-of-marketing/journalTypes";

export type JournalInput = {
  gbpConnected: boolean;
  unansweredReviews: number;
  pendingApprovals: number;
  openRecommendations: number;
  publishFailures: number;
  publishingReadyOrScheduled: number;
  businessHealth: CommandCenterBusinessHealth;
  healthState: MarketingHealthState;
  weeklyWins: CommandCenterWeeklyWins;
  planSummary: string | null;
  seasonalHint: string | null;
  topPriorityTitle: string | null;
  profileCreatedAt: string | null;
  websiteUrl: string | null;
  estimatedReviewMinutes: number;
  isEarlyCustomer: boolean;
  now?: Date;
};

const DETAIL: JournalDetailSupport = {
  supportedStyles: ["hands_on", "weekly", "monthly", "trusted"],
  activeDetail: "standard",
  note: "Future management styles adjust journal depth; the narrative voice stays the same.",
};

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

type Candidate = {
  category: JournalCategory;
  paragraphs: string[];
  priority: number;
};

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function relationshipPrefix(profileCreatedAt: string | null, now: Date): string | null {
  const days = daysSince(profileCreatedAt, now);
  if (days == null) return null;
  if (days < 10) return null;
  if (days < 45) return "Earlier this month,";
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(profileCreatedAt!),
  );
  return `Since ${monthLabel},`;
}

function buildCandidates(input: JournalInput, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const wins = input.weeklyWins;
  const memory = relationshipPrefix(input.profileCreatedAt, now);

  if (input.isEarlyCustomer || !input.gbpConnected) {
    candidates.push({
      category: "learning",
      priority: 100,
      paragraphs: [
        "I'm learning how your business shows up online.",
        "I'll keep this simple while we get oriented.",
      ],
    });
  }

  if (input.websiteUrl?.trim()) {
    candidates.push({
      category: "website",
      priority: 40,
      paragraphs: [
        "I'm learning from your website so my recommendations stay true to your business.",
      ],
    });
  }

  if (input.seasonalHint) {
    candidates.push({
      category: "planning",
      priority: 85,
      paragraphs: [
        `I prepared content ideas based on upcoming seasonal demand (${input.seasonalHint}).`,
        "I'll include my recommendation in this week's briefing.",
      ],
    });
  } else if (input.planSummary) {
    candidates.push({
      category: "planning",
      priority: 70,
      paragraphs: [
        "I'm planning the week around what we already set out to accomplish this month.",
        "Nothing flashy — steady progress.",
      ],
    });
  }

  if (wins.posts > 0 || input.publishingReadyOrScheduled > 0) {
    const prepared = input.publishingReadyOrScheduled;
    candidates.push({
      category: "publishing",
      priority: 80,
      paragraphs: [
        prepared > 0
          ? `I prepared ${prepared} update${prepared === 1 ? "" : "s"} so your presence stays consistent.`
          : `I published ${wins.posts} update${wins.posts === 1 ? "" : "s"} while you were busy.`,
        "I'm watching how they land before I suggest anything else.",
      ],
    });
  }

  if (wins.reviews > 0 || input.unansweredReviews > 0) {
    if (input.unansweredReviews > 0) {
      candidates.push({
        category: "reviews",
        priority: 90,
        paragraphs: [
          "I'm watching your Google reviews closely.",
          "There's something that may need your opinion — I'll keep it clear in your briefing.",
        ],
      });
    } else {
      candidates.push({
        category: "reviews",
        priority: 75,
        paragraphs: [
          memory
            ? `${memory} your Google reviews continue to improve.`
            : "Your Google reviews continue to improve.",
          "Nothing needs your attention today on reputation.",
        ],
      });
    }
  }

  if (wins.views > 0 && input.gbpConnected) {
    candidates.push({
      category: "search_visibility",
      priority: 60,
      paragraphs: [
        "I'm monitoring your search visibility.",
        `I noticed ${wins.views.toLocaleString()} profile views coming through.`,
      ],
    });
  }

  if (input.openRecommendations > 0 && !input.seasonalHint) {
    candidates.push({
      category: "market_trends",
      priority: 65,
      paragraphs: [
        "I noticed a few opportunities worth a calm look.",
        "I'm monitoring whether they become a meaningful trend before I ask for your time.",
      ],
    });
  }

  if (input.healthState === "excellent" || input.healthState === "healthy") {
    candidates.push({
      category: "marketing_health",
      priority: 55,
      paragraphs: [
        input.healthState === "excellent"
          ? "Everything is looking healthy — your online presence is in good shape."
          : "Your online presence is healthy.",
        "I'm continuing to monitor your visibility.",
      ],
    });
  } else if (input.healthState === "needs_attention") {
    candidates.push({
      category: "marketing_health",
      priority: 88,
      paragraphs: [
        "I'm watching a couple of items so nothing slips.",
        "I'll keep the ask small and clear when I need you.",
      ],
    });
  } else {
    candidates.push({
      category: "marketing_health",
      priority: 95,
      paragraphs: [
        "I'm focused on getting the foundations steady for you.",
        "Once those are solid, the week gets quieter.",
      ],
    });
  }

  if (input.pendingApprovals > 0) {
    candidates.push({
      category: "community",
      priority: 92,
      paragraphs: [
        "I've prepared your Weekly Briefing.",
        `Estimated review time: ${Math.max(1, input.estimatedReviewMinutes)} minute${input.estimatedReviewMinutes === 1 ? "" : "s"}.`,
      ],
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      category: "monitoring",
      priority: 50,
      paragraphs: [
        "Everything is running smoothly.",
        "I'm continuing to monitor your business.",
      ],
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Pure Journal orchestrator.
 * Turns existing HoM signals into day-by-day Head of Marketing narrative.
 * Does not call engines or invent history.
 */
export function buildHeadOfMarketingJournal(input: JournalInput): HeadOfMarketingJournal {
  const now = input.now ?? new Date();
  const candidates = buildCandidates(input, now);

  // Quality over quantity — at most five day entries.
  const selected = candidates.slice(0, 5);

  const entries: HeadOfMarketingJournalEntry[] = selected.map((candidate, index) => ({
    dayLabel: DAY_LABELS[Math.min(index, DAY_LABELS.length - 1)]!,
    paragraphs: candidate.paragraphs,
    category: candidate.category,
  }));

  const intro = input.isEarlyCustomer
    ? "While you were getting started, I was already learning your business."
    : "While you were serving customers, I was working quietly in the background.";

  let closing: string | null = null;
  if (input.pendingApprovals === 0 && (input.healthState === "excellent" || input.healthState === "healthy")) {
    closing = "I've got everything covered. Go enjoy your weekend.";
  } else if (input.pendingApprovals > 0) {
    closing = "When you have a few minutes, your briefing is ready.";
  } else {
    closing = "I'm continuing to monitor — I'll let you know if anything changes.";
  }

  return {
    intro,
    entries,
    closing,
    detail: DETAIL,
  };
}

/** Words that must never appear in customer-facing journal narrative. */
export const JOURNAL_FORBIDDEN_TERMS = [
  "Tasks",
  "Jobs",
  "Pipelines",
  "Engines",
  "Queues",
  "Synchronization",
  "Analysis complete",
  "pipeline",
  "background job",
] as const;
