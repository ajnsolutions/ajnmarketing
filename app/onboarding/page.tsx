import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { isOnboardingCompleteForUser } from "@/lib/business-profile-server";
import { createClient } from "@/lib/supabase/server";
import { claimSnapshotForUser, resolveSnapshotForUser } from "@/lib/business-discovery/continuation/service";
import { buildOnboardingPrefillFromSnapshot } from "@/lib/business-discovery/continuation/onboardingPrefill";
import type { OnboardingSnapshotPrefill } from "@/lib/business-discovery/continuation/types";
import type { PublicBusinessDiscoveryResultV1 } from "@/lib/business-discovery/public/types";

export const metadata = {
  title: "Meet Your Growth Advisor",
  description: "Introduce your business to your AJN Marketing Growth Advisor.",
};

const EXPIRED_SNAPSHOT_NOTICE =
  "Your Snapshot expired while you were signing in. You can continue setup below, or run a fresh scan anytime.";

type SnapshotContinuationOutcome =
  | { status: "resolved"; prefill: OnboardingSnapshotPrefill; snapshot: PublicBusinessDiscoveryResultV1; reference: string }
  | { status: "unavailable"; notice: string | null };

/**
 * Resolves and claims a Free Marketing Snapshot reference server-side,
 * before the wizard ever mounts. Fails gracefully at every step: an absent
 * or invalid reference (a bad/garbage link) falls back to standard
 * onboarding completely silently — but an *expired* reference (one that
 * genuinely existed and lapsed while the visitor was signing in) surfaces
 * an honest, friendly notice rather than silently pretending nothing was
 * ever there (Part 14's explicit expired-reference messaging requirement).
 *
 * Resolving here (rather than only client-side) means the wizard receives
 * the full snapshot content as a normal server-rendered prop — no extra
 * client-side round trip just to *display* it. Claiming also happens here,
 * once, so the client-side review step (snapshot-review-step.tsx) only ever
 * needs to call the confirm endpoint, never resolve/claim again.
 */
async function resolveSnapshotContinuation(
  userId: string,
  rawReference: string | undefined
): Promise<SnapshotContinuationOutcome> {
  if (!rawReference) return { status: "unavailable", notice: null };

  const resolution = resolveSnapshotForUser(userId, rawReference);
  if (resolution.status === "expired") {
    return { status: "unavailable", notice: EXPIRED_SNAPSHOT_NOTICE };
  }
  if (resolution.status !== "resolved") {
    // Invalid or never-issued — most likely a stale/garbage link. Nothing
    // useful to tell the visitor; proceed exactly like standard onboarding.
    return { status: "unavailable", notice: null };
  }

  // Claiming is idempotent and safe to attempt on every visit to this page —
  // a repeat visit by the same user is a no-op.
  const claim = claimSnapshotForUser(userId, rawReference);
  if (claim.status === "expired") {
    return { status: "unavailable", notice: EXPIRED_SNAPSHOT_NOTICE };
  }
  if (claim.status !== "claimed" && claim.status !== "already_claimed_by_you") {
    // claimed_by_another_user or invalid — never reveal that detail to this visitor.
    return { status: "unavailable", notice: null };
  }

  return {
    status: "resolved",
    prefill: buildOnboardingPrefillFromSnapshot(resolution.snapshot),
    snapshot: resolution.snapshot,
    reference: rawReference,
  };
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

  const continuation = await resolveSnapshotContinuation(user.id, params.snapshotRef);

  return (
    <OnboardingWizard
      snapshotPrefill={continuation.status === "resolved" ? continuation.prefill : null}
      snapshotReference={continuation.status === "resolved" ? continuation.reference : null}
      snapshot={continuation.status === "resolved" ? continuation.snapshot : null}
      snapshotNotice={continuation.status === "unavailable" ? continuation.notice : null}
    />
  );
}
