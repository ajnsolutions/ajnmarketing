/**
 * Guided Business Setup & First Wins — public barrel.
 */

export { buildGuidedSetupExperience } from "@/lib/guided-setup/buildGuidedSetupExperience";
export { buildFirstWins, firstWinForMilestone } from "@/lib/guided-setup/firstWins";
export { buildGuidedEmptyStates } from "@/lib/guided-setup/emptyStates";
export { recommendGuidedNextStep } from "@/lib/guided-setup/recommend";
export { MILESTONE_DEFINITIONS } from "@/lib/guided-setup/milestones";
export type {
  FirstWin,
  GuidedEmptyState,
  GuidedMilestone,
  GuidedNextStep,
  GuidedSetupExperience,
  KnowledgeSignal,
  KnowledgeState,
  MilestoneState,
} from "@/lib/guided-setup/types";
export {
  GuidedMilestoneKeys,
  KNOWLEDGE_STATE_LABELS,
  KnowledgeStates,
  MilestoneStates,
} from "@/lib/guided-setup/types";
