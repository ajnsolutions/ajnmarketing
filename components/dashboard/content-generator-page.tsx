"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWebsiteAnalysis } from "@/lib/website-analysis-client";
import { formatAnalysisStatus } from "@/lib/website-analysis/persistence";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

const contentTypes = [
  "Google Business Profile Post",
  "Facebook Post",
  "Instagram Caption",
  "LinkedIn Post",
  "Blog Article",
  "Review Reply",
  "Email Campaign",
];

const goalOptions = [
  "Get more calls",
  "Promote a service",
  "Respond to a review",
  "Educate customers",
  "Seasonal promotion",
  "Local event tie-in",
  "Build trust",
];

const defaultAiInputs = [
  { label: "Website Analysis", status: "Pending" },
  { label: "Brand Voice", status: "Pending" },
  { label: "Market Context", status: "Updated today" },
  { label: "Google Business Profile", status: "Connected" },
  { label: "Review Data", status: "128 reviews analyzed" },
];

const imageSuggestions = [
  "Before and after job photo",
  "Technician at work",
  "Seasonal service graphic",
  "Customer testimonial card",
];

const seoChecklist = [
  "Local keyword included",
  "Service area mentioned",
  "Clear call to action",
  "Google-friendly formatting",
  "Brand voice matched",
];

const safetyChecks = [
  "No exaggerated claims",
  "No unsupported guarantee",
  "No aggressive sales language",
  "Tone matches business",
  "Ready for review",
];

const historyRows = [
  {
    date: "Jun 18, 2026",
    type: "Google Business Profile Post",
    topic: "Spring maintenance reminder",
    status: "Awaiting Approval",
  },
  {
    date: "Jun 17, 2026",
    type: "Review Reply",
    topic: "5-star review from Sarah M.",
    status: "Approved",
  },
  {
    date: "Jun 16, 2026",
    type: "Facebook Post",
    topic: "Emergency plumbing availability",
    status: "Published",
  },
  {
    date: "Jun 15, 2026",
    type: "Blog Article",
    topic: "Water heater replacement signs",
    status: "Draft",
  },
];

function buildVariations(businessName: string, targetCity: string, topic: string) {
  return {
    "Google Business Profile Post": [
      {
        title: "Spring Check-Up Reminder",
        copy: `Spring is the perfect time for a ${topic.toLowerCase()} check-up. ${businessName} helps ${targetCity} homeowners catch small issues early. Call today for same-day service.`,
        channel: "Google Business Profile",
        performance: 88,
        voiceMatch: 96,
      },
      {
        title: "Local Expert Tip",
        copy: `Did you know proactive ${topic.toLowerCase()} can prevent costly problems? Our local team is here to help ${targetCity} families stay ahead.`,
        channel: "Google Business Profile",
        performance: 84,
        voiceMatch: 94,
      },
      {
        title: "Trusted Local Service",
        copy: `When you need a team you can trust, ${businessName} is ready to help. Licensed, local, and available for ${topic.toLowerCase()} across ${targetCity} and nearby communities.`,
        channel: "Google Business Profile",
        performance: 86,
        voiceMatch: 95,
      },
    ],
    default: [
      {
        title: "Service Spotlight",
        copy: `Need reliable ${topic.toLowerCase()} in ${targetCity}? ${businessName} delivers fast, professional service for repairs, maintenance, and emergencies. Call our local team today.`,
        channel: "Multi-channel",
        performance: 85,
        voiceMatch: 94,
      },
      {
        title: "Helpful Local Tip",
        copy: `Small ${topic.toLowerCase()} issues can turn into big expenses. Our team helps ${targetCity} homeowners stay ahead with honest recommendations and clear pricing.`,
        channel: "Multi-channel",
        performance: 82,
        voiceMatch: 93,
      },
      {
        title: "Trust-First Message",
        copy: `Family-owned and locally trusted, ${businessName} is here when you need us most. Same-day ${topic.toLowerCase()} available for ${targetCity} and nearby communities.`,
        channel: "Multi-channel",
        performance: 87,
        voiceMatch: 95,
      },
    ],
  };
}

export function ContentGeneratorPage() {
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [contentType, setContentType] = useState(contentTypes[0]);
  const [goals, setGoals] = useState<string[]>(["Promote a service"]);
  const [topic, setTopic] = useState("Water heater repair");
  const [targetCity, setTargetCity] = useState("Danville");
  const [tone, setTone] = useState("Friendly and professional");
  const [specialOffer, setSpecialOffer] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);

  useEffect(() => {
    async function loadAnalysis() {
      const { analysis: savedAnalysis } = await fetchWebsiteAnalysis();
      if (!savedAnalysis) return;

      setAnalysis(savedAnalysis);

      const firstService =
        savedAnalysis.services?.[0]?.name ??
        savedAnalysis.raw_summary?.primaryServices[0] ??
        topic;
      const firstCity =
        savedAnalysis.cities?.[0] ?? savedAnalysis.raw_summary?.citiesMentioned[0] ?? targetCity;
      const analysisTone =
        savedAnalysis.tone ??
        savedAnalysis.brand_voice ??
        savedAnalysis.raw_summary?.tone ??
        tone;

      setTopic(firstService);
      setTargetCity(firstCity);
      setTone(analysisTone);
    }

    void loadAnalysis();
  }, []);

  const businessName =
    analysis?.raw_summary?.businessName ?? "Your Business";
  const aiInputs = defaultAiInputs.map((item) => {
    if (item.label === "Website Analysis") {
      return {
        ...item,
        status:
          analysis?.analysis_status === "completed"
            ? "Active"
            : formatAnalysisStatus(analysis?.analysis_status),
      };
    }

    if (item.label === "Brand Voice") {
      return {
        ...item,
        status: analysis?.brand_voice ? "Strong Match" : "Pending",
      };
    }

    return item;
  });

  const variationsByType = buildVariations(businessName, targetCity, topic);
  const variations =
    variationsByType[contentType as keyof typeof variationsByType] ?? variationsByType.default;

  function toggleGoal(goal: string) {
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]
    );
  }

  function handleGenerate() {
    setGenerating(true);
    window.setTimeout(() => {
      setGenerationKey((current) => current + 1);
      setGenerating(false);
    }, 900);
  }

  function handleSaveDraft() {
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link
            href="/dashboard/content"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← Back to Content
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            AI Content Generator
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Generate ready-to-review marketing content using your business profile, brand voice,
            and local market context.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate Content"}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Save Draft
          </button>
        </div>
      </div>

      {draftSaved && (
        <p className="rounded-xl border border-emerald-200 bg-growth-50 px-4 py-3 text-sm font-medium text-growth-600">
          Draft saved on this device.
        </p>
      )}

      <SectionCard title="Content Type" subtitle="Choose what you want AJN AI to create">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {contentTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setContentType(type)}
              className={`rounded-xl border p-4 text-left text-sm font-semibold ring-1 transition-colors ${
                contentType === type
                  ? "border-brand-200 bg-brand-50/50 text-brand-700 ring-brand-100"
                  : "border-slate-100 bg-[#F8FAFC] text-navy-900 ring-slate-200/60 hover:border-brand-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Content Goal" subtitle="Tell AJN what this content should accomplish">
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => toggleGoal(goal)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-colors ${
                goals.includes(goal)
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="AI Inputs" subtitle="What AJN is using to generate content" className="xl:col-span-1">
          <ul className="space-y-3">
            {aiInputs.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
              >
                <span className="text-sm font-medium text-navy-900">{item.label}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-growth-500">
                  <span className="h-2 w-2 rounded-full bg-growth-500" />
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Prompt Builder" subtitle="Guide the AI with a few simple inputs" className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-navy-900">Topic or service</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-navy-900">Target city</span>
              <input
                value={targetCity}
                onChange={(event) => setTargetCity(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-navy-900">Tone</span>
              <input
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-navy-900">Special offer or note</span>
              <input
                value={specialOffer}
                onChange={(event) => setSpecialOffer(event.target.value)}
                placeholder="Optional — e.g. Same-day service available"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-navy-900">Optional instructions</span>
              <textarea
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Anything else AJN should include or avoid?"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Generated Content Preview" subtitle="Three variations ready for review">
        <div className="grid gap-4 lg:grid-cols-3" key={generationKey}>
          {variations.map((variation, index) => (
            <article
              key={`${variation.title}-${index}`}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-navy-900">{variation.title}</h3>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                  V{index + 1}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{variation.copy}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {variation.channel}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
                  Performance: {variation.performance}
                </span>
                <span className="rounded-full bg-growth-50 px-2.5 py-1 text-xs font-semibold text-growth-500 ring-1 ring-emerald-100">
                  Voice match: {variation.voiceMatch}%
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  Send to Approval Center
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Image & Creative Suggestions" subtitle="Visual ideas to pair with this content">
          <div className="grid gap-3 sm:grid-cols-2">
            {imageSuggestions.map((idea) => (
              <div
                key={idea}
                className="flex flex-col rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex h-24 items-center justify-center rounded-lg bg-white text-xs font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-100">
                  Image placeholder
                </div>
                <p className="mt-3 text-sm font-medium text-navy-900">{idea}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="SEO & Local Optimization" subtitle="On-page checks for local visibility">
          <ul className="space-y-3">
            {seoChecklist.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-navy-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-growth-500 ring-1 ring-emerald-100">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="AI Safety & Quality Review" subtitle="Automatic checks before approval">
          <ul className="space-y-3">
            {safetyChecks.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-navy-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-growth-500 ring-1 ring-emerald-100">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Generation History" subtitle="Recent AI content created for your business">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="pb-3 pr-4 font-semibold">Date</th>
                <th className="pb-3 pr-4 font-semibold">Content Type</th>
                <th className="pb-3 pr-4 font-semibold">Topic</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={`${row.date}-${row.topic}`} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 pr-4 font-medium text-navy-900">{row.date}</td>
                  <td className="py-4 pr-4 text-slate-600">{row.type}</td>
                  <td className="py-4 pr-4 text-slate-600">{row.topic}</td>
                  <td className="py-4 pr-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                        row.status === "Published"
                          ? "bg-growth-50 text-growth-500 ring-emerald-100"
                          : row.status === "Approved"
                            ? "bg-brand-50 text-brand-600 ring-brand-100"
                            : row.status === "Draft"
                              ? "bg-slate-100 text-slate-600 ring-slate-200"
                              : "bg-amber-50 text-amber-700 ring-amber-100"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
