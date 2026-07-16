"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  initialOnboardingData,
  type BusinessAudience,
  type GbpAnswer,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { profileRowToOnboardingData } from "@/lib/business-profile";
import { fetchBusinessProfile, saveOnboardingProgress } from "@/lib/business-profile-client";

type MagicStep =
  | "welcome"
  | "website"
  | "businessName"
  | "audience"
  | "gbp"
  | "gbpReassure"
  | "facebook"
  | "instagram"
  | "progress"
  | "complete";

const QUESTION_STEPS: MagicStep[] = [
  "welcome",
  "website",
  "businessName",
  "audience",
  "gbp",
  "facebook",
  "instagram",
];

const PROGRESS_MESSAGES = [
  "Learning about your business...",
  "Understanding your customers...",
  "Preparing your first marketing plan...",
  "Building your first week...",
];

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-4 text-left text-base font-semibold transition-colors ${
        selected
          ? "border-brand-300 bg-brand-50/60 text-navy-900 ring-1 ring-brand-200"
          : "border-slate-200 bg-white text-navy-900 hover:border-brand-200 hover:bg-[#F8FAFC]"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<MagicStep>("welcome");
  const [data, setData] = useState<OnboardingData>(initialOnboardingData);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [facebookAnswered, setFacebookAnswered] = useState(false);
  const [instagramAnswered, setInstagramAnswered] = useState(false);

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

  useEffect(() => {
    if (step !== "progress") return;

    const timers: number[] = [];
    PROGRESS_MESSAGES.forEach((_, index) => {
      if (index === 0) return;
      timers.push(
        window.setTimeout(() => {
          setProgressIndex(index);
        }, index * 900),
      );
    });
    timers.push(
      window.setTimeout(() => {
        setStep("complete");
      }, PROGRESS_MESSAGES.length * 900 + 400),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [step]);

  function updateField<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  async function persistProgress(onboardingCompleted = false) {
    setSaving(true);
    const payload: OnboardingData = {
      ...data,
      competitorsSkipped: true,
      gbpSkipped: data.gbpAnswer !== "yes",
    };
    const { error } = await saveOnboardingProgress(payload, onboardingCompleted);
    setSaving(false);

    if (error) {
      setSavedNotice(`Could not save progress: ${error}`);
      return false;
    }

    setData(payload);
    return true;
  }

  async function handleSaveAndContinueLater() {
    const saved = await persistProgress(false);
    if (!saved) return;
    setSavedNotice("Progress saved. You can continue anytime.");
  }

  function goNextFrom(current: MagicStep) {
    if (current === "welcome") {
      setStep("website");
      return;
    }
    if (current === "website") {
      setStep("businessName");
      return;
    }
    if (current === "businessName") {
      setStep("audience");
      return;
    }
    if (current === "audience") {
      setStep("gbp");
      return;
    }
    if (current === "gbp") {
      if (data.gbpAnswer === "no" || data.gbpAnswer === "not_sure") {
        setStep("gbpReassure");
        return;
      }
      setStep("facebook");
      return;
    }
    if (current === "gbpReassure") {
      setStep("facebook");
      return;
    }
    if (current === "facebook") {
      setStep("instagram");
      return;
    }
    if (current === "instagram") {
      void finishSetup();
    }
  }

  async function handleContinue() {
    if (step === "welcome") {
      setStep("website");
      return;
    }

    if (step === "website" && !data.websiteUrl.trim()) {
      setSavedNotice("A website helps me learn your business faster. Add a URL to continue.");
      return;
    }

    if (step === "businessName" && !data.businessName.trim()) {
      setSavedNotice("What should I call your business?");
      return;
    }

    if (step === "audience" && !data.businessAudience) {
      setSavedNotice("Choose the option that fits best.");
      return;
    }

    if (step === "gbp" && !data.gbpAnswer) {
      setSavedNotice("Choose an option to continue.");
      return;
    }

    if (step === "facebook" && !facebookAnswered) {
      setSavedNotice("Choose an option, or skip for now.");
      return;
    }

    if (step === "instagram" && !instagramAnswered) {
      setSavedNotice("Choose an option, or skip for now.");
      return;
    }

    const saved = await persistProgress(false);
    if (!saved) return;
    setSavedNotice(null);
    goNextFrom(step);
  }

  async function finishSetup() {
    const saved = await persistProgress(true);
    if (!saved) return;

    void fetch("/api/website-analysis", { method: "POST" });
    setProgressIndex(0);
    setStep("progress");
  }

  function questionProgress(): number {
    const index = QUESTION_STEPS.indexOf(step);
    if (index < 0) return 100;
    return ((index + 1) / QUESTION_STEPS.length) * 100;
  }

  function goBack() {
    setSavedNotice(null);
    if (step === "website") setStep("welcome");
    else if (step === "businessName") setStep("website");
    else if (step === "audience") setStep("businessName");
    else if (step === "gbp") setStep("audience");
    else if (step === "gbpReassure") setStep("gbp");
    else if (step === "facebook") {
      setStep(data.gbpAnswer === "no" || data.gbpAnswer === "not_sure" ? "gbpReassure" : "gbp");
    } else if (step === "instagram") setStep("facebook");
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F8FAFC] px-6 py-16">
        <p className="text-sm font-medium text-text-muted">Getting ready...</p>
      </div>
    );
  }

  if (step === "progress") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#F8FAFC] px-6 py-16">
        <div className="w-full max-w-lg text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
            Working quietly
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            {PROGRESS_MESSAGES[progressIndex]}
          </h1>
          <p className="mt-4 text-sm leading-7 text-text-muted">
            I&apos;m already learning your business. This only takes a moment.
          </p>
          <div className="mx-auto mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{
                width: `${((progressIndex + 1) / PROGRESS_MESSAGES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#F8FAFC] px-6 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
            You&apos;re in good hands
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900">Perfect.</h1>
          <p className="mt-4 text-base leading-7 text-navy-900">
            I&apos;m already getting to work.
          </p>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Go back to running your business. I&apos;ll let you know when I need you.
          </p>
          <p className="mt-6 text-sm font-medium text-navy-900">Go enjoy your day.</p>
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="mt-8 inline-flex rounded-full bg-[#081426] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const showChrome = step !== "welcome";

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Image
              src="/images/AJN_marketing_logo.png"
              alt="AJN Marketing"
              width={120}
              height={60}
              className="h-9 w-auto"
            />
          </Link>
          {showChrome && (
            <p className="text-sm font-medium text-text-muted">
              A few quick questions
            </p>
          )}
        </div>
        {showChrome && (
          <div className="mx-auto max-w-xl px-6 pb-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${questionProgress()}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-xl px-6 py-10 sm:py-14">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
          {savedNotice && (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {savedNotice}
            </p>
          )}

          {step === "welcome" && (
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
                Welcome
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900 sm:text-[2.1rem]">
                I&apos;m excited to become your Head of Marketing.
              </h1>
              <p className="mx-auto mt-5 max-w-md text-base leading-7 text-text-muted">
                First, I need to learn about your business.
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-text-muted">
                We&apos;ll have you up and running in just a few minutes.
              </p>
            </div>
          )}

          {step === "website" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  What&apos;s your website?
                </h1>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  I&apos;ll use it to start learning your business.
                </p>
              </div>
              <label htmlFor="website-url" className="block">
                <span className="sr-only">Website URL</span>
                <input
                  id="website-url"
                  type="url"
                  value={data.websiteUrl}
                  placeholder="https://"
                  onChange={(event) => updateField("websiteUrl", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-base text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>
          )}

          {step === "businessName" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  What should I call your business?
                </h1>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  Just the name your customers know.
                </p>
              </div>
              <label htmlFor="business-name" className="block">
                <span className="sr-only">Business name</span>
                <input
                  id="business-name"
                  type="text"
                  value={data.businessName}
                  placeholder="Your business name"
                  onChange={(event) => updateField("businessName", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-base text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>
          )}

          {step === "audience" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  Are you primarily:
                </h1>
              </div>
              <div className="space-y-3">
                {(
                  [
                    { value: "local" as BusinessAudience, label: "Local Business" },
                    { value: "online" as BusinessAudience, label: "Online Business" },
                  ] as const
                ).map((option) => (
                  <ChoiceButton
                    key={option.value}
                    selected={data.businessAudience === option.value}
                    onClick={() => updateField("businessAudience", option.value)}
                  >
                    {option.label}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          )}

          {step === "gbp" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  Do you already have a Google Business Profile?
                </h1>
              </div>
              <div className="space-y-3">
                {(
                  [
                    { value: "yes" as GbpAnswer, label: "Yes" },
                    { value: "no" as GbpAnswer, label: "No" },
                    { value: "not_sure" as GbpAnswer, label: "Not Sure" },
                  ] as const
                ).map((option) => (
                  <ChoiceButton
                    key={option.value}
                    selected={data.gbpAnswer === option.value}
                    onClick={() => {
                      updateField("gbpAnswer", option.value);
                      updateField("gbpSkipped", option.value !== "yes");
                    }}
                  >
                    {option.label}
                  </ChoiceButton>
                ))}
              </div>
              {data.gbpAnswer === "yes" && (
                <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-5 text-center ring-1 ring-brand-100">
                  <p className="text-sm leading-6 text-text-muted">
                    You can connect Google now, or keep going and finish it later. Nothing is blocked.
                  </p>
                  <Link
                    href="/dashboard/google-business-profile/connect"
                    className="mt-4 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                  >
                    Connect Google Business Profile
                  </Link>
                </div>
              )}
            </div>
          )}

          {step === "gbpReassure" && (
            <div className="space-y-5 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                No problem.
              </h1>
              <p className="text-base leading-7 text-text-muted">
                We&apos;ll help with that later.
              </p>
              <p className="text-sm leading-7 text-text-muted">
                Skipped items become recommendations — never blockers.
              </p>
            </div>
          )}

          {step === "facebook" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  Would you like to connect Facebook?
                </h1>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  Optional. Skip anytime — I&apos;ll remind you when it helps.
                </p>
              </div>
              <div className="space-y-3">
                <ChoiceButton
                  selected={facebookAnswered && !data.facebookSkipped}
                  onClick={() => {
                    setFacebookAnswered(true);
                    updateField("facebookSkipped", false);
                  }}
                >
                  Yes, remind me to connect
                </ChoiceButton>
                <ChoiceButton
                  selected={facebookAnswered && data.facebookSkipped}
                  onClick={() => {
                    setFacebookAnswered(true);
                    updateField("facebookSkipped", true);
                  }}
                >
                  Skip for now
                </ChoiceButton>
              </div>
            </div>
          )}

          {step === "instagram" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                  Would you like to connect Instagram?
                </h1>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  Optional. Skip anytime — I&apos;ll remind you when it helps.
                </p>
              </div>
              <div className="space-y-3">
                <ChoiceButton
                  selected={instagramAnswered && !data.instagramSkipped}
                  onClick={() => {
                    setInstagramAnswered(true);
                    updateField("instagramSkipped", false);
                  }}
                >
                  Yes, remind me to connect
                </ChoiceButton>
                <ChoiceButton
                  selected={instagramAnswered && data.instagramSkipped}
                  onClick={() => {
                    setInstagramAnswered(true);
                    updateField("instagramSkipped", true);
                  }}
                >
                  Skip for now
                </ChoiceButton>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {step === "welcome" ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={handleSaveAndContinueLater}
                className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                Save and continue later
              </button>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {step !== "welcome" && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleContinue()}
                disabled={saving}
                className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : step === "welcome"
                    ? "Let's begin"
                    : step === "instagram"
                      ? "Finish"
                      : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
