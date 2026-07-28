"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { InsightDecisionType, InsightKey } from "@/lib/business-discovery/continuation/types";
import type { PublicBusinessDiscoveryResultV1, PublicSnapshotErrorResponse } from "@/lib/business-discovery/public/types";
import { trackSnapshotEvent } from "@/lib/snapshot-ui/analytics";
import { saveDraftDecisions, loadDraftDecisions } from "@/lib/snapshot-ui/decisionStorage";
import type { DraftDecisionMap, ScanErrorState, ScanPhase } from "@/lib/snapshot-ui/types";
import { ScanForm, type ScanFormValues } from "@/components/snapshot/scan-form";
import { ScanProgress } from "@/components/snapshot/scan-progress";
import { SnapshotResults } from "@/components/snapshot/snapshot-results";

function friendlyErrorMessage(code: string, serverMessage: string, retryAfterSeconds: number | null): string {
  switch (code) {
    case "blocked_url":
      return "We couldn't safely visit that address. Check the website and try again.";
    case "rate_limited":
      return retryAfterSeconds
        ? `You've reached the limit for free snapshots right now. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minutes.`
        : "You've reached the limit for free snapshots right now. Please try again later.";
    case "timeout":
      return "That website took too long to respond. You can try again, or continue with what we find next time.";
    case "upstream_unavailable":
      return "We couldn't finish studying that website right now. Please try again in a moment.";
    case "internal_error":
      return "Something went wrong on our end. Please try again shortly.";
    default:
      return serverMessage || "We couldn't complete that Snapshot. Please try again.";
  }
}

export function SnapshotFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [formValues, setFormValues] = useState<Partial<ScanFormValues>>(() => {
    const prefillUrl = searchParams.get("url");
    return prefillUrl ? { websiteUrl: prefillUrl } : {};
  });
  const [result, setResult] = useState<PublicBusinessDiscoveryResultV1 | null>(null);
  const [error, setError] = useState<ScanErrorState | null>(null);
  const [decisions, setDecisions] = useState<DraftDecisionMap>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    trackSnapshotEvent("scan_form_viewed");
  }, []);

  async function handleSubmit(values: ScanFormValues) {
    setFormValues(values);
    setError(null);
    setPhase("scanning");
    trackSnapshotEvent("scan_submitted");
    trackSnapshotEvent("scan_started");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/business-discovery/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contractVersion: "v1",
          websiteUrl: values.websiteUrl.trim(),
          ...(values.businessName.trim() ? { businessName: values.businessName.trim() } : {}),
          ...(values.city.trim() ? { city: values.city.trim() } : {}),
          ...(values.stateOrRegion.trim() ? { stateOrRegion: values.stateOrRegion.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as PublicSnapshotErrorResponse | null;
        const code = body?.error?.code ?? "internal_error";
        const retryAfterHeader = response.headers.get("Retry-After");
        trackSnapshotEvent("validation_failed", { errorCode: code });
        setError({
          code,
          message: friendlyErrorMessage(code, body?.error?.message ?? "", retryAfterHeader ? Number(retryAfterHeader) : null),
          retryable: true,
        });
        setPhase("error");
        return;
      }

      const body = (await response.json()) as { result: PublicBusinessDiscoveryResultV1 };
      setResult(body.result);
      setDecisions(loadDraftDecisions(body.result.snapshotReference));
      setPhase("results");
      trackSnapshotEvent("scan_completed");
    } catch {
      if (controller.signal.aborted) {
        setPhase("idle");
        return;
      }
      setError({
        code: "network_error",
        message: "We couldn't reach AJN Marketing right now. Check your connection and try again.",
        retryable: true,
      });
      setPhase("error");
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleDecide(insightKey: InsightKey, decision: InsightDecisionType, correctedValue?: string, note?: string) {
    if (!result) return;
    const next: DraftDecisionMap = {
      ...decisions,
      [insightKey]: { insightKey, decision, correctedValue, note },
    };
    setDecisions(next);
    saveDraftDecisions(result.snapshotReference, next);

    const eventForDecision = {
      confirm: "insight_confirmed",
      correct: "insight_corrected",
      reject: "insight_rejected",
      review_later: "insight_deferred",
    } as const;
    trackSnapshotEvent(eventForDecision[decision], { insightKey });
  }

  function handleContinue() {
    if (!result) return;
    trackSnapshotEvent("signup_selected");
    router.push(`/signup?snapshotRef=${encodeURIComponent(result.snapshotReference)}`);
  }

  function handleSignIn() {
    if (!result) return;
    trackSnapshotEvent("signin_selected");
    const next = `/onboarding?snapshotRef=${encodeURIComponent(result.snapshotReference)}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  function handleScanDifferentBusiness() {
    setResult(null);
    setDecisions({});
    setFormValues({});
    setError(null);
    setPhase("idle");
  }

  return (
    <div>
      {phase === "idle" && (
        <ScanForm onSubmit={handleSubmit} submitting={false} initialValues={formValues} />
      )}

      {phase === "scanning" && <ScanProgress onCancel={handleCancel} />}

      {phase === "error" && error && (
        <div className="space-y-5">
          <div role="alert" className="rounded-2xl border border-amber-200/80 bg-amber-50 p-5 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
            {error.message}
          </div>
          <ScanForm onSubmit={handleSubmit} submitting={false} initialValues={formValues} />
        </div>
      )}

      {phase === "results" && result && (
        <SnapshotResults
          snapshot={result}
          decisions={decisions}
          onDecide={handleDecide}
          onContinue={handleContinue}
          onSignIn={handleSignIn}
          partial={result.degraded}
        />
      )}

      {phase === "results" && result && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleScanDifferentBusiness}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Scan a different business
          </button>
        </div>
      )}
    </div>
  );
}
