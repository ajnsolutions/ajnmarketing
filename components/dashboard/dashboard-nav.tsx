import type { ReactNode } from "react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const iconHome = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 4l8 7.5M6 10.5V20h4v-5h4v5h4V10.5" />
  </svg>
);

const iconResults = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3" />
  </svg>
);

const iconLibrary = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8h5M9.5 12h5M9.5 16h3.5" />
  </svg>
);

const iconSettings = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/**
 * Great Simplification primary nav — four destinations only.
 * Weekly review and Google remain contextual (HoM CTA / Settings / More).
 */
export const primaryDashboardNavItems: DashboardNavItem[] = [
  { label: "Your Head of Marketing", href: "/dashboard", icon: iconHome },
  { label: "Results", href: "/dashboard/results", icon: iconResults },
  { label: "Library", href: "/dashboard/library", icon: iconLibrary },
  { label: "Settings", href: "/dashboard/settings", icon: iconSettings },
];

/** Early post-onboarding: same calm primary set. */
export const focusedDashboardNavHrefs = [
  "/dashboard",
  "/dashboard/results",
  "/dashboard/library",
  "/dashboard/settings",
] as const;

/** Advanced tools — progressive disclosure only (routes still work). */
export const advancedDashboardNavItems: DashboardNavItem[] = [
  {
    label: "This Week",
    href: "/dashboard/approvals",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Google Profile",
    href: "/dashboard/google-business-profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    label: "What I'm working on",
    href: "/dashboard/tasks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 7 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Preparing for publication",
    href: "/dashboard/publishing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    ),
  },
  {
    label: "What I'd recommend",
    href: "/dashboard/marketing-recommendations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.2 4.5L19 8.3l-3.5 3.4.8 4.8L12 14.8 7.7 16.5l.8-4.8L5 8.3l4.8-.8L12 3Z" />
      </svg>
    ),
  },
  {
    label: "This month's plan",
    href: "/dashboard/marketing-plan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z" />
      </svg>
    ),
  },
  {
    label: "Strategic calendar",
    href: "/dashboard/strategic-marketing-calendar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01" />
      </svg>
    ),
  },
  {
    label: "Why the plan changed",
    href: "/dashboard/decision-intelligence",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      </svg>
    ),
  },
  {
    label: "Reviews",
    href: "/dashboard/reviews",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.6 6.5L21 9.5l-5 4.3 1.5 6.5L12 17.8 6.5 20.3 8 13.8 3 9.5l6.4-.9L12 2Z" />
      </svg>
    ),
  },
  {
    label: "Brand voice",
    href: "/dashboard/brand-voice",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 8h8M8 12h6M8 16h4" />
      </svg>
    ),
  },
  {
    label: "Marketing profile",
    href: "/dashboard/ai-profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    label: "Website analysis",
    href: "/dashboard/website-analysis",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
  {
    label: "Detailed workspace",
    href: "/dashboard/command-center",
    icon: iconHome,
  },
  {
    label: "Setup checklist",
    href: "/dashboard/setup",
    icon: iconSettings,
  },
];

/** Full flat list retained for any legacy consumers; primary experience uses split nav. */
export const dashboardNavItems: DashboardNavItem[] = [
  ...primaryDashboardNavItems,
  ...advancedDashboardNavItems,
];
