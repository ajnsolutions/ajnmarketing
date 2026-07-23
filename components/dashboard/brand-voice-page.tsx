"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BusinessProfile } from "@/lib/business-profile";
import { displayValue, parseWordList } from "@/lib/business-profile";
import { fetchBusinessProfile, upsertBusinessProfile } from "@/lib/business-profile-client";
import { fetchWebsiteAnalysis } from "@/lib/website-analysis-client";
import { formatRelativeTime } from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { matchScoreLabel } from "@/lib/brand-voice/matchScoreLabel";

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

function VoiceHero({
  matchScore,
  lastLearned,
  hasWebsiteAnalysis,
}: {
  matchScore: number | null;
  lastLearned: string;
  hasWebsiteAnalysis: boolean;
}) {
  const score = matchScore ?? 0;
  const scoreLabel = matchScoreLabel(matchScore);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Voice Match Score
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <p className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              {matchScore != null ? `${matchScore}%` : "—"}
            </p>
            <span
              className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${scoreLabel.tone}`}
            >
              {scoreLabel.label}
            </span>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Last learned: <span className="font-medium text-slate-300">{lastLearned}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sources analyzed:
            </span>
            {hasWebsiteAnalysis ? (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                Website
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-500">
                None yet — add a website or share notes below.
              </span>
            )}
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
                strokeDasharray={`${score} 100`}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-white">{matchScore ?? "—"}</p>
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
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [selectedTones, setSelectedTones] = useState<string[]>(["More Friendly"]);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const [{ profile: savedProfile }, { analysis: savedAnalysis }] = await Promise.all([
        fetchBusinessProfile(),
        fetchWebsiteAnalysis(),
      ]);

      if (savedProfile) {
        setProfile(savedProfile);
        setNotes(savedProfile.voice_notes ?? "");
        // Restore a previously saved tone selection so the checklist reflects real
        // state on return visits, rather than always resetting to the default.
        const savedTones = (savedProfile.brand_voice_tone ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => toneOptions.includes(t));
        if (savedTones.length > 0) {
          setSelectedTones(savedTones);
        }
      }

      if (savedAnalysis) {
        setAnalysis(savedAnalysis);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  const businessName = displayValue(
    analysis?.raw_summary?.businessName ?? profile?.business_name,
    "your business"
  );
  const tone = displayValue(
    analysis?.tone ?? analysis?.raw_summary?.tone ?? profile?.brand_voice_tone,
    "Friendly and professional"
  );
  const wordsToUse = analysis?.keywords?.length
    ? analysis.keywords
    : parseWordList(profile?.preferred_words, [
        "fast service",
        "local experts",
        "trusted",
        "reliable",
        "dependable",
        "family-owned",
        "professional",
      ]);
  const wordsToAvoid = parseWordList(profile?.avoid_words, [
    "cheap",
    "guaranteed miracle",
    "best ever",
    "complicated jargon",
    "aggressive sales language",
  ]);
  const exampleParagraph =
    analysis?.brand_voice ??
    analysis?.raw_summary?.brandVoice ??
    profile?.voice_notes?.trim() ??
    "We are a local team focused on honest service, fast response, and building long-term trust in our community.";

  const writingStyle = [
    { label: "Tone", value: tone },
    {
      label: "Reading Level",
      value: displayValue(analysis?.raw_summary?.readingLevel, "Easy to understand"),
    },
    { label: "Sentence Style", value: "Short and clear" },
    { label: "Marketing Style", value: "Helpful, not pushy" },
    { label: "Call-To-Action Style", value: "Direct and practical" },
  ];

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

  const samples = [
    {
      type: "Google Business Profile post",
      text: `Spring is a great time for a check-up. ${businessName} helps customers catch small issues early. Contact us today to schedule service.`,
      match: 96,
    },
    {
      type: "Review reply",
      text: "Thank you, Sarah! We're glad we could resolve your issue quickly. We appreciate your trust and look forward to helping you again.",
      match: 94,
    },
    {
      type: "Facebook post",
      text: `Same-day service matters when you need help fast. ${businessName} is ready to serve your community with fast, honest, and professional support.`,
      match: 92,
    },
    {
      type: "Blog intro",
      text: `Not sure if it's time for a replacement? Here are five signs customers should watch for — and when to contact ${businessName}.`,
      match: 93,
    },
  ];

  function toggleTone(option: string) {
    setSelectedTones((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  function handleSaveNotes() {
    if (!profile) {
      setNotesSaved(true);
      window.setTimeout(() => setNotesSaved(false), 3000);
      return;
    }

    // [RC-1 fix] Tone selection previously only lived in local component state —
    // "AJN will apply these to future content drafts" was not true. Persist the
    // selection to the real brand_voice_tone field alongside notes.
    void upsertBusinessProfile({
      ...profile,
      voice_notes: notes || null,
      brand_voice_tone: selectedTones.length > 0 ? selectedTones.join(", ") : null,
    }).then(({ error }) => {
      if (!error) {
        setNotesSaved(true);
        window.setTimeout(() => setNotesSaved(false), 3000);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-text-muted">Loading brand voice profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Brand Voice</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Guides how drafts sound before you approve them. It does not publish, approve, or change
            strategy on its own. A short tone note is enough to start — you can refine later.
          </p>
          <p className="mt-2 text-sm">
            <Link
              href="/dashboard/setup"
              className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
            >
              ← Back to setup checklist
            </Link>
          </p>
        </div>
      </div>

      <VoiceHero
        matchScore={analysis?.analysis_score ?? null}
        lastLearned={formatRelativeTime(analysis?.updated_at ?? analysis?.created_at)}
        hasWebsiteAnalysis={Boolean(analysis)}
      />

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
        <blockquote className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Example from your business profile
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">&ldquo;{exampleParagraph}&rdquo;</p>
        </blockquote>
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

      <SectionCard
        title="Example Drafts"
        subtitle="Illustrative examples of the tone AJN AI aims for — not this business's actual generated content"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {samples.map((sample) => (
            <article
              key={sample.type}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-navy-900">{sample.type}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  Example
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{sample.text}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Tone Adjustment" subtitle="Fine-tune how AJN AI sounds">
          <p className="mb-4 text-sm text-text-muted">
            Select preferences, then save with the notes below — I&apos;ll use these for future
            content drafts.
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
            <p role="status" className="mt-3 text-sm font-medium text-growth-500">
              Voice preferences saved to your business profile.
            </p>
          )}
          <button
            type="button"
            onClick={handleSaveNotes}
            className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Save Voice Preferences
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
