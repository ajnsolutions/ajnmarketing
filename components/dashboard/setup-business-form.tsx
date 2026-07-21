"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PageHeader } from "@/components/dashboard/ui/page-chrome";
import {
  profileToSettingsForm,
  settingsFormToProfileRow,
  type SettingsFormData,
} from "@/lib/business-profile";
import { fetchBusinessProfile, upsertBusinessProfile } from "@/lib/business-profile-client";

export function SetupBusinessForm() {
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState<SettingsFormData>(profileToSettingsForm(null));
  const [profileId, setProfileId] = useState<string | null>(null);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { profile, error: loadError } = await fetchBusinessProfile();
      if (cancelled) return;
      if (loadError) {
        setError("Unable to load business information.");
        setLoading(false);
        return;
      }
      setForm(profileToSettingsForm(profile));
      setProfileId(profile?.id ?? null);
      setExistingUserId(profile?.user_id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  function update<K extends keyof SettingsFormData>(key: K, value: SettingsFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSuccess(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.businessName.trim()) {
      next.businessName = "Business name is required.";
    } else if (form.businessName.trim() === "Your Business") {
      next.businessName = "Enter your real business name.";
    }
    if (form.website.trim()) {
      try {
        // Allow bare domains by normalizing.
        const candidate = form.website.includes("://")
          ? form.website.trim()
          : `https://${form.website.trim()}`;
        const url = new URL(candidate);
        if (!url.hostname.includes(".")) {
          next.website = "Enter a valid website address, or leave this blank.";
        }
      } catch {
        next.website = "Enter a valid website address, or leave this blank.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validate()) return;
    if (!existingUserId) {
      setError("Unable to save — please sign in again.");
      return;
    }

    setSaving(true);
    const { profile } = await fetchBusinessProfile();
    const row = settingsFormToProfileRow(existingUserId, form, profile);
    const { error: saveError } = await upsertBusinessProfile(
      profileId ? { ...row, id: profileId } : row,
    );
    setSaving(false);

    if (saveError) {
      setError("Unable to save business information. Please try again.");
      return;
    }

    setDirty(false);
    setSuccess("Business information saved.");
    router.refresh();
    // Move focus to success message for screen readers.
    document.getElementById(`${formId}-success`)?.focus();
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading business information…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Setup"
        title="Business information"
        description="Tell me who you are. A real business name is required — industry and location help me be more specific."
        backHref="/dashboard/setup"
        backLabel="Back to setup"
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <fieldset className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-navy-900">Identity</legend>
          <div>
            <label htmlFor={`${formId}-name`} className="text-sm font-medium text-navy-900">
              Business name <span className="text-rose-600">(required)</span>
            </label>
            <input
              id={`${formId}-name`}
              name="businessName"
              value={form.businessName}
              onChange={(event) => update("businessName", event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.businessName)}
              aria-describedby={
                fieldErrors.businessName ? `${formId}-name-error` : `${formId}-name-hint`
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
              placeholder="e.g. Harborview Dental"
            />
            <p id={`${formId}-name-hint`} className="mt-1 text-xs text-text-muted">
              Example: Harborview Dental
            </p>
            {fieldErrors.businessName && (
              <p id={`${formId}-name-error`} className="mt-1 text-sm text-rose-700" role="alert">
                {fieldErrors.businessName}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${formId}-industry`} className="text-sm font-medium text-navy-900">
              Industry <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id={`${formId}-industry`}
              name="industry"
              value={form.industry}
              onChange={(event) => update("industry", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
              placeholder="e.g. Dental practice"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-navy-900">Location & contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-city`} className="text-sm font-medium text-navy-900">
                City <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id={`${formId}-city`}
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-state`} className="text-sm font-medium text-navy-900">
                State <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id={`${formId}-state`}
                value={form.state}
                onChange={(event) => update("state", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-phone`} className="text-sm font-medium text-navy-900">
              Phone <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id={`${formId}-phone`}
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-website`} className="text-sm font-medium text-navy-900">
              Website <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id={`${formId}-website`}
              value={form.website}
              onChange={(event) => update("website", event.target.value)}
              aria-invalid={Boolean(fieldErrors.website)}
              aria-describedby={fieldErrors.website ? `${formId}-website-error` : undefined}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-navy-900"
              placeholder="e.g. www.harborviewdental.com"
            />
            {fieldErrors.website && (
              <p id={`${formId}-website-error`} className="mt-1 text-sm text-rose-700" role="alert">
                {fieldErrors.website}
              </p>
            )}
            <p className="mt-2 text-sm text-text-muted">
              No website? You can confirm that on the{" "}
              <Link href="/dashboard/website-analysis" className="hom-focusable font-medium text-brand-600">
                website setup
              </Link>{" "}
              page.
            </p>
          </div>
        </fieldset>

        {error && (
          <p className="text-sm font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p
            id={`${formId}-success`}
            tabIndex={-1}
            className="text-sm font-medium text-growth-700 outline-none"
            role="status"
          >
            {success}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save business information"}
          </button>
          <Link
            href="/dashboard/setup"
            className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          >
            Return to setup
          </Link>
        </div>
      </form>
    </div>
  );
}
