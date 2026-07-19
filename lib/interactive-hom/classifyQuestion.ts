/**
 * Deterministic question classification — keyword/phrase matching only.
 * Identical normalized input always yields the same category.
 */

import {
  InteractiveHomQuestionCategories,
  type InteractiveHomQuestionCategory,
} from "@/lib/interactive-hom/types";

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

type Rule = {
  category: InteractiveHomQuestionCategory;
  patterns: RegExp[];
};

const RULES: readonly Rule[] = [
  {
    category: InteractiveHomQuestionCategories.WORK_ON_TODAY,
    patterns: [
      /\bwhat should i (work on|do|focus on)\b/,
      /\bwhat('s| is) (next|my (next )?priority)\b/,
      /\btoday\b.*\b(work|focus|do|priority)\b/,
      /\bwork on today\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.WHY_RECOMMENDED,
    patterns: [
      /\bwhy (is|was) (this|that|it) recommended\b/,
      /\bwhy (do you|are you) recommend/,
      /\bwhy this recommendation\b/,
      /\bexplain (this |the )?recommendation\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.WHAT_CHANGED,
    patterns: [
      /\bwhat changed\b/,
      /\bthis week\b/,
      /\brecent (changes|updates|progress)\b/,
      /\bwhat('s| is) new\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.CAMPAIGN_STATUS,
    patterns: [
      /\bcampaign\b/,
      /\bhow is (my |the )?campaign\b/,
      /\bcampaign (doing|progress|status)\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.WHAT_LEARNED,
    patterns: [
      /\bwhat (have we|did we|do we) learn/,
      /\bwhat('s| is) (working|learned)\b/,
      /\bmarketing memory\b/,
      /\bprefer(ence|ences|red)\b/,
      /\blearnings?\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.RISKS,
    patterns: [
      /\brisks?\b/,
      /\bwatch (out|for|items?)\b/,
      /\bshould i (worry|know about)\b/,
      /\bat risk\b/,
      /\bproblems?\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.OPPORTUNITIES,
    patterns: [
      /\bopportunit(y|ies)\b/,
      /\bwhat (do you|can we) see\b/,
      /\bmarket context\b/,
      /\bseasonal\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.EXPLAIN_PRIORITY,
    patterns: [
      /\bexplain (this |the |my )?priority\b/,
      /\bwhy (is )?(this|that) (a )?priority\b/,
      /\bpriority\b/,
    ],
  },
  {
    category: InteractiveHomQuestionCategories.EXECUTIVE_BRIEF,
    patterns: [
      /\bexecutive brief\b/,
      /\bmorning brief\b/,
      /\bsummarize (the )?brief\b/,
      /\bbrief summary\b/,
    ],
  },
] as const;

/**
 * Classify a customer question. Order of rules matters for overlapping phrases;
 * first match wins. Empty/whitespace → unsupported.
 */
export function classifyInteractiveHomQuestion(
  question: string,
): InteractiveHomQuestionCategory {
  const normalized = normalizeQuestion(question);
  if (!normalized) return InteractiveHomQuestionCategories.UNSUPPORTED;

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule.category;
    }
  }

  return InteractiveHomQuestionCategories.UNSUPPORTED;
}
