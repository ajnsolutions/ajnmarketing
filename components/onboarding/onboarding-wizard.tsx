"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  initialOnboardingData,
  marketingGoalOptions,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { profileRowToOnboardingData } from "@/lib/business-profile";
import { fetchBusinessProfile, saveOnboardingProgress } from "@/lib/business-profile-client";

const STEPS = [
  "Welcome",
  "Business",
  "Location",
  "Google Profile",
  "Services",
  "Competitors",
  "Goals",
  "Brand Voice",
  "Review",
];

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  multiline = false,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-navy-900">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm leading-6 text-navy-900">{value}</p>
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialOnboardingData);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { profile, error } = await fetchBusinessProfile();

      if (error) {
        setSavedNotice(`Could not load saved progress: ${error}`);
      } else if (profile) {
        setData(profileRowToOnboardingData(profile));
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  function updateField<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function toggleGoal(goal: string) {
    setData((current) => ({
      ...current,
      marketingGoals: current.marketingGoals.includes(goal)
        ? current.marketingGoals.filter((item) => item !== goal)
        : [...current.marketingGoals, goal],
    }));
  }

  async function persistProgress(onboardingCompleted = false) {
    setSaving(true);
    const { error } = await saveOnboardingProgress(data, onboardingCompleted);
    setSaving(false);

    if (error) {
      setSavedNotice(`Could not save progress: ${error}`);
      return false;
    }

    return true;
  }

  async function handleSaveAndContinueLater() {
    const saved = await persistProgress(false);
    if (!saved) return;

    setSavedNotice("Progress saved to your account. You can continue on any device.");
  }

  async function handleContinue() {
    if (step === 0) {
      setStep(1);
      return;
    }

    const saved = await persistProgress(false);
    if (!saved) return;

    setStep((current) => current + 1);
  }

  async function handleFinish() {
    const saved = await persistProgress(true);
    if (!saved) return;

    void fetch("/api/website-analysis", { method: "POST" });

    setCompleted(true);
    window.setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2200);
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F8FAFC] px-6 py-16">
        <p className="text-sm font-medium text-text-muted">Loading your setup...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#F8FAFC] px-6 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-growth-50 text-growth-500 ring-1 ring-emerald-100">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-navy-900">You&apos;re all set!</h1>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            AJN AI is preparing your workspace. Taking you to your dashboard now...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Image
              src="/images/AJN_marketing_logo.png"
              alt="AJN Marketing"
              width={120}
              height={60}
              className="h-9 w-auto"
            />
          </Link>
          <p className="text-sm font-medium text-text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <div className="mx-auto max-w-3xl px-6 pb-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            {STEPS[step]}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 sm:py-10">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
          {savedNotice && (
            <p className="mb-6 rounded-xl border border-emerald-200 bg-growth-50 px-4 py-3 text-sm font-medium text-growth-600">
              {savedNotice}
            </p>
          )}

          {step === 0 && (
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
                Welcome to AJN Marketing
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
                Let&apos;s set up your business
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-muted sm:text-base">
                This quick setup helps AJN AI understand your business, your market, and how you
                want to sound online. Most owners finish in about 5 minutes.
              </p>
              <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-sm text-navy-900">
                {[
                  "Tell us about your business and service area",
                  "Share your services, competitors, and goals",
                  "Set your brand voice so AI sounds like you",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 text-growth-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Business information</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Basic details AJN uses across your content and profile updates.
                </p>
              </div>
              <Field
                label="Business name"
                id="business-name"
                value={data.businessName}
                onChange={(value) => updateField("businessName", value)}
              />
              <Field
                label="Industry"
                id="industry"
                value={data.industry}
                onChange={(value) => updateField("industry", value)}
                placeholder="e.g. Plumbing & HVAC"
              />
              <Field
                label="Website URL"
                id="website-url"
                value={data.websiteUrl}
                onChange={(value) => updateField("websiteUrl", value)}
                placeholder="https://"
              />
              <Field
                label="Phone number"
                id="phone"
                value={data.phone}
                onChange={(value) => updateField("phone", value)}
                placeholder="(555) 000-0000"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Location & service area</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Help AJN focus on the towns and neighborhoods you serve.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" id="city" value={data.city} onChange={(v) => updateField("city", v)} />
                <Field label="State" id="state" value={data.state} onChange={(v) => updateField("state", v)} />
              </div>
              <Field
                label="Primary service area"
                id="primary-service-area"
                value={data.primaryServiceArea}
                onChange={(v) => updateField("primaryServiceArea", v)}
                placeholder="e.g. Danville and surrounding East Bay"
              />
              <Field
                label="Nearby cities served"
                id="nearby-cities"
                value={data.nearbyCities}
                onChange={(v) => updateField("nearbyCities", v)}
                multiline
                placeholder="List nearby cities or neighborhoods, separated by commas"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Google Business Profile</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Connect your Google profile so AJN can publish posts, monitor reviews, and track
                  local visibility.
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-6 text-center ring-1 ring-brand-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-100">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                </div>
                <p className="mt-4 font-semibold text-navy-900">Google connection coming soon</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Direct Google Business Profile integration is on the way. You can finish setup now
                  and connect later from your dashboard.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-5 cursor-not-allowed rounded-full bg-brand-600/60 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Connect Google Business Profile
                </button>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
                <input
                  type="checkbox"
                  checked={data.gbpSkipped}
                  onChange={(event) => updateField("gbpSkipped", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className="text-sm text-navy-900">
                  Continue without connecting for now — I&apos;ll connect Google later.
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Services</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Tell AJN what you offer so content and promotions stay relevant.
                </p>
              </div>
              <Field
                label="Primary services"
                id="primary-services"
                value={data.primaryServices}
                onChange={(v) => updateField("primaryServices", v)}
                multiline
                placeholder="Drain cleaning, water heater repair, repiping..."
              />
              <Field
                label="Emergency services offered"
                id="emergency-services"
                value={data.emergencyServices}
                onChange={(v) => updateField("emergencyServices", v)}
                multiline
                placeholder="24/7 emergency plumbing, burst pipe response..."
              />
              <Field
                label="Seasonal services"
                id="seasonal-services"
                value={data.seasonalServices}
                onChange={(v) => updateField("seasonalServices", v)}
                multiline
                placeholder="Winter pipe freeze prevention, summer irrigation checks..."
              />
              <Field
                label="Specialty services"
                id="specialty-services"
                value={data.specialtyServices}
                onChange={(v) => updateField("specialtyServices", v)}
                multiline
                placeholder="Tankless installs, commercial plumbing, water filtration..."
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Competitors</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Optional — helps AJN monitor your local market and spot opportunities.
                </p>
              </div>
              <Field
                label="Competitor 1"
                id="competitor-1"
                value={data.competitor1}
                onChange={(v) => updateField("competitor1", v)}
              />
              <Field
                label="Competitor 2"
                id="competitor-2"
                value={data.competitor2}
                onChange={(v) => updateField("competitor2", v)}
              />
              <Field
                label="Competitor 3"
                id="competitor-3"
                value={data.competitor3}
                onChange={(v) => updateField("competitor3", v)}
              />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
                <input
                  type="checkbox"
                  checked={data.competitorsSkipped}
                  onChange={(event) => updateField("competitorsSkipped", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className="text-sm text-navy-900">Skip for now — add competitors later.</span>
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Marketing goals</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Select what matters most — AJN will prioritize recommendations around these goals.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {marketingGoalOptions.map((goal) => (
                  <label
                    key={goal}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ring-1 transition-colors ${
                      data.marketingGoals.includes(goal)
                        ? "border-brand-200 bg-brand-50/50 ring-brand-100"
                        : "border-slate-100 bg-[#F8FAFC] ring-slate-200/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={data.marketingGoals.includes(goal)}
                      onChange={() => toggleGoal(goal)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    <span className="text-sm font-medium text-navy-900">{goal}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Brand voice</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Guide how AJN AI writes posts, replies, and emails for your business.
                </p>
              </div>
              <Field
                label="Preferred tone"
                id="tone"
                value={data.tone}
                onChange={(v) => updateField("tone", v)}
                placeholder="Friendly, professional, and local"
              />
              <Field
                label="Words or phrases to use"
                id="words-to-use"
                value={data.wordsToUse}
                onChange={(v) => updateField("wordsToUse", v)}
                multiline
                placeholder="Trusted, reliable, family-owned, fast response..."
              />
              <Field
                label="Words or phrases to avoid"
                id="words-to-avoid"
                value={data.wordsToAvoid}
                onChange={(v) => updateField("wordsToAvoid", v)}
                multiline
                placeholder="Cheap, discount, lowest price..."
              />
              <Field
                label="Example customer message or business description"
                id="example-message"
                value={data.exampleMessage}
                onChange={(v) => updateField("exampleMessage", v)}
                multiline
                placeholder="We are a local plumbing team serving Danville families with honest service and fast emergency help."
              />
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Review & finish</h2>
                <p className="mt-2 text-sm text-text-muted">
                  Confirm your setup. You can update these details anytime in Settings.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryRow label="Business name" value={data.businessName} />
                <SummaryRow label="Industry" value={data.industry} />
                <SummaryRow label="Website" value={data.websiteUrl} />
                <SummaryRow label="Phone" value={data.phone} />
                <SummaryRow label="City" value={data.city} />
                <SummaryRow label="State" value={data.state} />
                <SummaryRow label="Primary service area" value={data.primaryServiceArea} />
                <SummaryRow label="Nearby cities" value={data.nearbyCities} />
                <SummaryRow label="Primary services" value={data.primaryServices} />
                <SummaryRow label="Emergency services" value={data.emergencyServices} />
                <SummaryRow label="Preferred tone" value={data.tone} />
                <SummaryRow
                  label="Marketing goals"
                  value={data.marketingGoals.join(", ")}
                />
              </div>
              {!data.competitorsSkipped && (
                <SummaryRow
                  label="Competitors"
                  value={[data.competitor1, data.competitor2, data.competitor3]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              <SummaryRow label="Google Business Profile" value={data.gbpSkipped ? "Will connect later" : "Not connected yet"} />
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSaveAndContinueLater}
              className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              Save and continue later
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Back
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={saving}
                  className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : step === 0 ? "Start Setup" : "Continue"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Finish Setup"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
