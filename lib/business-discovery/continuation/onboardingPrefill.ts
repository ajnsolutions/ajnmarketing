/**
 * Onboarding prefill mapping — pure, no I/O.
 *
 * Deliberately narrow: maps only the handful of fields the existing
 * OnboardingWizard already asks about (business name, website, city, state)
 * from visitor-*supplied* data on the resolved snapshot — never from an AI
 * Assumed insight. Prefilling a text field with an AI guess the user hasn't
 * seen or confirmed yet would blur exactly the line this whole feature
 * exists to keep sharp ("AI-generated Assumed data must never become Known
 * without explicit confirmation") — even a soft, editable prefill risks a
 * user skimming past it and treating it as already-true. The richer,
 * AI-derived insights (summary, services, personality, strengths,
 * opportunities) are surfaced only through the explicit confirmation
 * contract (types.ts / applyConfirmations.ts), for a future dedicated
 * review screen — never silently poured into a form field.
 */

import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";
import type { OnboardingData } from "@/lib/onboarding-storage";
import type { OnboardingSnapshotPrefill } from "@/lib/business-discovery/continuation/types";

export function buildOnboardingPrefillFromSnapshot(
  snapshot: PublicBusinessDiscoveryResultV1
): OnboardingSnapshotPrefill {
  return {
    businessName: snapshot.businessName,
    websiteUrl: snapshot.websiteUrl,
    city: snapshot.city,
    state: snapshot.stateOrRegion,
  };
}

/**
 * Merges a snapshot prefill into onboarding data — only ever fills a field
 * that is still blank. Never overwrites something the user (or a prior
 * saved profile) already has. This is the entirety of Part 5's "prefill"
 * behavior: existing/returning-user data always wins.
 */
export function mergeOnboardingPrefill(data: OnboardingData, prefill: OnboardingSnapshotPrefill | null): OnboardingData {
  if (!prefill) return data;

  return {
    ...data,
    businessName: data.businessName.trim() ? data.businessName : (prefill.businessName ?? data.businessName),
    websiteUrl: data.websiteUrl.trim() ? data.websiteUrl : (prefill.websiteUrl ?? data.websiteUrl),
    city: data.city.trim() ? data.city : (prefill.city ?? data.city),
    state: data.state.trim() ? data.state : (prefill.state ?? data.state),
  };
}
