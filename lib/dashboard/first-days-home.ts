import { parseDeferredConnections } from "@/lib/onboarding-storage";

export type FirstDaysSetupItem = {
  id: string;
  label: string;
  complete: boolean;
};

export type FirstDaysPrimaryAction = {
  label: string;
  href: string;
  kind: "connect_google" | "review_recommendations" | "none";
};

export type FirstDaysHomeModel = {
  greeting: string;
  lead: string;
  setupItems: FirstDaysSetupItem[];
  happeningNext: string;
  primaryAction: FirstDaysPrimaryAction;
  /** Early customers get a quieter home + focused nav. */
  isEarlyCustomer: boolean;
};

function firstNameFrom(userName: string): string {
  const trimmed = userName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

function timeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function buildFirstDaysHomeModel(input: {
  userName: string;
  businessName: string;
  websiteUrl: string | null;
  voiceNotes: string | null;
  gbpConnected: boolean;
  recommendationCount: number;
  now?: Date;
}): FirstDaysHomeModel {
  const deferred = parseDeferredConnections(input.voiceNotes ?? "");
  const hasWebsite = Boolean(input.websiteUrl?.trim());
  const hasBusiness = Boolean(input.businessName?.trim() && input.businessName !== "Your Business");

  const setupItems: FirstDaysSetupItem[] = [
    {
      id: "profile",
      label: "Learned the basics about your business",
      complete: hasBusiness && hasWebsite,
    },
    {
      id: "website",
      label: "Reviewing your website",
      complete: hasWebsite,
    },
    {
      id: "gbp",
      label: "Google Business Profile connected",
      complete: input.gbpConnected,
    },
    {
      id: "facebook",
      label: deferred.facebookSkipped
        ? "Facebook — later recommendation"
        : "Facebook noted for later",
      complete: true,
    },
    {
      id: "instagram",
      label: deferred.instagramSkipped
        ? "Instagram — later recommendation"
        : "Instagram noted for later",
      complete: true,
    },
  ];

  const isEarlyCustomer =
    !input.gbpConnected ||
    deferred.facebookSkipped ||
    deferred.instagramSkipped ||
    deferred.linkedinSkipped;

  let primaryAction: FirstDaysPrimaryAction;
  if (!input.gbpConnected) {
    primaryAction = {
      kind: "connect_google",
      label: "Finish Google connection",
      href: "/dashboard/google-business-profile/connect",
    };
  } else if (input.recommendationCount > 0) {
    primaryAction = {
      kind: "review_recommendations",
      label: "Review your first recommendations",
      href: "/dashboard/marketing-recommendations",
    };
  } else {
    primaryAction = {
      kind: "none",
      label: "Nothing needed from you right now",
      href: "/dashboard",
    };
  }

  const happeningNext = !input.gbpConnected
    ? "I'll keep preparing your first week. Connecting Google unlocks local posts and reviews when you're ready."
    : input.recommendationCount > 0
      ? "Your first recommendations are ready whenever you have a minute."
      : "I'm preparing your first marketing plan and first week of work.";

  const name = firstNameFrom(input.userName);
  const greeting = `${timeOfDayGreeting(input.now)}, ${name}.`;
  const lead = isEarlyCustomer
    ? "I'm getting started..."
    : "While you were busy...";

  return {
    greeting,
    lead,
    setupItems,
    happeningNext,
    primaryAction,
    isEarlyCustomer,
  };
}

/** Hrefs kept in focused early-customer navigation (aligned with HoM primary). */
export const FOCUSED_NAV_HREFS = [
  "/dashboard",
  "/dashboard/google-business-profile",
  "/dashboard/approvals",
  "/dashboard/settings",
] as const;

export function shouldUseFocusedNav(model: FirstDaysHomeModel): boolean {
  return model.isEarlyCustomer;
}
