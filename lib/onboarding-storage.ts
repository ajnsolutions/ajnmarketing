export type BusinessAudience = "local" | "online" | "";

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
  /** Magic first-five-minutes: Yes / No / Not sure */
  gbpAnswer: GbpAnswer;
  /** Magic: primarily local vs online */
  businessAudience: BusinessAudience;
  facebookSkipped: boolean;
  instagramSkipped: boolean;
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
  facebookSkipped: false,
  instagramSkipped: false,
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

/** Encode deferred social connects into voice_notes without a schema change. */
export function buildDeferredConnectionsNote(
  existing: string,
  facebookSkipped: boolean,
  instagramSkipped: boolean,
): string {
  const base = existing
    .replace(/\n?Deferred connections:.*$/m, "")
    .trim();
  const deferred: string[] = [];
  if (facebookSkipped) deferred.push("Facebook");
  if (instagramSkipped) deferred.push("Instagram");
  if (deferred.length === 0) return base;
  const line = `Deferred connections: ${deferred.join(", ")} (future recommendation).`;
  return base ? `${base}\n${line}` : line;
}

export function parseDeferredConnections(voiceNotes: string): {
  facebookSkipped: boolean;
  instagramSkipped: boolean;
} {
  const match = voiceNotes.match(/Deferred connections:\s*([^\n(]+)/i);
  if (!match) return { facebookSkipped: false, instagramSkipped: false };
  const list = match[1] ?? "";
  return {
    facebookSkipped: /facebook/i.test(list),
    instagramSkipped: /instagram/i.test(list),
  };
}
