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
