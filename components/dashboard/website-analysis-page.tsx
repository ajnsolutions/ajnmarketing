import type { BusinessProfile } from "@/lib/business-profile";
import {
  displayValue,
  formatServiceAreas,
  formatWebsiteDisplay,
} from "@/lib/business-profile";
import {
  WebsiteAnalysisPoller,
  WebsiteAnalysisRefreshButton,
} from "@/components/dashboard/website-analysis-actions";
import { WebsiteNoWebsiteAction } from "@/components/dashboard/website-no-website-action";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import { hasNoWebsiteConfirmed } from "@/lib/onboarding-storage";
import { getAnalysisDisplayMeta } from "@/lib/website-analysis-server";
import { LOW_CONFIDENCE_CUSTOMER_PERSONA } from "@/lib/website-analysis/customer-persona";
import { resolveContentOpportunities } from "@/lib/website-analysis/content-opportunities";
import type { SeoFinding, WebsiteAnalysis } from "@/lib/website-analysis/types";
import Link from "next/link";

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

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-rose-50 text-rose-600 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
    Low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {priority} Priority
    </span>
  );
}

function SeoStatusBadge({ status }: { status: "good" | "warning" | "poor" }) {
  const styles = {
    good: "bg-growth-50 text-growth-500 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    poor: "bg-rose-50 text-rose-600 ring-rose-100",
  }[status];

  const labels = {
    good: "Good",
    warning: "Needs Work",
    poor: "Critical",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {labels[status]}
    </span>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-navy-900">{value}</p>
    </article>
  );
}

function StatusBadge({
  statusLabel,
  variant,
}: {
  statusLabel: string;
  variant: "completed" | "running" | "failed" | "idle";
}) {
  const styles = {
    completed: "bg-growth-500/15 text-growth-500 ring-emerald-400/20",
    running: "bg-brand-500/15 text-brand-300 ring-brand-400/20",
    failed: "bg-rose-500/15 text-rose-300 ring-rose-400/20",
    idle: "bg-white/10 text-slate-300 ring-white/10",
  }[variant];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${styles}`}>
      {variant === "running" && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-300" aria-hidden="true" />
      )}
      {statusLabel}
    </span>
  );
}

function AnalysisHero({
  score,
  seoScore,
  statusLabel,
  lastAnalyzed,
  variant,
}: {
  score: number | null;
  seoScore: number | null;
  statusLabel: string;
  lastAnalyzed: string;
  variant: "completed" | "running" | "failed" | "idle";
}) {
  const displayScore = score ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Analysis Status
            </p>
            <StatusBadge statusLabel={statusLabel} variant={variant} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Overall Website Score
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {score ?? "—"}
                {score !== null && (
                  <span className="text-xl font-semibold text-slate-400"> / 100</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                SEO Score
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {seoScore ?? "—"}
                {seoScore !== null && (
                  <span className="text-xl font-semibold text-slate-400"> / 100</span>
                )}
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            Last scanned: <span className="font-medium text-slate-300">{lastAnalyzed}</span>
          </p>
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
                stroke={variant === "failed" ? "#F87171" : variant === "running" ? "#60A5FA" : "#22C55E"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${displayScore} 100`}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-white">{score ?? "—"}</p>
              <p className="text-xs font-medium text-slate-400">Score</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyzingState() {
  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-50/40 p-8 text-center ring-1 ring-brand-100">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand-600" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-navy-900">Analyzing your website...</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-text-muted">
        We&apos;re scanning your site, extracting services, local signals, and brand voice to build
        your AI marketing profile.
      </p>
    </section>
  );
}

function buildOpportunities(extraction: WebsiteAnalysis["raw_summary"]) {
  if (!extraction) return [];

  return extraction.highestRoiImprovements.map((title, index) => ({
    title,
    priority: (index === 0 ? "High" : "Medium") as "High" | "Medium",
    impact: extraction.seoIssues[index] ?? "Improves local search visibility",
    difficulty: index === 0 ? "Low effort" : "Medium effort",
  }));
}

export function WebsiteAnalysisPage({
  profile,
  analysis,
}: {
  profile: BusinessProfile | null;
  analysis: WebsiteAnalysis | null;
}) {
  const meta = getAnalysisDisplayMeta(analysis);
  const extraction = analysis?.raw_summary ?? null;
  const isAnalyzing = meta.isAnalyzing;
  const isComplete = meta.isComplete && !!extraction;

  const businessName = displayValue(extraction?.businessName ?? profile?.business_name, "Your Business");
  const industry = displayValue(extraction?.industry ?? profile?.industry, "Local Service Business");
  const website = formatWebsiteDisplay(analysis?.website ?? profile?.website ?? null);
  const phone = displayValue(extraction?.phoneNumbers[0] ?? profile?.phone);
  const serviceAreas = extraction?.serviceAreas.length
    ? extraction.serviceAreas.join(" · ")
    : formatServiceAreas(profile);
  const primaryServices = extraction?.primaryServices.length
    ? extraction.primaryServices.join(", ")
    : displayValue(profile?.primary_services, "Services will appear here after analysis");
  const tone = displayValue(analysis?.tone ?? extraction?.tone ?? profile?.brand_voice_tone);
  const preferredWords = extraction?.keywords.length
    ? extraction.keywords.join(", ")
    : displayValue(profile?.preferred_words, "Trusted, local, fast, licensed, family-owned");
  const avoidWords = displayValue(profile?.avoid_words, "Cheap, discount, lowest price");
  const exampleParagraph =
    analysis?.brand_voice ??
    extraction?.brandVoice ??
    profile?.voice_notes?.trim() ??
    `For years, ${businessName} has been a trusted local choice for honest, professional service.`;
  const customerPersona = displayValue(
    meta.isComplete ? analysis?.raw_summary?.customerPersona : undefined,
    LOW_CONFIDENCE_CUSTOMER_PERSONA
  );
  const businessHours = extraction?.businessHours.length
    ? extraction.businessHours.join(" · ")
    : "Hours not detected yet";
  const primaryCta = extraction?.callsToAction[0] ?? "Contact us for service";

  const seoItems: SeoFinding[] =
    analysis?.seo_findings ??
    [
      { label: "Meta Titles", status: "warning", detail: "Waiting for analysis" },
      { label: "Meta Descriptions", status: "warning", detail: "Waiting for analysis" },
    ];

  const services = analysis?.services ?? [];
  const websiteOpportunities = buildOpportunities(extraction);
  const contentIdeas = meta.isComplete ? resolveContentOpportunities(extraction) : [];

  const heroVariant = meta.isFailed
    ? "failed"
    : isAnalyzing
      ? "running"
      : isComplete
        ? "completed"
        : "idle";

  return (
    <div className="space-y-8">
      <WebsiteAnalysisPoller shouldPoll={isAnalyzing} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Website Analysis
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            {isAnalyzing
              ? "We're learning everything we can from your website to power AJN AI across the platform."
              : "Optional setup — a website helps me learn your services, but you can continue without one."}
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
        <div className="flex flex-wrap gap-3">
          <WebsiteAnalysisRefreshButton />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            View AI Profile
          </button>
        </div>
      </div>

      <AnalysisHero
        score={analysis?.analysis_score ?? null}
        seoScore={analysis?.seo_score ?? null}
        statusLabel={meta.statusLabel}
        lastAnalyzed={meta.lastAnalyzed}
        variant={heroVariant}
      />

      {!profile?.website?.trim() && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <h2 className="text-base font-bold text-navy-900">No website?</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            That is fine. Website analysis is optional and does not block Head of Marketing.
          </p>
          <div className="mt-4">
            <WebsiteNoWebsiteAction
              initiallyConfirmed={hasNoWebsiteConfirmed(profile?.voice_notes)}
            />
          </div>
        </section>
      )}

      {isAnalyzing && <AnalyzingState />}

      {meta.isFailed && (
        <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 ring-1 ring-rose-100">
          <h2 className="text-lg font-bold text-navy-900">Analysis could not be completed</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            We couldn&apos;t finish scanning your website. Check that your URL is correct, then try
            refreshing. Other setup steps and Head of Marketing can continue while this is unresolved.
          </p>
          <div className="mt-4">
            <WebsiteAnalysisRefreshButton />
          </div>
        </section>
      )}

      {!isAnalyzing && !isComplete && !meta.isFailed && (
        <DashboardEmptyState
          title="No website analysis yet"
          description="Click Refresh Analysis above to scan your website and generate marketing insights."
        />
      )}

      {!isAnalyzing && isComplete && (
        <>
          <SectionCard
            title="Business Profile Learned"
            subtitle="Key details extracted from your website"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Business Name" value={businessName} />
              <ProfileField label="Industry" value={industry} />
              <ProfileField label="Primary Services" value={primaryServices} />
              <ProfileField label="Service Areas" value={serviceAreas} />
              <ProfileField label="Business Hours" value={businessHours} />
              <ProfileField label="Phone" value={phone} />
              <ProfileField label="Website" value={website} />
              <ProfileField label="Primary Call-To-Action" value={primaryCta} />
              {extraction?.pageCountEstimate ? (
                <ProfileField
                  label="Page Count Estimate"
                  value={`~${extraction.pageCountEstimate} pages`}
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="AI Brand Voice" subtitle="How your website communicates with customers">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Writing Tone" value={tone} />
              <ProfileField
                label="Reading Level"
                value={displayValue(extraction?.readingLevel, "Pending analysis")}
              />
              <ProfileField
                label="Customer Persona"
                value={customerPersona}
              />
              <ProfileField
                label="Value Proposition"
                value={displayValue(extraction?.valueProposition, "Pending analysis")}
              />
              <ProfileField label="Words Frequently Used" value={preferredWords} />
              <ProfileField label="Words Avoided" value={avoidWords} />
            </div>
            <blockquote className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Example extracted from website
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">&ldquo;{exampleParagraph}&rdquo;</p>
            </blockquote>
          </SectionCard>

          <SectionCard title="SEO Snapshot" subtitle="Technical and on-page SEO health">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {seoItems.map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-navy-900">{item.label}</p>
                    <SeoStatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{item.detail}</p>
                </article>
              ))}
            </div>
          </SectionCard>

          {services.length > 0 && (
            <SectionCard title="Service Detection" subtitle="Services identified from your website content">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <article
                    key={service.name}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                  >
                    <h3 className="font-semibold text-navy-900">{service.name}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
                        {service.confidence}% confidence
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          service.opportunity === "High"
                            ? "bg-growth-50 text-growth-500 ring-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-100"
                        }`}
                      >
                        {service.opportunity} opportunity
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          )}

          {websiteOpportunities.length > 0 && (
            <SectionCard
              title="Website Opportunities"
              subtitle="Priority improvements ranked by estimated ROI"
              action="View all"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {websiteOpportunities.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-semibold text-navy-900">{item.title}</h3>
                      <PriorityBadge priority={item.priority} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-growth-50 px-3 py-1 font-medium text-growth-600 ring-1 ring-emerald-100">
                        {item.impact}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                        {item.difficulty}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          )}

          {contentIdeas.length > 0 && (
            <SectionCard title="Content Opportunities" subtitle="Article ideas based on your services and market">
              <div className="grid gap-4 lg:grid-cols-2">
                {contentIdeas.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
                  >
                    <h3 className="font-semibold text-navy-900">{item.title}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-600 ring-1 ring-brand-100">
                        SEO Score: {item.seoScore}
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                        Competition: {item.competition}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          )}

          {extraction && (
            <SectionCard title="AI Summary" subtitle="Executive overview of your website analysis">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                    What the AI learned
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{extraction.executiveSummary}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-growth-50/50 p-4 ring-1 ring-emerald-100">
                    <h3 className="font-semibold text-growth-600">Strengths</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {extraction.strengths.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 ring-1 ring-amber-100">
                    <h3 className="font-semibold text-amber-700">Weaknesses</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {(extraction.weaknesses.length ? extraction.weaknesses : extraction.seoIssues).map(
                        (item) => (
                          <li key={item}>• {item}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                    Highest ROI improvements
                  </h3>
                  <ol className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                    {extraction.highestRoiImprovements.map((item, index) => (
                      <li key={item}>
                        {index + 1}. {item}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-5 ring-1 ring-brand-100">
                  <h3 className="font-semibold text-navy-900">Next recommended actions</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {extraction.nextRecommendedActions}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
