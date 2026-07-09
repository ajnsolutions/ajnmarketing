import {
  formatAiMarketingProfileFailure,
  formatProfileStatus,
  formatRelativeTime,
} from "@/lib/ai-marketing-profile/persistence";
import type { AiMarketingProfile } from "@/lib/ai-marketing-profile/types";
import { AiMarketingProfileRefreshButton } from "@/components/dashboard/ai-marketing-profile-actions";

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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-navy-900">{value}</p>
    </article>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-3 text-sm leading-7 text-slate-600">{value}</p>
    </article>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Not available yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-100"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Active"
      ? "bg-growth-500/15 text-growth-500 ring-emerald-400/20"
      : status === "Failed"
        ? "bg-rose-500/15 text-rose-300 ring-rose-400/20"
        : status === "Generating"
          ? "bg-brand-500/15 text-brand-300 ring-brand-400/20"
          : "bg-white/10 text-slate-300 ring-white/10";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

function ProfileHero({ profile }: { profile: AiMarketingProfile | null }) {
  const statusLabel = formatProfileStatus(profile?.profile_status);
  const lastUpdated = formatRelativeTime(profile?.updated_at ?? profile?.created_at);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            AI Marketing Brain
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Centralized Strategy Profile
            </h2>
            <StatusBadge status={statusLabel} />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            One reusable knowledge base combining onboarding preferences, website analysis, brand voice,
            services, audience insights, and channel strategies for all AJN AI features.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Last updated: <span className="font-medium text-slate-300">{lastUpdated}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function displayValue(value: string | null | undefined, fallback = "Not available yet") {
  return value?.trim() || fallback;
}

function displayList(values: string[] | null | undefined) {
  return values?.filter(Boolean) ?? [];
}

export function AiMarketingProfilePage({ profile }: { profile: AiMarketingProfile | null }) {
  // Also empty when a failed attempt never produced any prior successful content (e.g. the
  // first-ever generation failed) — distinct from a failed *refresh* of an already-populated
  // profile, where the last successful content should keep showing untouched below the banner.
  const isEmpty =
    !profile ||
    profile.profile_status === "pending" ||
    (profile.profile_status === "failed" && !profile.business_summary);
  const services = displayList(profile?.services);
  const serviceAreas = displayList(profile?.service_areas);
  const keywords = displayList(profile?.keywords);
  const ctas = displayList(profile?.recommended_ctas);
  const objections = displayList(profile?.common_objections);
  const monthlyThemes = profile?.monthly_themes ?? [];
  const quarterlyCampaigns = profile?.quarterly_campaigns ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">AI Profile</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Your centralized AI marketing brain for content, SEO, reviews, and Google Business Profile.
          </p>
        </div>
        <AiMarketingProfileRefreshButton />
      </div>

      <ProfileHero profile={profile} />

      {profile?.profile_status === "generating" && (
        <section className="rounded-2xl border border-brand-100 bg-brand-50/40 p-6 text-center ring-1 ring-brand-100">
          <p className="text-sm font-semibold text-brand-700">Generating your AI marketing profile...</p>
        </section>
      )}

      {profile?.profile_status === "failed" && (
        <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 ring-1 ring-rose-100">
          <p className="text-sm font-semibold text-rose-700">
            AI profile generation failed. Click <strong>Refresh AI Profile</strong> to try again.
          </p>
          {formatAiMarketingProfileFailure(profile.last_error) && (
            <p className="mt-2 text-sm text-rose-600">
              Last error: {formatAiMarketingProfileFailure(profile.last_error)}
            </p>
          )}
          <p className="mt-2 text-xs text-rose-500">
            {isEmpty
              ? "No AI-generated content is shown below because generation has not succeeded yet — nothing here is placeholder or fake content."
              : "The information below is from the last successful generation and was not overwritten by this failed attempt."}
          </p>
        </section>
      )}

      {isEmpty && profile?.profile_status !== "generating" && profile?.profile_status !== "failed" && (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 ring-1 ring-amber-100">
          <p className="text-sm leading-7 text-slate-600">
            Your AI marketing profile has not been generated yet. Click <strong>Refresh AI Profile</strong> to build it from your business profile and website analysis.
          </p>
        </section>
      )}

      {!isEmpty && profile?.profile_status !== "generating" && (
        <>
          <SectionCard title="Profile Overview" subtitle="Core business intelligence used across AJN AI">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Profile Status" value={formatProfileStatus(profile.profile_status)} />
              <ProfileField label="Industry" value={displayValue(profile.industry)} />
              <ProfileField label="Brand Voice" value={displayValue(profile.brand_voice)} />
              <ProfileField label="Tone" value={displayValue(profile.tone)} />
              <ProfileField label="Target Audience" value={displayValue(profile.target_audience)} />
              <ProfileField label="Ideal Customer" value={displayValue(profile.ideal_customer)} />
            </div>
          </SectionCard>

          <SectionCard title="Business Summary" subtitle="High-level understanding of the business">
            <TextBlock label="Summary" value={displayValue(profile.business_summary)} />
            <div className="mt-4">
              <TextBlock label="Value Proposition" value={displayValue(profile.value_proposition)} />
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Services" subtitle="Offerings AJN AI should promote">
              <ChipList items={services} />
            </SectionCard>
            <SectionCard title="Service Areas" subtitle="Geographic and market focus">
              <ChipList items={serviceAreas} />
            </SectionCard>
          </div>

          <SectionCard title="Keywords" subtitle="Priority language for SEO and content">
            <ChipList items={keywords} />
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Recommended CTAs" subtitle="Calls-to-action aligned to the business">
              <ChipList items={ctas} />
            </SectionCard>
            <SectionCard title="Common Objections" subtitle="Messaging gaps AJN AI should address">
              <ul className="space-y-3">
                {objections.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-200/60"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Channel Strategies" subtitle="How AJN AI should operate across marketing channels">
            <div className="grid gap-4 lg:grid-cols-2">
              <TextBlock label="Marketing Strategy" value={displayValue(profile.marketing_strategy)} />
              <TextBlock label="SEO Strategy" value={displayValue(profile.seo_strategy)} />
              <TextBlock label="Content Strategy" value={displayValue(profile.content_strategy)} />
              <TextBlock label="Review Strategy" value={displayValue(profile.review_strategy)} />
              <TextBlock
                label="Google Business Strategy"
                value={displayValue(profile.google_business_strategy)}
              />
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Monthly Themes" subtitle="Rolling content focus">
              <div className="space-y-3">
                {monthlyThemes.map((theme) => (
                  <article
                    key={`${theme.month}-${theme.theme}`}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {theme.month}
                    </p>
                    <p className="mt-2 font-semibold text-navy-900">{theme.theme}</p>
                    <p className="mt-1 text-sm text-text-muted">Focus: {theme.focus}</p>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Quarterly Campaigns" subtitle="Higher-level campaign direction">
              <div className="space-y-3">
                {quarterlyCampaigns.map((campaign) => (
                  <article
                    key={campaign.title}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                  >
                    <p className="font-semibold text-navy-900">{campaign.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{campaign.description}</p>
                  </article>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
