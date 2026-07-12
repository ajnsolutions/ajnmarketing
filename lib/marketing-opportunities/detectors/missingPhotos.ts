import type { GoogleBusinessDashboardData } from "@/lib/google-business/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

const KNOWN_PHOTO_METADATA_KEYS = ["photoCount", "totalMediaItemCount"];

/**
 * Fires when a connected location's photo count (if present in profile_metadata) is
 * low. IMPORTANT LIMITATION: this codebase does not sync Google Business Profile media
 * (that's a separate API resource — locations.media.list — that nothing here calls
 * yet), so `profile_metadata` today never actually contains a photo count. Rather than
 * always firing (a false positive for every connected tenant, since we'd have no real
 * signal) or guessing a fake count, this detector checks for the field honestly and
 * simply produces no opportunity until real photo data exists — a real, correct
 * implementation given current data, not a stub. Wiring up media sync would make this
 * detector immediately useful with no changes here.
 */
export function detectMissingPhotos(gbpData: GoogleBusinessDashboardData): MarketingOpportunityDraft[] {
  if (!gbpData.connected || !gbpData.location) return [];

  const metadata = gbpData.location.profile_metadata ?? {};
  const hasPhotoSignal = KNOWN_PHOTO_METADATA_KEYS.some((key) => key in metadata);
  if (!hasPhotoSignal) return [];

  const photoCount = Number(metadata.photoCount ?? metadata.totalMediaItemCount ?? 0);
  if (photoCount > 3) return [];

  return [
    {
      category: OpportunityCategories.MISSING_PHOTOS,
      severity: photoCount === 0 ? OpportunitySeverities.HIGH : OpportunitySeverities.MEDIUM,
      confidence: 60,
      title: photoCount === 0 ? "No photos on Google Business Profile" : "Very few photos on Google Business Profile",
      description: `This location has ${photoCount} photo(s) on its Google Business Profile. Listings with more photos get significantly more customer engagement.`,
      evidence: { photoCount },
      recommendedAction: "Upload recent photos of the business, team, and completed work to the Google Business Profile.",
      expiresAt: null,
      dedupeKey: "current",
    },
  ];
}
