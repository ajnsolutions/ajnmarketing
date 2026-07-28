"use client";

import { useEffect, useState } from "react";

/**
 * Honest, plain-language stages — no fake precision percentages, no claim
 * of accessing private sources. This is a client-side approximation of
 * progress (the actual scan is one request/response — see
 * docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md), cycled on a timer while the
 * request is in flight, exactly matching the established pattern already in
 * production for the interactive demo (components/ai-demo/ai-demo-flow.tsx).
 */
export const SCAN_STAGES = [
  "Visiting your website",
  "Learning what you offer",
  "Understanding how customers may see you",
  "Finding growth opportunities",
  "Preparing your Snapshot",
] as const;

const STAGE_INTERVAL_MS = 2600;

export function ScanProgress({ onCancel }: { onCancel?: () => void }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, SCAN_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center px-4 py-10 text-center sm:py-14" role="status" aria-live="polite">
      <div className="relative mb-8 flex h-16 w-16 items-center justify-center motion-reduce:h-auto motion-reduce:w-auto">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200 motion-reduce:hidden" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-600 border-r-brand-600 motion-reduce:hidden" />
        <span className="hidden text-sm font-semibold text-brand-600 motion-reduce:inline">Working…</span>
      </div>

      <p className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
        Studying your business
      </p>
      <p className="mt-3 max-w-md text-base leading-7 text-text-muted">
        This usually takes under a minute. We&apos;re only looking at what&apos;s already public.
      </p>

      <ul className="mt-8 w-full max-w-md space-y-3 text-left" aria-label="Snapshot progress">
        {SCAN_STAGES.map((stage, index) => {
          const isActive = index === stageIndex;
          const isComplete = index < stageIndex;
          return (
            <li
              key={stage}
              className={`flex items-center gap-3 text-sm ${
                isActive ? "font-semibold text-brand-600" : isComplete ? "text-navy-900" : "text-slate-400"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  isComplete
                    ? "bg-growth-50 text-growth-500 ring-1 ring-emerald-100"
                    : isActive
                      ? "bg-brand-50 text-brand-600 ring-1 ring-brand-100"
                      : "bg-slate-100 text-slate-400"
                }`}
                aria-hidden="true"
              >
                {isComplete ? "✓" : index + 1}
              </span>
              {stage}
            </li>
          );
        })}
      </ul>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-8 text-sm font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-700"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
