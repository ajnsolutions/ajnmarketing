/**
 * Phase 4A — grouped advanced navigation for clearer pilot IA.
 * Presentation only; routes unchanged.
 */

export type AdvancedNavGroupId =
  | "this_week"
  | "foundation"
  | "insights"
  | "workspace";

export type AdvancedNavGroup = {
  id: AdvancedNavGroupId;
  label: string;
  description: string;
  hrefs: readonly string[];
};

export const ADVANCED_NAV_GROUPS: readonly AdvancedNavGroup[] = [
  {
    id: "this_week",
    label: "This week",
    description: "Review, publish, and act on what needs you",
    hrefs: [
      "/dashboard/approvals",
      "/dashboard/publishing",
      "/dashboard/marketing-recommendations",
      "/dashboard/tasks",
    ],
  },
  {
    id: "foundation",
    label: "Marketing foundation",
    description: "Business setup and brand context",
    hrefs: [
      "/dashboard/setup",
      "/dashboard/brand-voice",
      "/dashboard/ai-profile",
      "/dashboard/website-analysis",
      "/dashboard/marketing-plan",
      "/dashboard/google-business-profile",
      "/dashboard/reviews",
    ],
  },
  {
    id: "insights",
    label: "Deeper insights",
    description: "Optional detail when you want more context",
    hrefs: [
      "/dashboard/decision-intelligence",
      "/dashboard/strategic-marketing-calendar",
    ],
  },
  {
    id: "workspace",
    label: "Advanced workspace",
    description: "Power tools — keep folded away until you need them",
    hrefs: ["/dashboard/command-center"],
  },
] as const;
