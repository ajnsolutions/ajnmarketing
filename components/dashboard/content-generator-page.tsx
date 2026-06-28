"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createContentApprovalRequest,
  fetchContentApprovals,
} from "@/lib/content-approval-client";
import { generateContent } from "@/lib/content-generator-client";
import {
  CONTENT_TYPE_OPTIONS,
  type ContentLength,
  type ContentTone,
  type GeneratedContentVariation,
} from "@/lib/content-generator/types";
import { fetchWebsiteAnalysis } from "@/lib/website-analysis-client";
import { fetchAiMarketingProfile } from "@/lib/ai-marketing-profile-client";
import { formatAnalysisStatus } from "@/lib/website-analysis/persistence";
import { formatProfileStatus } from "@/lib/ai-marketing-profile/persistence";
import type { ContentApproval } from "@/lib/content-approval/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";

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

const goalOptions = [
  "Get more calls",
  "Promote a service",
  "Respond to a review",
  "Educate customers",
  "Seasonal promotion",
  "Local event tie-in",
  "Build trust",
];

const lengthOptions: ContentLength[] = ["Short", "Medium", "Long"];

const toneOptions: ContentTone[] = ["Professional", "Friendly", "Educational", "Promotional"];

const defaultAiInputs = [
  { label: "Website Analysis", status: "Pending" },
  { label: "Brand Voice", status: "Pending" },
  { label: "AI Marketing Profile", status: "Pending" },
  { label: "Market Context", status: "Updated today" },
  { label: "Google Business Profile", status: "Connected" },
  { label: "Review Data", status: "128 reviews analyzed" },
];

function mapToneToOption(rawTone: string | null | undefined): ContentTone {
  const normalized = rawTone?.trim().toLowerCase() ?? "";
  if (normalized.includes("promo")) return "Promotional";
  if (normalized.includes("educat")) return "Educational";
  if (normalized.includes("friend")) return "Friendly";
  return "Professional";
}

function formatApprovalStatus(status: ContentApproval["status"]): string {
  switch (status) {
    case "pending":
      return "Awaiting Approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "published":
      return "Published";
    default:
      return status;
  }
}

function formatHistoryDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContentGeneratorPage() {
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [aiProfile, setAiProfile] = useState<AiMarketingProfile | null>(null);
  const [contentType, setContentType] = useState<string>(CONTENT_TYPE_OPTIONS[0]);
  const [goals, setGoals] = useState<string[]>(["Promote a service"]);
  const [topic, setTopic] = useState("");
  const [targetArea, setTargetArea] = useState("");
  const [length, setLength] = useState<ContentLength>("Medium");
  const [tone, setTone] = useState<ContentTone>("Professional");
  const [specialOffer, setSpecialOffer] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [variations, setVariations] = useState<GeneratedContentVariation[]>([]);
  const [approvalToast, setApprovalToast] = useState<string | null>(null);
  const [sendingApprovalIndex, setSendingApprovalIndex] = useState<number | null>(null);
  const [historyRows, setHistoryRows] = useState<ContentApproval[]>([]);

  useEffect(() => {
    async function loadData() {
      const [{ analysis: savedAnalysis }, { profile: savedAiProfile }, { approvals }] =
        await Promise.all([
          fetchWebsiteAnalysis(),
          fetchAiMarketingProfile(),
          fetchContentApprovals(),
        ]);

      if (savedAnalysis) {
        setAnalysis(savedAnalysis);

        const firstService =
          savedAnalysis.services?.[0]?.name ??
          savedAnalysis.raw_summary?.primaryServices?.[0] ??
          savedAiProfile?.services?.[0] ??
          "";
        const firstArea =
          savedAnalysis.cities?.[0] ??
          savedAnalysis.raw_summary?.citiesMentioned?.[0] ??
          savedAiProfile?.service_areas?.[0] ??
          "";
        const analysisTone =
          savedAiProfile?.tone ??
          savedAnalysis.tone ??
          savedAnalysis.brand_voice ??
          savedAnalysis.raw_summary?.tone ??
          "";

        setTopic(firstService);
        setTargetArea(firstArea);
        setTone(mapToneToOption(analysisTone));
      }

      if (savedAiProfile) {
        setAiProfile(savedAiProfile);
      }

      setHistoryRows(
        approvals
          .filter((item) => item.source === "content_generator")
          .slice(0, 8)
      );
    }

    void loadData();
  }, []);

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
        status: analysis?.brand_voice || aiProfile?.brand_voice ? "Strong Match" : "Pending",
      };
    }

    if (item.label === "AI Marketing Profile") {
      return {
        ...item,
        status:
          aiProfile?.profile_status === "active"
            ? "Active"
            : formatProfileStatus(aiProfile?.profile_status),
      };
    }

    return item;
  });

  function toggleGoal(goal: string) {
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerationError(null);

    const { result, error } = await generateContent({
      contentType,
      topic: topic.trim() || undefined,
      targetArea: targetArea.trim() || undefined,
      length,
      tone,
      goals,
      specialOffer: specialOffer.trim() || undefined,
      instructions: instructions.trim() || undefined,
    });

    setGenerating(false);

    if (error || !result?.variations?.length) {
      setVariations([]);
      setGenerationError(
        error ??
          "We couldn't generate content right now. Check your OpenAI configuration and try again."
      );
      return;
    }

    setVariations(result.variations);
  }

  async function handleSendToApproval(variationIndex: number) {
    const variation = variations[variationIndex];
    if (!variation) return;

    setSendingApprovalIndex(variationIndex);

    const { error } = await createContentApprovalRequest({
      content_type: contentType,
      title: variation.title,
      content: variation.content,
      source: "content_generator",
      ai_score: variation.voiceScore,
    });

    setSendingApprovalIndex(null);

    if (error) {
      setApprovalToast(error);
    } else {
      setApprovalToast("Content sent for approval.");
      const { approvals } = await fetchContentApprovals();
      setHistoryRows(
        approvals
          .filter((item) => item.source === "content_generator")
          .slice(0, 8)
      );
    }

    window.setTimeout(() => setApprovalToast(null), 3000);
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
            Generate ready-to-review marketing content from your AI Marketing Profile, website
            analysis, brand voice, and business profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate Content"}
          </button>
        </div>
      </div>

      {approvalToast && (
        <p className="rounded-xl border border-emerald-200 bg-growth-50 px-4 py-3 text-sm font-medium text-growth-600">
          {approvalToast}
        </p>
      )}

      {generationError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {generationError}
        </p>
      )}

      <SectionCard title="Content Type" subtitle="Choose what you want AJN AI to create">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONTENT_TYPE_OPTIONS.map((type) => (
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
                placeholder="Uses your profile services when left blank"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-navy-900">Target area</span>
              <input
                value={targetArea}
                onChange={(event) => setTargetArea(event.target.value)}
                placeholder="Uses your service areas when left blank"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-navy-900">Length</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {lengthOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLength(option)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                      length === option
                        ? "bg-brand-600 text-white ring-brand-600"
                        : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-navy-900">Tone</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {toneOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTone(option)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                      tone === option
                        ? "bg-brand-600 text-white ring-brand-600"
                        : "border border-slate-200 bg-white text-navy-900 ring-slate-200 hover:border-brand-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-navy-900">Special offer or note</span>
              <input
                value={specialOffer}
                onChange={(event) => setSpecialOffer(event.target.value)}
                placeholder="Optional"
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

      <SectionCard
        title="Generated Content Preview"
        subtitle="Three AI variations — Educational, Trust / Authority, and Promotion / Engagement"
      >
        {variations.length === 0 ? (
          <p className="text-sm leading-7 text-text-muted">
            {generating
              ? "Generating three unique variations from your business intelligence..."
              : "Click Generate Content to create three unique variations from your business profile."}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {variations.map((variation, index) => (
              <article
                key={`${variation.style}-${variation.title}-${index}`}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-navy-900">{variation.title}</h3>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                    V{index + 1}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {variation.style}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {variation.content}
                </p>
                {variation.cta && (
                  <p className="mt-3 text-sm font-semibold text-navy-900">CTA: {variation.cta}</p>
                )}
                {variation.hashtags.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Hashtags: {variation.hashtags.join(" ")}
                  </p>
                )}
                {variation.seoKeywords.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    SEO keywords: {variation.seoKeywords.join(", ")}
                  </p>
                )}
                {variation.reasoning && (
                  <p className="mt-3 text-xs leading-6 text-text-muted">{variation.reasoning}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
                    Quality Score: {variation.qualityScore}
                  </span>
                  <span className="rounded-full bg-growth-50 px-2.5 py-1 text-xs font-semibold text-growth-500 ring-1 ring-emerald-100">
                    Voice Match: {variation.voiceScore}%
                  </span>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={sendingApprovalIndex === index}
                    onClick={() => void handleSendToApproval(index)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                  >
                    {sendingApprovalIndex === index ? "Sending..." : "Send to Approval Center"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Generation History" subtitle="Recent content sent from the generator">
        {historyRows.length === 0 ? (
          <p className="text-sm text-text-muted">No generated content has been sent for approval yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="pb-3 pr-4 font-semibold">Date</th>
                  <th className="pb-3 pr-4 font-semibold">Content Type</th>
                  <th className="pb-3 pr-4 font-semibold">Title</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4 pr-4 font-medium text-navy-900">
                      {formatHistoryDate(row.created_at)}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{row.content_type}</td>
                    <td className="py-4 pr-4 text-slate-600">{row.title}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                          row.status === "published"
                            ? "bg-growth-50 text-growth-500 ring-emerald-100"
                            : row.status === "approved"
                              ? "bg-brand-50 text-brand-600 ring-brand-100"
                              : row.status === "rejected"
                                ? "bg-red-50 text-red-600 ring-red-100"
                                : "bg-amber-50 text-amber-700 ring-amber-100"
                        }`}
                      >
                        {formatApprovalStatus(row.status)}
                      </span>
                    </td>
                    <td className="py-4">
                      <Link
                        href="/dashboard/approvals"
                        className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
