"use client";

import { FormEvent, useState } from "react";

export type ScanFormValues = {
  websiteUrl: string;
  businessName: string;
  city: string;
  stateOrRegion: string;
};

const EMPTY_VALUES: ScanFormValues = { websiteUrl: "", businessName: "", city: "", stateOrRegion: "" };

/** Friendly, forgiving client-side check — the server (lib/business-discovery/public/urlSafety.ts) is the real, authoritative validator. This only catches "obviously nothing was entered" before spending a network round trip. */
function looksLikeAWebsite(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return /[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed);
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-navy-900 shadow-sm ring-1 ring-slate-900/[0.03] transition-colors placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function ScanForm({
  onSubmit,
  submitting,
  initialValues,
}: {
  onSubmit: (values: ScanFormValues) => void;
  submitting: boolean;
  initialValues?: Partial<ScanFormValues>;
}) {
  const [values, setValues] = useState<ScanFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateField(field: keyof ScanFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field === "websiteUrl" && validationError) setValidationError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!looksLikeAWebsite(values.websiteUrl)) {
      setValidationError("Enter your website address, like yourbusiness.com.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-describedby="scan-form-privacy-note">
      <div>
        <label htmlFor="scan-website-url" className="mb-2 block text-sm font-semibold text-navy-900">
          Your business website
        </label>
        <input
          id="scan-website-url"
          name="websiteUrl"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.com"
          value={values.websiteUrl}
          onChange={(event) => updateField("websiteUrl", event.target.value)}
          className={inputClassName}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? "scan-website-url-error" : undefined}
        />
        {validationError ? (
          <p id="scan-website-url-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
            {validationError}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">For example, yourbusiness.com or https://yourbusiness.com</p>
        )}
      </div>

      {showMoreDetails ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 sm:col-span-1">
            <span className="text-sm font-semibold text-navy-900">Business name</span>
            <input
              type="text"
              placeholder="Your Business"
              value={values.businessName}
              onChange={(event) => updateField("businessName", event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-navy-900">City</span>
            <input
              type="text"
              placeholder="City"
              value={values.city}
              onChange={(event) => updateField("city", event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-navy-900">State or region</span>
            <input
              type="text"
              placeholder="State"
              value={values.stateOrRegion}
              onChange={(event) => updateField("stateOrRegion", event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMoreDetails(true)}
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          + Add your business name or location (optional)
        </button>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Studying your business…" : "Scan My Business"}
      </button>

      <p id="scan-form-privacy-note" className="text-xs leading-6 text-text-muted">
        We&apos;ll only look at what&apos;s already public — your website and what shows up when someone searches for
        you. No account is required to see your Snapshot.
      </p>
    </form>
  );
}
