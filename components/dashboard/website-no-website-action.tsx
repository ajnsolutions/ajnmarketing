"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchBusinessProfile, upsertBusinessProfile } from "@/lib/business-profile-client";
import { applyNoWebsiteConfirmed } from "@/lib/onboarding-storage";

export function WebsiteNoWebsiteAction({
  initiallyConfirmed,
}: {
  initiallyConfirmed: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(initiallyConfirmed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmNoWebsite() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { profile, error: loadError } = await fetchBusinessProfile();
    if (loadError || !profile) {
      setBusy(false);
      setError("Unable to update website preference.");
      return;
    }

    const voice_notes = applyNoWebsiteConfirmed(profile.voice_notes, true);
    const { error: saveError } = await upsertBusinessProfile({
      ...profile,
      website: null,
      voice_notes,
    });
    setBusy(false);

    if (saveError) {
      setError("Unable to save. Please try again.");
      return;
    }

    await fetch("/api/setup/steps/website/skip", { method: "POST" });

    setConfirmed(true);
    setMessage("Saved — you confirmed you do not have a website. Other setup can continue.");
    router.refresh();
  }

  if (confirmed) {
    return (
      <p className="text-sm leading-6 text-text-muted" role="status">
        {message ??
          "You confirmed you do not have a website. You can add one later anytime."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={confirmNoWebsite}
        className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
      >
        I don&apos;t have a website
      </button>
      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
