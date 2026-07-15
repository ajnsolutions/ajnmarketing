"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { InteractiveDemoResult } from "@/lib/interactive-demo/types";
import { ProgressIndicator } from "./progress-indicator";
import {
  DEMO_PROGRESS_MESSAGES,
  initialAiDemoFormInputs,
  type AiDemoFormInputs,
  type AiDemoUiPhase,
} from "./types";

const industryOptions = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "Landscaping",
  "Insurance",
  "Other local service business",
] as const;

function ResultCard({
  title,
  children,
  badge,
  note,
}: {
  title: string;
  children: React.ReactNode;
  badge?: string;
  note?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
          {title}
        </h3>
        {badge && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
            {badge}
          </span>
        )}
      </div>
      {note && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          {note}
        </p>
      )}
      {children}
    </article>
  );
}

function InfoFormStep({
  inputs,
  onChange,
  onSubmit,
  submitting,
}: {
  inputs: AiDemoFormInputs;
  onChange: (field: keyof AiDemoFormInputs, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const inputClassName =
    "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-navy-900 shadow-sm ring-1 ring-slate-900/[0.03] transition-colors focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">Website URL</span>
        <input
          required
          type="url"
          placeholder="https://yourbusiness.com"
          value={inputs.websiteUrl}
          onChange={(event) => onChange("websiteUrl", event.target.value)}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">
          Business name <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <input
          type="text"
          placeholder="Your Business Name"
          value={inputs.businessName}
          onChange={(event) => onChange("businessName", event.target.value)}
          className={inputClassName}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-navy-900">
            City <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            type="text"
            placeholder="City"
            value={inputs.city}
            onChange={(event) => onChange("city", event.target.value)}
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-navy-900">
            State <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            type="text"
            placeholder="State"
            value={inputs.state}
            onChange={(event) => onChange("state", event.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">
          Industry <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <select
          value={inputs.industry}
          onChange={(event) => onChange("industry", event.target.value)}
          className={inputClassName}
        >
          <option value="">We’ll infer from your website when possible</option>
          {industryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          See What AJN Would Do
        </button>
      </div>
    </form>
  );
}

function LoadingStep({ messageIndex }: { messageIndex: number }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center sm:py-14">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-600 border-r-brand-600" />
      </div>

      <p className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
        Building your interactive demo
      </p>
      <p className="mt-3 max-w-md text-base leading-7 text-text-muted">
        We’re analyzing your real website and preparing a simplified preview of
        what AJN Marketing would do. This usually takes under a minute.
      </p>

      <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03]">
        <ul className="space-y-3 text-left">
          {DEMO_PROGRESS_MESSAGES.map((message, index) => {
            const isActive = index === messageIndex;
            const isComplete = index < messageIndex;

            return (
              <li
                key={message}
                className={`flex items-center gap-3 text-sm ${
                  isActive
                    ? "font-semibold text-brand-600"
                    : isComplete
                      ? "text-navy-900"
                      : "text-slate-400"
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
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                {message}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ResultsStep({
  result,
  onRestart,
}: {
  result: InteractiveDemoResult;
  onRestart: () => void;
}) {
  function trackCta() {
    void fetch("/api/interactive-demo/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "cta_clicked" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200/80 bg-growth-50 p-5 ring-1 ring-emerald-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-growth-500">
          Here’s what AJN Marketing noticed
        </p>
        <p className="mt-2 text-lg font-bold text-navy-900">
          A preview for {result.meta.inferredBusinessName}
          {result.meta.inferredCity ? ` in ${result.meta.inferredCity}` : ""}
        </p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          Live website findings, a simplified marketing snapshot, prioritized
          recommendations, and clearly labeled example content — not fabricated
          SEO scores.
        </p>
      </div>

      <ResultCard
        title="Website snapshot"
        badge="Live findings"
        note="Based on analyzing your website"
      >
        <p className="text-base leading-7 text-slate-600">
          {result.websiteSnapshot.businessSummary}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-navy-900">Strengths</p>
            <ul className="mt-2 space-y-2">
              {result.websiteSnapshot.strengths.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                  <span className="text-growth-500" aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">
              Here’s what we’d improve first
            </p>
            <ul className="mt-2 space-y-2">
              {result.websiteSnapshot.improvementOpportunities.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                  <span className="text-brand-600" aria-hidden="true">
                    →
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ResultCard>

      <ResultCard
        title="Marketing snapshot"
        badge="Generated profile"
        note="Simplified from AJN’s marketing profile engine"
      >
        <dl className="space-y-4 text-sm leading-7 text-slate-600">
          <div>
            <dt className="font-semibold text-navy-900">Brand personality</dt>
            <dd className="mt-1">
              {result.marketingSnapshot.brandPersonality.join(" · ") ||
                result.marketingSnapshot.brandVoice}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-navy-900">Target audience</dt>
            <dd className="mt-1">{result.marketingSnapshot.targetAudience}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy-900">Messaging</dt>
            <dd className="mt-1">{result.marketingSnapshot.messaging}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy-900">Competitive positioning</dt>
            <dd className="mt-1">
              {result.marketingSnapshot.competitivePositioning}
            </dd>
          </div>
        </dl>
      </ResultCard>

      <ResultCard
        title="Top recommendations"
        badge="Here’s what we’d improve first"
        note="Reuse of AJN recommendation presentation"
      >
        <div className="space-y-4">
          {result.recommendations.map((rec) => (
            <div
              key={`${rec.actionType}-${rec.title}`}
              className="rounded-xl border border-slate-100 bg-surface p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-base font-bold text-navy-900">{rec.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{rec.explanation}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-navy-900">Why: </span>
                  {rec.why.join(" ")}
                </p>
                <p>
                  <span className="font-semibold text-navy-900">Expected benefit: </span>
                  {rec.expectedBenefit}
                </p>
                <p>
                  <span className="font-semibold text-navy-900">Example action: </span>
                  {rec.exampleAction}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ResultCard>

      <ResultCard
        title="Example campaign content"
        badge="Examples only"
        note="Generated examples — not published content"
      >
        {result.contentExamples.length === 0 ? (
          <p className="text-sm leading-7 text-slate-600">
            Example content wasn’t available for this run. Your recommendations
            and website snapshot above still show how AJN would prioritize work.
          </p>
        ) : (
          <div className="space-y-4">
            {result.contentExamples.map((example) => (
              <div
                key={`${example.channel}-${example.label}`}
                className="rounded-xl border border-slate-100 bg-surface p-4 ring-1 ring-slate-200/60"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {example.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-navy-900">
                  {example.title}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {example.body}
                </p>
                {example.cta && (
                  <p className="mt-3 text-sm font-medium text-navy-800">
                    CTA: {example.cta}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ResultCard>

      <ResultCard title="How we’d help every week" badge="Weekly workflow">
        <ul className="space-y-3">
          {result.weeklyWorkflow.map((step) => (
            <li key={step} className="flex gap-2 text-sm leading-6 text-slate-600">
              <span className="text-growth-500" aria-hidden="true">
                ✓
              </span>
              {step}
            </li>
          ))}
        </ul>
      </ResultCard>

      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-8 text-center shadow-xl shadow-slate-300/30 sm:p-10">
        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Ready for AJN to become your marketing employee?
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          Create an account to connect Google Business Profile, approve weekly
          updates, and put this workflow to work for your business.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            onClick={trackCta}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-brand-700 shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
          >
            Create My Account
          </Link>
          <Link
            href="/pricing"
            onClick={trackCta}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/5"
          >
            See Pricing
          </Link>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="mt-6 text-sm font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          Try another website
        </button>
      </div>
    </div>
  );
}

export function AiDemoFlow() {
  const [phase, setPhase] = useState<AiDemoUiPhase>("form");
  const [inputs, setInputs] = useState<AiDemoFormInputs>(initialAiDemoFormInputs);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [result, setResult] = useState<InteractiveDemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof AiDemoFormInputs, value: string) {
    setInputs((current) => ({ ...current, [field]: value }));
  }

  async function startDemo() {
    setError(null);
    setResult(null);
    setSubmitting(true);
    setLoadingMessageIndex(0);
    setPhase("loading");

    try {
      const response = await fetch("/api/interactive-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: inputs.websiteUrl,
          businessName: inputs.businessName || undefined,
          industry: inputs.industry || undefined,
          city: inputs.city || undefined,
          state: inputs.state || undefined,
        }),
      });

      const payload = (await response.json()) as {
        result?: InteractiveDemoResult;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Unable to run the demo right now.");
      }

      setResult(payload.result);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("form");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (phase !== "loading") return;

    const messageInterval = window.setInterval(() => {
      setLoadingMessageIndex((current) =>
        current < DEMO_PROGRESS_MESSAGES.length - 1 ? current + 1 : current,
      );
    }, 4500);

    return () => window.clearInterval(messageInterval);
  }, [phase]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ProgressIndicator phase={phase} />

      <div className="mt-10 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/[0.04] sm:p-8 lg:p-10">
        {phase === "form" && (
          <>
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">
                Interactive demo
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                See exactly what AJN would do for your business
              </h2>
              <p className="mt-3 text-base leading-7 text-text-muted">
                Enter your website. We’ll analyze it, build a simplified marketing
                snapshot, recommend first moves, and show example content — then
                explain how weekly approval works.
              </p>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            <InfoFormStep
              inputs={inputs}
              onChange={updateField}
              onSubmit={startDemo}
              submitting={submitting}
            />
          </>
        )}

        {phase === "loading" && (
          <LoadingStep messageIndex={loadingMessageIndex} />
        )}

        {phase === "results" && result && (
          <ResultsStep
            result={result}
            onRestart={() => {
              setResult(null);
              setError(null);
              setPhase("form");
            }}
          />
        )}
      </div>
    </div>
  );
}
