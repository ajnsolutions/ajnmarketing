/**
 * Milestone definitions — meaningful activation stages, not a long checklist.
 */

import { SetupStepKeys } from "@/lib/customer-setup/types";
import { ConnectionCategories } from "@/lib/business-connections/types";
import {
  GuidedMilestoneKeys,
  type GuidedMilestoneKey,
} from "@/lib/guided-setup/types";

export type MilestoneDefinition = {
  key: GuidedMilestoneKey;
  title: string;
  knownSummary: string;
  brainImprovement: string;
  relatedSetupStepKeys: (typeof SetupStepKeys)[keyof typeof SetupStepKeys][];
  relatedConnectionCategories: (typeof ConnectionCategories)[keyof typeof ConnectionCategories][];
  /** Optional milestones never block advisor readiness. */
  requiredForAdvisor: boolean;
  sortOrder: number;
};

export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
  {
    key: GuidedMilestoneKeys.KNOW_BUSINESS,
    title: "Know your business",
    knownSummary: "Name, industry, and where you serve customers.",
    brainImprovement:
      "I can speak accurately about your business instead of guessing basics.",
    relatedSetupStepKeys: [SetupStepKeys.BUSINESS_INFO],
    relatedConnectionCategories: [],
    requiredForAdvisor: true,
    sortOrder: 10,
  },
  {
    key: GuidedMilestoneKeys.KNOW_SUCCESS,
    title: "Know what success looks like",
    knownSummary: "Your marketing goals and priorities.",
    brainImprovement:
      "Recommendations and weekly plans stay tied to what matters to you.",
    relatedSetupStepKeys: [SetupStepKeys.MARKETING_GOALS],
    relatedConnectionCategories: [],
    requiredForAdvisor: true,
    sortOrder: 20,
  },
  {
    key: GuidedMilestoneKeys.WEBSITE_UNDERSTANDING,
    title: "Understand your website",
    knownSummary: "Services, tone, and messaging from your site — or confirmed none.",
    brainImprovement:
      "Better SEO insight and content that matches how you already present yourself.",
    relatedSetupStepKeys: [SetupStepKeys.WEBSITE],
    relatedConnectionCategories: [ConnectionCategories.WEBSITE_AND_SEARCH],
    requiredForAdvisor: false,
    sortOrder: 30,
  },
  {
    key: GuidedMilestoneKeys.CUSTOMER_FEEDBACK,
    title: "Hear customer feedback",
    knownSummary: "How customers talk about you locally (reviews and presence).",
    brainImprovement:
      "Customer Voice becomes available — more authentic recommendations and copy.",
    relatedSetupStepKeys: [SetupStepKeys.GOOGLE_BUSINESS],
    relatedConnectionCategories: [ConnectionCategories.CUSTOMER_FEEDBACK],
    requiredForAdvisor: false,
    sortOrder: 40,
  },
  {
    key: GuidedMilestoneKeys.ADVISOR_READY,
    title: "Weekly advisor ready",
    knownSummary: "Enough foundation for trustworthy weekly guidance.",
    brainImprovement:
      "Growth Advisor can meet with you weekly with grounded recommendations.",
    relatedSetupStepKeys: [SetupStepKeys.HEAD_OF_MARKETING],
    relatedConnectionCategories: [],
    requiredForAdvisor: true,
    sortOrder: 50,
  },
] as const;
