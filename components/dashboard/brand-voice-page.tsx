"use client";

import { useState } from "react";

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action}
          </button>
        )}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function WordChip({ word, tone }: { word: string; tone: "use" | "avoid" }) {
  const styles =
    tone === "use"
      ? "bg-brand-50 text-brand-700 ring-brand-100"
      : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${styles}`}>
      {word}
    </span>
  );
}

function VoiceHero() {
  const sources = ["Website", "Google Profile", "Reviews"];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Voice Match Score
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <p className="text-5xl font-bold tracking-tight text-white sm:text-6xl">94%</p>
            <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-growth-500/15 px-3 py-1.5 text-sm font-semibold text-growth-500 ring-1 ring-emerald-400/20">
              Strong Match
            </span>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Last learned: <span className="font-medium text-slate-300">2 hours ago</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sources analyzed:
            </span>
            {sources.map((source) => (
              <span
                key={source}
                className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10"
              >
                {source}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="94 100"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-white">94%</p>
              <p className="text-xs font-medium text-slate-400">Match</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const toneOptions = [
  "More Professional",
  "More Friendly",
  "More Direct",
  "More Detailed",
  "Less Promotional",
];

export function BrandVoicePage() {
  const [selectedTones, setSelectedTones] = useState<string[]>(["More Friendly"]);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const personalities = [
    {
      title: "Professional",
      description: "Licensed, competent, and respectful in every message.",
    },
    {
      title: "Helpful",
      description: "Focuses on solving problems and educating customers.",
    },
    {
      title: "Local",
      description: "Speaks like a trusted neighbor who knows the community.",
    },
    {
      title: "Trustworthy",
      description: "Honest, transparent, and never overpromises.",
    },
    {
      title: "Fast Response",
      description: "Emphasizes availability and same-day service when relevant.",
    },
  ];

  const writingStyle = [
    { label: "Tone", value: "Friendly and professional" },
    { label: "Reading Level", value: "Easy to understand" },
    { label: "Sentence Style", value: "Short and clear" },
    { label: "Marketing Style", value: "Helpful, not pushy" },
    { label: "Call-To-Action Style", value: "Direct and practical" },
  ];

  const wordsToUse = [
    "fast service",
    "local experts",
    "trusted",
    "reliable",
    "emergency help",
    "family-owned",
    "professional",
  ];

  const wordsToAvoid = [
    "cheap",
    "guaranteed miracle",
    "best ever",
    "complicated jargon",
    "aggressive sales language",
  ];

  const samples = [
    {
      type: "Google Business Profile post",
      text: "Spring is a great time for a plumbing check-up. Our local team helps Danville homeowners catch small issues before they become costly repairs. Call Riverside Plumbing Co. today.",
      match: 96,
    },
    {
      type: "Review reply",
      text: "Thank you, Sarah! We're glad we could resolve your water heater issue quickly. We appreciate your trust and look forward to helping you again.",
      match: 94,
    },
    {
      type: "Facebook post",
      text: "Same-day service matters when a pipe bursts. Our licensed team is ready to help Danville families get back to normal — fast, honest, and local.",
      match: 92,
    },
    {
      type: "Blog intro",
      text: "Not sure if your water heater is on its last legs? Here are five signs Danville homeowners should watch for — and when to call a trusted local plumber.",
      match: 93,
    },
  ];

  const timeline = [
    { text: "Website scanned", tone: "blue" as const, time: "Jun 18, 2:00 PM" },
    { text: "Reviews analyzed", tone: "green" as const, time: "Jun 18, 2:15 PM" },
    { text: "Google profile reviewed", tone: "blue" as const, time: "Jun 18, 2:30 PM" },
    { text: "Voice profile created", tone: "green" as const, time: "Jun 18, 2:45 PM" },
    { text: "Customer preferences saved", tone: "amber" as const, time: "Jun 18, 3:00 PM" },
  ];

  function toggleTone(option: string) {
    setSelectedTones((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  function handleSaveNotes() {
    setNotesSaved(true);
    window.setTimeout(() => setNotesSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Brand Voice</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Review and refine how AJN AI writes for your business.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh Voice Profile
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Save Voice Settings
          </button>
        </div>
      </div>

      <VoiceHero />

      <SectionCard title="Brand Personality" subtitle="Core traits AJN AI uses when writing for you">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalities.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <h3 className="font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Writing Style" subtitle="How your content is structured and delivered">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {writingStyle.map((item) => (
            <article
              key={item.label}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-navy-900">{item.value}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Words To Use" subtitle="Language that matches your brand">
          <div className="flex flex-wrap gap-2">
            {wordsToUse.map((word) => (
              <WordChip key={word} word={word} tone="use" />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Words To Avoid" subtitle="Language AJN AI will filter out">
          <div className="flex flex-wrap gap-2">
            {wordsToAvoid.map((word) => (
              <WordChip key={word} word={word} tone="avoid" />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Sample AI Content" subtitle="Preview how AJN writes in your voice">
        <div className="grid gap-4 lg:grid-cols-2">
          {samples.map((sample) => (
            <article
              key={sample.type}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-navy-900">{sample.type}</h3>
                <span className="rounded-full bg-growth-50 px-2.5 py-1 text-[11px] font-semibold text-growth-500 ring-1 ring-emerald-100">
                  {sample.match}% match
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{sample.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  Approve Style
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Edit Tone
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Tone Adjustment" subtitle="Fine-tune how AJN AI sounds">
          <p className="mb-4 text-sm text-text-muted">
            Select preferences — AJN will apply these to future content drafts.
          </p>
          <div className="flex flex-wrap gap-2">
            {toneOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleTone(option)}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                  selectedTones.includes(option)
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Customer Voice Notes" subtitle="Help AJN understand your communication style">
          <label htmlFor="voice-notes" className="sr-only">
            Customer voice notes
          </label>
          <textarea
            id="voice-notes"
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything AJN should know about how your business communicates?"
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {notesSaved && (
            <p className="mt-3 text-sm font-medium text-growth-500">Notes saved on this device.</p>
          )}
          <button
            type="button"
            onClick={handleSaveNotes}
            className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Save Notes
          </button>
        </SectionCard>
      </div>

      <SectionCard title="AI Learning Timeline" subtitle="How your voice profile was built">
        <ol className="relative space-y-0">
          {timeline.map((item, index) => (
            <li key={item.text} className="relative flex gap-4 pb-6 last:pb-0">
              {index < timeline.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
                />
              )}
              <span
                className={`relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white ring-2 ${
                  item.tone === "green"
                    ? "bg-growth-500 ring-emerald-100"
                    : item.tone === "amber"
                      ? "bg-amber-500 ring-amber-100"
                      : "bg-brand-600 ring-brand-100"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">{item.text}</p>
                <p className="mt-1 text-xs text-text-muted">{item.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
