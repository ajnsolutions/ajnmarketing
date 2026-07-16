import type { OnboardingData } from "@/lib/onboarding-storage";
import {
  applyAudienceToGoals,
  applyCustomerOriginToGoals,
  audienceFromGoals,
  buildDeferredConnectionsNote,
  customerOriginFromGoals,
  parseDeferredConnections,
  stripMagicGoalMarkers,
} from "@/lib/onboarding-storage";

export type BusinessProfile = {
  id: string;
  user_id: string;
  business_name: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  primary_service_area: string | null;
  nearby_cities: string | null;
  primary_services: string | null;
  emergency_services: string | null;
  seasonal_services: string | null;
  specialty_services: string | null;
  competitors: string | null;
  marketing_goals: string[] | null;
  brand_voice_tone: string | null;
  preferred_words: string | null;
  avoid_words: string | null;
  voice_notes: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessProfileUpsert = Omit<
  BusinessProfile,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SettingsFormData = {
  businessName: string;
  industry: string;
  website: string;
  phone: string;
  city: string;
  state: string;
  tone: string;
  wordsToUse: string;
  wordsToAvoid: string;
};

function parseCompetitors(raw: string | null): {
  competitor1: string;
  competitor2: string;
  competitor3: string;
  competitorsSkipped: boolean;
} {
  if (!raw?.trim()) {
    return { competitor1: "", competitor2: "", competitor3: "", competitorsSkipped: true };
  }

  const items = raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    competitor1: items[0] ?? "",
    competitor2: items[1] ?? "",
    competitor3: items[2] ?? "",
    competitorsSkipped: items.length === 0,
  };
}

function serializeCompetitors(data: OnboardingData): string | null {
  if (data.competitorsSkipped) return null;

  const items = [data.competitor1, data.competitor2, data.competitor3]
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items.join("\n") : null;
}

export function onboardingDataToProfileRow(
  userId: string,
  data: OnboardingData,
  onboardingCompleted = false
): BusinessProfileUpsert {
  return {
    user_id: userId,
    business_name: data.businessName || null,
    industry: data.industry || null,
    website: data.websiteUrl || null,
    phone: data.phone || null,
    city: data.city || null,
    state: data.state || null,
    primary_service_area: data.primaryServiceArea || null,
    nearby_cities: data.nearbyCities || null,
    primary_services: data.primaryServices || null,
    emergency_services: data.emergencyServices || null,
    seasonal_services: data.seasonalServices || null,
    specialty_services: data.specialtyServices || null,
    competitors: serializeCompetitors(data),
    marketing_goals: applyCustomerOriginToGoals(
      applyAudienceToGoals(data.marketingGoals, data.businessAudience),
      data.customerOrigin,
    ),
    brand_voice_tone: data.tone || null,
    preferred_words: data.wordsToUse || null,
    avoid_words: data.wordsToAvoid || null,
    voice_notes: buildDeferredConnectionsNote(
      data.exampleMessage,
      data.facebookSkipped,
      data.instagramSkipped,
      data.linkedinSkipped,
    ) || null,
    onboarding_completed: onboardingCompleted,
  };
}

export function profileRowToOnboardingData(profile: BusinessProfile): OnboardingData {
  const competitors = parseCompetitors(profile.competitors);
  const voiceNotes = profile.voice_notes ?? "";
  const deferred = parseDeferredConnections(voiceNotes);
  const goals = profile.marketing_goals ?? [];

  return {
    businessName: profile.business_name ?? "",
    industry: profile.industry ?? "",
    websiteUrl: profile.website ?? "",
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    primaryServiceArea: profile.primary_service_area ?? "",
    nearbyCities: profile.nearby_cities ?? "",
    gbpSkipped: true,
    gbpAnswer: "",
    businessAudience: audienceFromGoals(goals),
    customerOrigin: customerOriginFromGoals(goals),
    facebookSkipped: deferred.facebookSkipped,
    instagramSkipped: deferred.instagramSkipped,
    linkedinSkipped: deferred.linkedinSkipped,
    primaryServices: profile.primary_services ?? "",
    emergencyServices: profile.emergency_services ?? "",
    seasonalServices: profile.seasonal_services ?? "",
    specialtyServices: profile.specialty_services ?? "",
    competitor1: competitors.competitor1,
    competitor2: competitors.competitor2,
    competitor3: competitors.competitor3,
    competitorsSkipped: competitors.competitorsSkipped,
    marketingGoals: stripMagicGoalMarkers(goals),
    tone: profile.brand_voice_tone ?? "",
    wordsToUse: profile.preferred_words ?? "",
    wordsToAvoid: profile.avoid_words ?? "",
    exampleMessage: voiceNotes.replace(/\n?Deferred connections:.*$/m, "").trim(),
  };
}

export function profileToSettingsForm(profile: BusinessProfile | null): SettingsFormData {
  return {
    businessName: profile?.business_name ?? "",
    industry: profile?.industry ?? "",
    website: profile?.website ?? "",
    phone: profile?.phone ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    tone: profile?.brand_voice_tone ?? "",
    wordsToUse: profile?.preferred_words ?? "",
    wordsToAvoid: profile?.avoid_words ?? "",
  };
}

export function settingsFormToProfileRow(
  userId: string,
  form: SettingsFormData,
  existing: BusinessProfile | null
): BusinessProfileUpsert {
  return {
    user_id: userId,
    business_name: form.businessName || null,
    industry: form.industry || null,
    website: form.website || null,
    phone: form.phone || null,
    city: form.city || null,
    state: form.state || null,
    primary_service_area: existing?.primary_service_area ?? null,
    nearby_cities: existing?.nearby_cities ?? null,
    primary_services: existing?.primary_services ?? null,
    emergency_services: existing?.emergency_services ?? null,
    seasonal_services: existing?.seasonal_services ?? null,
    specialty_services: existing?.specialty_services ?? null,
    competitors: existing?.competitors ?? null,
    marketing_goals: existing?.marketing_goals ?? [],
    brand_voice_tone: form.tone || null,
    preferred_words: form.wordsToUse || null,
    avoid_words: form.wordsToAvoid || null,
    voice_notes: existing?.voice_notes ?? null,
    onboarding_completed: existing?.onboarding_completed ?? false,
  };
}

export function formatServiceAreas(profile: BusinessProfile | null): string {
  const parts = [profile?.primary_service_area, profile?.nearby_cities]
    .filter(Boolean)
    .join(", ");

  return parts || "Not provided yet";
}

export function formatWebsiteDisplay(website: string | null): string {
  if (!website) return "Not provided yet";
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function parseWordList(raw: string | null | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;

  const items = raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

export function displayValue(value: string | null | undefined, fallback = "Not provided yet"): string {
  return value?.trim() ? value.trim() : fallback;
}
