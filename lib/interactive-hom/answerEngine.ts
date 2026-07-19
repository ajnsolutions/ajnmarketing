/**
 * Deterministic grounded answers for Interactive Head of Marketing.
 * Explains existing intelligence only — never creates recommendations or takes action.
 */

import {
  InteractiveHomQuestionCategories,
  type InteractiveHomAnswer,
  type InteractiveHomGroundedContext,
  type InteractiveHomQuestionCategory,
} from "@/lib/interactive-hom/types";

function joinSentences(parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function bulletList(items: string[], limit = 3): string {
  return items
    .slice(0, limit)
    .map((item) => `• ${item}`)
    .join("\n");
}

function insufficient(
  category: InteractiveHomQuestionCategory,
  answer: string,
): InteractiveHomAnswer {
  return {
    category,
    answer,
    grounded: false,
    evidenceLabels: [],
    insufficientData: true,
  };
}

function grounded(
  category: InteractiveHomQuestionCategory,
  answer: string,
  evidenceLabels: string[],
): InteractiveHomAnswer {
  return {
    category,
    answer,
    grounded: evidenceLabels.length > 0,
    evidenceLabels,
    insufficientData: false,
  };
}

function answerWorkOnToday(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = ["Marketing Director priority"];
  const parts: string[] = [];

  if (ctx.primaryAction.kind !== "none") {
    parts.push(`Today, focus on: ${ctx.primaryAction.label}.`);
  }

  const todayItems = ctx.executiveBrief.today.map((item) => item.text);
  const priorities = ctx.executiveBrief.topPriorities.map((item) => item.text);
  const focusItems = todayItems.length > 0 ? todayItems : priorities;

  if (focusItems.length > 0) {
    parts.push(`Here's what matters most right now:\n${bulletList(focusItems)}`);
    labels.push("Executive Brief");
  }

  if (ctx.recommendation) {
    parts.push(
      `I'd also keep this recommendation in view: ${ctx.recommendation.title}.`,
    );
    labels.push("Current recommendation");
  }

  if (parts.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.WORK_ON_TODAY,
      "I don't have a specific next step to recommend from today's data yet. Check back after your Weekly Briefing refreshes, or review Approvals if anything is waiting on your opinion.",
    );
  }

  if (ctx.primaryAction.kind === "none") {
    parts.unshift("Nothing urgent needs your attention today.");
  }

  return grounded(
    InteractiveHomQuestionCategories.WORK_ON_TODAY,
    joinSentences(parts),
    labels,
  );
}

function answerWhyRecommended(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  if (!ctx.recommendation) {
    return insufficient(
      InteractiveHomQuestionCategories.WHY_RECOMMENDED,
      "There isn't an active recommendation to explain right now. When Marketing Director surfaces one, I can walk through why it matters in plain language.",
    );
  }

  const labels = ["Recommendation explanation"];
  const parts = [
    `I recommend: ${ctx.recommendation.title}.`,
    `Why it matters: ${ctx.recommendation.why}`,
    `Expected benefit: ${ctx.recommendation.expectedBenefit}`,
  ];

  const preference = ctx.preferences[0];
  if (preference?.instructionText) {
    parts.push(`This also respects your preference: "${preference.instructionText}"`);
    labels.push("Your preference");
  }

  const learning = ctx.learnings.find((item) => item.direction === "positive");
  if (learning?.summary) {
    parts.push(learning.summary);
    labels.push("What we've learned");
  }

  const activeCampaign = ctx.campaigns[0];
  if (activeCampaign) {
    parts.push(
      `This recommendation aligns with your active ${activeCampaign.title} campaign.`,
    );
    labels.push("Active campaign");
  }

  return grounded(
    InteractiveHomQuestionCategories.WHY_RECOMMENDED,
    joinSentences(parts),
    labels,
  );
}

function answerWhatChanged(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = [];
  const parts: string[] = [];

  if (ctx.thisWeek.length > 0) {
    parts.push(`Here's what I handled:\n${bulletList(ctx.thisWeek)}`);
    labels.push("This week");
  }

  const changes = ctx.executiveBrief.recentChanges.map((item) => item.text);
  if (changes.length > 0) {
    parts.push(`Recent changes:\n${bulletList(changes)}`);
    labels.push("Executive Brief changes");
  }

  if (ctx.noticed.length > 0) {
    parts.push(`What I noticed:\n${bulletList(ctx.noticed)}`);
    labels.push("Observations");
  }

  if (parts.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.WHAT_CHANGED,
      "I don't have enough recent activity to summarize changes yet. As approvals, publishing, and reviews move, I'll have a clearer week-over-week picture.",
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.WHAT_CHANGED,
    joinSentences(parts),
    labels,
  );
}

function answerCampaignStatus(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  if (ctx.campaigns.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.CAMPAIGN_STATUS,
      "You don't have an active campaign right now. When Marketing Director starts one, I can summarize progress, the next milestone, and completion.",
    );
  }

  const campaign = ctx.campaigns[0]!;
  const labels = ["Campaign Intelligence"];
  const lines = [
    `${campaign.title} is ${campaign.status.replaceAll("_", " ")} (${campaign.completionPercent}% complete).`,
    campaign.nextMilestone
      ? `Next milestone: ${campaign.nextMilestone}.`
      : "All planned steps are accounted for.",
  ];

  if (campaign.recentProgress.length > 0) {
    lines.push(`Recent progress:\n${bulletList(campaign.recentProgress)}`);
  }

  if (ctx.campaigns.length > 1) {
    lines.push(`You also have ${ctx.campaigns.length - 1} other active campaign(s).`);
  }

  return grounded(
    InteractiveHomQuestionCategories.CAMPAIGN_STATUS,
    joinSentences(lines),
    labels,
  );
}

function answerWhatLearned(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = [];
  const parts: string[] = [];

  if (ctx.preferences.length > 0) {
    const preferenceLines = ctx.preferences
      .slice(0, 3)
      .map((preference) => preference.instructionText);
    parts.push(`You've told us:\n${bulletList(preferenceLines)}`);
    labels.push("Your preferences");
  }

  if (ctx.learnings.length > 0) {
    const learningLines = ctx.learnings.slice(0, 3).map((learning) => learning.summary);
    parts.push(`What we've observed over time:\n${bulletList(learningLines)}`);
    labels.push("Historical patterns");
  }

  if (parts.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.WHAT_LEARNED,
      "We're still early on learning for your business. As recommendations are approved, published, and measured, I'll be able to share clearer patterns—without guessing.",
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.WHAT_LEARNED,
    joinSentences(parts),
    labels,
  );
}

function answerRisks(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = [];
  const risks: string[] = [];

  for (const item of ctx.executiveBrief.watchItems) {
    risks.push(item.text);
  }
  if (ctx.executiveBrief.watchItems.length > 0) labels.push("Watch items");

  if (ctx.unansweredReviews > 0) {
    risks.push(
      `${ctx.unansweredReviews} review${ctx.unansweredReviews === 1 ? "" : "s"} still need a reply.`,
    );
    labels.push("Reviews");
  }
  if (ctx.publishFailures > 0) {
    risks.push(
      `${ctx.publishFailures} publishing job${ctx.publishFailures === 1 ? "" : "s"} need attention.`,
    );
    labels.push("Publishing");
  }
  if (ctx.health.state === "at_risk" || ctx.health.state === "needs_attention") {
    risks.push(ctx.health.reason);
    labels.push("Marketing Health");
  }

  if (risks.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.RISKS,
      "I don't see material risks in the current data. Marketing Health looks steady, and there aren't open watch items to escalate.",
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.RISKS,
    `Here's what I'd keep an eye on:\n${bulletList(risks)}`,
    labels,
  );
}

function answerOpportunities(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = [];
  const opportunities: string[] = [];

  for (const signal of ctx.marketContextSignals.slice(0, 3)) {
    opportunities.push(signal.title);
  }
  if (ctx.marketContextSignals.length > 0) labels.push("Market Context");

  if (ctx.recommendation) {
    opportunities.push(ctx.recommendation.title);
    labels.push("Current recommendation");
  }

  for (const priority of ctx.monthlyFocus.priorities.slice(0, 2)) {
    opportunities.push(priority.label);
  }
  if (ctx.monthlyFocus.priorities.length > 0) labels.push("Monthly Focus");

  if (opportunities.length === 0) {
    return insufficient(
      InteractiveHomQuestionCategories.OPPORTUNITIES,
      "I don't have a clear new opportunity from Market Context or open recommendations yet. When local timing or a strong recommendation appears, I'll call it out here.",
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.OPPORTUNITIES,
    `Opportunities worth considering:\n${bulletList(opportunities)}`,
    labels,
  );
}

function answerExplainPriority(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const labels: string[] = ["Marketing Director priority"];
  const parts = [
    `The current priority is: ${ctx.primaryAction.label}.`,
    ctx.executiveBrief.summary,
  ];

  if (ctx.monthlyFocus.title) {
    parts.push(`This sits under ${ctx.monthlyFocus.title}: ${ctx.monthlyFocus.intro}`);
    labels.push("Monthly Focus");
  }

  const topPriority = ctx.executiveBrief.topPriorities[0]?.text;
  if (topPriority) {
    parts.push(`In short: ${topPriority}`);
    labels.push("Executive Brief");
  }

  if (ctx.primaryAction.kind === "none" && !topPriority) {
    return insufficient(
      InteractiveHomQuestionCategories.EXPLAIN_PRIORITY,
      "There isn't a customer action queued as the primary priority right now. You're in a calm stretch—I'll explain the next one when Marketing Director surfaces it.",
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.EXPLAIN_PRIORITY,
    joinSentences(parts),
    labels,
  );
}

function answerExecutiveBrief(ctx: InteractiveHomGroundedContext): InteractiveHomAnswer {
  const brief = ctx.executiveBrief;
  if (!brief.headline.trim() && !brief.summary.trim()) {
    return insufficient(
      InteractiveHomQuestionCategories.EXECUTIVE_BRIEF,
      "I don't have an Executive Brief ready to summarize yet.",
    );
  }

  const parts = [
    brief.headline,
    brief.summary,
  ];

  if (brief.topPriorities.length > 0) {
    parts.push(
      `Top priorities:\n${bulletList(brief.topPriorities.map((item) => item.text))}`,
    );
  }

  return grounded(
    InteractiveHomQuestionCategories.EXECUTIVE_BRIEF,
    joinSentences(parts),
    ["Executive Brief"],
  );
}

function answerUnsupported(): InteractiveHomAnswer {
  return insufficient(
    InteractiveHomQuestionCategories.UNSUPPORTED,
    "I can explain priorities, recommendations, campaigns, weekly changes, learnings, risks, and opportunities—based only on what we already know. Try one of the suggested questions, or ask something in those areas.",
  );
}

/**
 * Produce a deterministic answer for a classified question + grounded context.
 * Identical inputs always produce identical answers.
 */
export function answerInteractiveHomQuestion(
  category: InteractiveHomQuestionCategory,
  context: InteractiveHomGroundedContext,
): InteractiveHomAnswer {
  switch (category) {
    case InteractiveHomQuestionCategories.WORK_ON_TODAY:
      return answerWorkOnToday(context);
    case InteractiveHomQuestionCategories.WHY_RECOMMENDED:
      return answerWhyRecommended(context);
    case InteractiveHomQuestionCategories.WHAT_CHANGED:
      return answerWhatChanged(context);
    case InteractiveHomQuestionCategories.CAMPAIGN_STATUS:
      return answerCampaignStatus(context);
    case InteractiveHomQuestionCategories.WHAT_LEARNED:
      return answerWhatLearned(context);
    case InteractiveHomQuestionCategories.RISKS:
      return answerRisks(context);
    case InteractiveHomQuestionCategories.OPPORTUNITIES:
      return answerOpportunities(context);
    case InteractiveHomQuestionCategories.EXPLAIN_PRIORITY:
      return answerExplainPriority(context);
    case InteractiveHomQuestionCategories.EXECUTIVE_BRIEF:
      return answerExecutiveBrief(context);
    case InteractiveHomQuestionCategories.UNSUPPORTED:
      return answerUnsupported();
    default:
      return answerUnsupported();
  }
}
