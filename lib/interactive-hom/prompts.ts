/**
 * Suggested prompts for the Ask Your Head of Marketing panel.
 */

import {
  InteractiveHomQuestionCategories,
  type InteractiveHomSuggestedPrompt,
} from "@/lib/interactive-hom/types";

export const INTERACTIVE_HOM_SUGGESTED_PROMPTS: readonly InteractiveHomSuggestedPrompt[] = [
  {
    id: "work_today",
    label: "What should I work on today?",
    category: InteractiveHomQuestionCategories.WORK_ON_TODAY,
  },
  {
    id: "why_recommended",
    label: "Why is this recommended?",
    category: InteractiveHomQuestionCategories.WHY_RECOMMENDED,
  },
  {
    id: "what_changed",
    label: "What changed this week?",
    category: InteractiveHomQuestionCategories.WHAT_CHANGED,
  },
  {
    id: "campaign",
    label: "How is my campaign doing?",
    category: InteractiveHomQuestionCategories.CAMPAIGN_STATUS,
  },
  {
    id: "learned",
    label: "What have we learned?",
    category: InteractiveHomQuestionCategories.WHAT_LEARNED,
  },
  {
    id: "risks",
    label: "What risks should I know about?",
    category: InteractiveHomQuestionCategories.RISKS,
  },
  {
    id: "opportunities",
    label: "What opportunities do you see?",
    category: InteractiveHomQuestionCategories.OPPORTUNITIES,
  },
  {
    id: "priority",
    label: "Explain this priority.",
    category: InteractiveHomQuestionCategories.EXPLAIN_PRIORITY,
  },
] as const;
