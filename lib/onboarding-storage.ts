export type BusinessAudience = "local" | "online" | "";

export type CustomerOrigin = "local_community" | "regional" | "national" | "";

export type GbpAnswer = "yes" | "no" | "not_sure" | "";

export type OnboardingData = {
  businessName: string;
  industry: string;
  websiteUrl: string;
  phone: string;
  city: string;
  state: string;
  primaryServiceArea: string;
  nearbyCities: string;
  gbpSkipped: boolean;
  /** Magic: Yes / No / Not sure */
  gbpAnswer: GbpAnswer;
  /** Magic: primarily local vs online */
  businessAudience: BusinessAudience;
  /** Magic: where customers come from */
  customerOrigin: CustomerOrigin;
  facebookSkipped: boolean;
  instagramSkipped: boolean;
  linkedinSkipped: boolean;
  primaryServices: string;
  emergencyServices: string;
  seasonalServices: string;
  specialtyServices: string;
  competitor1: string;
  competitor2: string;
  competitor3: string;
  competitorsSkipped: boolean;
  marketingGoals: string[];
  tone: string;
  wordsToUse: string;
  wordsToAvoid: string;
  exampleMessage: string;
};

export const initialOnboardingData: OnboardingData = {
  businessName: "",
  industry: "",
  websiteUrl: "",
  phone: "",
  city: "",
  state: "",
  primaryServiceArea: "",
  nearbyCities: "",
  gbpSkipped: false,
  gbpAnswer: "",
  businessAudience: "",
  customerOrigin: "",
  facebookSkipped: false,
  instagramSkipped: false,
  linkedinSkipped: false,
  primaryServices: "",
  emergencyServices: "",
  seasonalServices: "",
  specialtyServices: "",
  competitor1: "",
  competitor2: "",
  competitor3: "",
  competitorsSkipped: false,
  marketingGoals: [],
  tone: "",
  wordsToUse: "",
  wordsToAvoid: "",
  exampleMessage: "",
};

export const marketingGoalOptions = [
  "More phone calls",
  "More Google visibility",
  "More reviews",
  "Better content consistency",
  "More website traffic",
  "Better local ranking",
  "Less time managing marketing",
];

const AUDIENCE_LOCAL = "Audience: Local business";
const AUDIENCE_ONLINE = "Audience: Online business";
const ORIGIN_LOCAL = "Customers: Local community";
const ORIGIN_REGIONAL = "Customers: Regional";
const ORIGIN_NATIONAL = "Customers: National";

const MAGIC_GOAL_MARKERS = [
  AUDIENCE_LOCAL,
  AUDIENCE_ONLINE,
  ORIGIN_LOCAL,
  ORIGIN_REGIONAL,
  ORIGIN_NATIONAL,
] as const;

/** Encode Magic audience into marketing_goals without a schema change. */
export function applyAudienceToGoals(
  goals: string[],
  audience: BusinessAudience,
): string[] {
  const without = goals.filter(
    (goal) => goal !== AUDIENCE_LOCAL && goal !== AUDIENCE_ONLINE,
  );
  if (audience === "local") return [...without, AUDIENCE_LOCAL];
  if (audience === "online") return [...without, AUDIENCE_ONLINE];
  return without;
}

export function audienceFromGoals(goals: string[]): BusinessAudience {
  if (goals.includes(AUDIENCE_LOCAL)) return "local";
  if (goals.includes(AUDIENCE_ONLINE)) return "online";
  return "";
}

/** Encode customer origin into marketing_goals without a schema change. */
export function applyCustomerOriginToGoals(
  goals: string[],
  origin: CustomerOrigin,
): string[] {
  const without = goals.filter(
    (goal) =>
      goal !== ORIGIN_LOCAL && goal !== ORIGIN_REGIONAL && goal !== ORIGIN_NATIONAL,
  );
  if (origin === "local_community") return [...without, ORIGIN_LOCAL];
  if (origin === "regional") return [...without, ORIGIN_REGIONAL];
  if (origin === "national") return [...without, ORIGIN_NATIONAL];
  return without;
}

export function customerOriginFromGoals(goals: string[]): CustomerOrigin {
  if (goals.includes(ORIGIN_LOCAL)) return "local_community";
  if (goals.includes(ORIGIN_REGIONAL)) return "regional";
  if (goals.includes(ORIGIN_NATIONAL)) return "national";
  return "";
}

/** Strip Magic markers so UI goal pickers stay clean. */
export function stripMagicGoalMarkers(goals: string[]): string[] {
  return goals.filter(
    (goal) => !(MAGIC_GOAL_MARKERS as readonly string[]).includes(goal),
  );
}

/** Encode deferred social connects into voice_notes without a schema change. */
export function buildDeferredConnectionsNote(
  existing: string,
  facebookSkipped: boolean,
  instagramSkipped: boolean,
  linkedinSkipped = false,
): string {
  const base = existing
    .replace(/\n?Deferred connections:.*$/m, "")
    .trim();
  const deferred: string[] = [];
  if (facebookSkipped) deferred.push("Facebook");
  if (instagramSkipped) deferred.push("Instagram");
  if (linkedinSkipped) deferred.push("LinkedIn");
  if (deferred.length === 0) return base;
  const line = `Deferred connections: ${deferred.join(", ")} (future recommendation).`;
  return base ? `${base}\n${line}` : line;
}

export function parseDeferredConnections(voiceNotes: string): {
  facebookSkipped: boolean;
  instagramSkipped: boolean;
  linkedinSkipped: boolean;
} {
  const match = voiceNotes.match(/Deferred connections:\s*([^\n(]+)/i);
  if (!match) {
    return { facebookSkipped: false, instagramSkipped: false, linkedinSkipped: false };
  }
  const list = match[1] ?? "";
  return {
    facebookSkipped: /facebook/i.test(list),
    instagramSkipped: /instagram/i.test(list),
    linkedinSkipped: /linkedin/i.test(list),
  };
}

/** Learning-language progress copy tailored by business type. */
export function learningProgressMessages(audience: BusinessAudience): string[] {
  if (audience === "online") {
    return [
      "Learning about your business...",
      "Understanding your customers...",
      "Exploring how people discover you...",
      "Preparing your marketing strategy...",
      "Building your first week...",
    ];
  }

  return [
    "Learning about your business...",
    "Understanding your customers...",
    "Getting to know your community...",
    "Preparing your marketing strategy...",
    "Building your first week...",
  ];
}
