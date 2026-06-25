"use client";

import { FormEvent, useEffect, useState } from "react";
import { buildDemoContent } from "./demo-content";
import { ProgressIndicator } from "./progress-indicator";
import {
  initialAiDemoInputs,
  type AiDemoInputs,
  type AiDemoStep,
} from "./types";

const loadingMessages = [
  "Analyzing your website...",
  "Detecting your brand voice...",
  "Reviewing local search opportunities...",
  "Creating sample content...",
] as const;

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
}: {
  title: string;
  children: React.ReactNode;
  badge?: string;
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
      {children}
    </article>
  );
}

function InfoFormStep({
  inputs,
  onChange,
  onSubmit,
}: {
  inputs: AiDemoInputs;
  onChange: (field: keyof AiDemoInputs, value: string) => void;
  onSubmit: () => void;
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
          value={inputs.website_url}
          onChange={(event) => onChange("website_url", event.target.value)}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">Business Name</span>
        <input
          required
          type="text"
          placeholder="Your Business Name"
          value={inputs.business_name}
          onChange={(event) => onChange("business_name", event.target.value)}
          className={inputClassName}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-navy-900">City</span>
          <input
            required
            type="text"
            placeholder="City"
            value={inputs.city}
            onChange={(event) => onChange("city", event.target.value)}
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-navy-900">State</span>
          <input
            required
            type="text"
            placeholder="State"
            value={inputs.state}
            onChange={(event) => onChange("state", event.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">Industry</span>
        <select
          required
          value={inputs.industry}
          onChange={(event) => onChange("industry", event.target.value)}
          className={inputClassName}
        >
          <option value="" disabled>
            Select your industry
          </option>
          {industryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy-900">Email</span>
        <input
          required
          type="email"
          placeholder="you@yourbusiness.com"
          value={inputs.email}
          onChange={(event) => onChange("email", event.target.value)}
          className={inputClassName}
        />
      </label>

      <div className="pt-2">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:translate-y-0 sm:w-auto"
        >
          Analyze My Website
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
          </svg>
        </div>
      </div>

      <p className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
        Building your free demo preview
      </p>
      <p className="mt-3 max-w-md text-base leading-7 text-text-muted">
        This usually takes about 30–60 seconds. We are reviewing your website and
        preparing sample content for your business.
      </p>

      <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03]">
        <ul className="space-y-3 text-left">
          {loadingMessages.map((message, index) => {
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
  inputs,
  emailNotice,
  onEmailClick,
}: {
  inputs: AiDemoInputs;
  emailNotice: string | null;
  onEmailClick: () => void;
}) {
  const content = buildDemoContent(inputs);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200/80 bg-growth-50 p-5 ring-1 ring-emerald-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-growth-500">
          Demo preview ready
        </p>
        <p className="mt-2 text-lg font-bold text-navy-900">
          Here is what AJN Marketing could create for {inputs.business_name}
        </p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          More Google visibility, more calls, better reviews, and done-for-you
          marketing — starting with your local presence in {inputs.city},{" "}
          {inputs.state}.
        </p>
      </div>

      <ResultCard title="Brand Voice Summary">
        <p className="text-base leading-7 text-slate-600">{content.brandVoice}</p>
      </ResultCard>

      <ResultCard title="Detected Services">
        <div className="flex flex-wrap gap-2.5">
          {content.services.map((service) => (
            <span
              key={service}
              className="rounded-full bg-slate-50 px-3.5 py-2 text-sm font-medium text-navy-800 ring-1 ring-slate-200"
            >
              {service}
            </span>
          ))}
        </div>
      </ResultCard>

      <ResultCard title="Google Business Profile Opportunity" badge="Local visibility">
        <div className="space-y-4">
          <div className="rounded-xl bg-surface px-4 py-3 ring-1 ring-slate-200/80">
            <p className="text-sm font-semibold text-navy-900">Current visibility</p>
            <p className="mt-1 text-sm text-amber-700">{content.gbpOpportunity.visibility}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">Recommended focus</p>
            <ul className="mt-3 space-y-2">
              {content.gbpOpportunity.recommendations.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <span className="mt-0.5 text-growth-500" aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ResultCard>

      <ResultCard title="Sample Google Business Profile Post" badge="GBP post">
        <p className="text-base leading-7 text-slate-600">{content.gbpPost}</p>
      </ResultCard>

      <ResultCard title="Sample Social Posts" badge="3 examples">
        <div className="space-y-4">
          {content.socialPosts.map((post) => (
            <div
              key={post.type}
              className="rounded-xl border border-slate-100 bg-surface p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {post.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{post.copy}</p>
            </div>
          ))}
        </div>
      </ResultCard>

      <ResultCard title="Blog Topic Ideas" badge="Content ideas">
        <ul className="space-y-3">
          {content.blogTopics.map((topic) => (
            <li
              key={topic}
              className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-200/70"
            >
              <span className="mt-0.5 font-bold text-brand-600" aria-hidden="true">
                •
              </span>
              {topic}
            </li>
          ))}
        </ul>
      </ResultCard>

      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-8 text-center shadow-xl shadow-slate-300/30 sm:p-10">
        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Want these results emailed to you?
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          Get your personalized preview in your inbox and see how AJN Marketing
          can help you get found on Google and win more local customers.
        </p>
        <div className="mt-8">
          <button
            type="button"
            onClick={onEmailClick}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-brand-700 shadow-lg shadow-black/10 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-xl active:translate-y-0"
          >
            Email My Free Demo
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h10M11 6l4 4-4 4" />
            </svg>
          </button>
        </div>
        {emailNotice && (
          <p className="mx-auto mt-5 max-w-md rounded-2xl bg-white/10 px-4 py-3 text-sm leading-6 text-slate-200 ring-1 ring-white/10">
            {emailNotice}
          </p>
        )}
      </div>
    </div>
  );
}

export function AiDemoFlow() {
  const [step, setStep] = useState<AiDemoStep>(1);
  const [inputs, setInputs] = useState<AiDemoInputs>(initialAiDemoInputs);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  function updateField(field: keyof AiDemoInputs, value: string) {
    setInputs((current) => ({ ...current, [field]: value }));
  }

  function startAnalysis() {
    setEmailNotice(null);
    setLoadingMessageIndex(0);
    setStep(2);
  }

  useEffect(() => {
    if (step !== 2) return;

    const messageInterval = window.setInterval(() => {
      setLoadingMessageIndex((current) =>
        current < loadingMessages.length - 1 ? current + 1 : current,
      );
    }, 900);

    const completeTimeout = window.setTimeout(() => {
      setStep(3);
    }, 3600);

    return () => {
      window.clearInterval(messageInterval);
      window.clearTimeout(completeTimeout);
    };
  }, [step]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ProgressIndicator currentStep={step} />

      <div className="mt-10 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/[0.04] sm:p-8 lg:p-10">
        {step === 1 && (
          <>
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">
                Step 1 of 3
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                Tell us about your business
              </h2>
              <p className="mt-3 text-base leading-7 text-text-muted">
                Enter a few details and we will build a free preview of how AJN
                Marketing could improve your Google visibility, reviews, and local
                reach.
              </p>
            </div>
            <InfoFormStep
              inputs={inputs}
              onChange={updateField}
              onSubmit={startAnalysis}
            />
          </>
        )}

        {step === 2 && <LoadingStep messageIndex={loadingMessageIndex} />}

        {step === 3 && (
          <ResultsStep
            inputs={inputs}
            emailNotice={emailNotice}
            onEmailClick={() =>
              setEmailNotice(
                "Email delivery coming soon. Your demo preview is ready.",
              )
            }
          />
        )}
      </div>
    </div>
  );
}
