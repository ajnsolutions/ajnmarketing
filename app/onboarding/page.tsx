import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { isOnboardingCompleteForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";
import { claimSnapshotForUser, resolveSnapshotForUser } from "@/lib/business-discovery/continuation/service";
import { buildOnboardingPrefillFromSnapshot } from "@/lib/business-discovery/continuation/onboardingPrefill";
import type { OnboardingSnapshotPrefill } from "@/lib/business-discovery/continuation/types";

export const metadata = {
  title: "Meet Your Head of Marketing",
  description: "Introduce your business to your AJN Marketing Head of Marketing.",
};

/**
 * Resolves and claims a Free Marketing Snapshot reference for prefill,
 * server-side, before the wizard ever mounts. Fails gracefully at every
 * step — an absent, invalid, or expired reference simply falls back to
 * standard onboarding with no prefill and no error shown to the visitor
 * (Part 5's explicit "fall back gracefully" / "continue through normal
 * onboarding without a Snapshot" requirement).
 */
async function resolveSnapshotPrefill(
  userId: string,
  rawReference: string | undefined
): Promise<OnboardingSnapshotPrefill | null> {
  if (!rawReference) return null;

  const resolution = resolveSnapshotForUser(userId, rawReference);
  if (resolution.status !== "resolved") return null;

  // Claiming is idempotent and safe to attempt on every visit to this page —
  // a repeat visit by the same user is a no-op; a reference already claimed
  // by someone else simply yields no prefill for this user, silently.
  const claim = claimSnapshotForUser(userId, rawReference);
  if (claim.status !== "claimed" && claim.status !== "already_claimed_by_you") return null;

  return buildOnboardingPrefillFromSnapshot(resolution.snapshot);
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshotRef?: string }>;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, params] = await Promise.all([supabase.auth.getUser(), searchParams]);

  if (!user) {
    redirect("/login");
  }

  const onboardingComplete = await isOnboardingCompleteForUser();

  if (onboardingComplete) {
    redirect("/dashboard");
  }

  const snapshotPrefill = await resolveSnapshotPrefill(user.id, params.snapshotRef);

  return <OnboardingWizard snapshotPrefill={snapshotPrefill} />;
}
