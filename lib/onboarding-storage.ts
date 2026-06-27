export const ONBOARDING_COMPLETE_KEY = "ajn_onboarding_complete";
export const ONBOARDING_DRAFT_KEY = "ajn_onboarding_draft";

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

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}

export function markOnboardingComplete(): void {
  window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
  window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export function saveOnboardingDraft(data: OnboardingData): void {
  window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(data));
}

export function loadOnboardingDraft(): OnboardingData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
  if (!raw) return null;
  try {
    return { ...initialOnboardingData, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}
