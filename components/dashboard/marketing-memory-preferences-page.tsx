"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  deactivateMarketingMemoryPreference,
  fetchMarketingMemoryOverrides,
  fetchMarketingMemoryPreferences,
  saveMarketingMemoryPreference,
  type OverrideApiRow,
  type PreferenceApiRow,
} from "@/lib/marketing-memory/preferenceClient";

const CONTEXT_OPTIONS = [
  { value: "political_civic", label: "Political / civic events" },
  { value: "sports_entertainment", label: "Sports / entertainment" },
  { value: "competitor", label: "Competitor activity" },
  { value: "weather", label: "Weather" },
  { value: "holiday", label: "Holidays" },
  { value: "local_event", label: "Local events" },
] as const;

const DAY_OPTIONS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Minimal settings surface for Marketing Memory Phase 3 preferences.
 * Additive only — does not change Brand Voice, marketing goals, or decision engines.
 */
export function MarketingMemoryPreferencesPage() {
  const [preferences, setPreferences] = useState<PreferenceApiRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideApiRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [contextCategory, setContextCategory] = useState<string>("political_civic");
  const [publishDay, setPublishDay] = useState<string>("sunday");
  const [customText, setCustomText] = useState("");

  function reload() {
    startTransition(async () => {
      try {
        setError(null);
        const [prefResult, overrideRows] = await Promise.all([
          fetchMarketingMemoryPreferences(),
          fetchMarketingMemoryOverrides(),
        ]);
        setPreferences(prefResult.preferences);
        setOverrides(overrideRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preferences");
      }
    });
  }

  useEffect(() => {
    reload();
  }, []);

  const activePreferences = preferences.filter((row) => row.is_active);

  function runSave(body: Record<string, unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        setError(null);
        setStatus(null);
        await saveMarketingMemoryPreference(body);
        setStatus(successMessage);
        reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save preference");
      }
    });
  }

  function runDeactivate(id: string) {
    startTransition(async () => {
      try {
        setError(null);
        setStatus(null);
        await deactivateMarketingMemoryPreference(id);
        setStatus("Preference turned off. The earlier instruction stays in your history.");
        reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to turn off preference");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">
          Marketing preferences
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-text-muted">
          Tell me standing instructions I should remember. These are recorded for audit and
          future use — they do not yet change recommendations or Weekly Briefing decisions.
          Brand voice and monthly goals stay in their existing settings.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          <Link href="/dashboard/settings" className="hom-focusable font-medium text-brand-600">
            Back to Settings
          </Link>
          {" · "}
          <Link href="/dashboard/brand-voice" className="hom-focusable font-medium text-brand-600">
            Brand voice
          </Link>
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800" role="status">
          {status}
        </p>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">Context I should skip</h2>
        <p className="text-sm leading-6 text-text-muted">
          Disable a context category so it is remembered as an explicit preference (for example,
          political or civic events).
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-navy-900">
            Category
            <select
              className="hom-focusable mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={contextCategory}
              onChange={(event) => setContextCategory(event.target.value)}
            >
              {CONTEXT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={isPending}
            className="hom-focusable rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() =>
              runSave(
                {
                  preferenceType: "context_category_toggle",
                  factorType: contextCategory,
                  factorValue: "disable",
                  instructionText: `Don't use ${contextCategory.replaceAll("_", " ")} events as marketing context.`,
                },
                "Got it — I’ll remember not to use that context."
              )
            }
          >
            Remember this
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">Days to avoid publishing</h2>
        <p className="text-sm leading-6 text-text-muted">
          A standing day restriction — separate from one-off schedule choices on a recommendation.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-navy-900">
            Day
            <select
              className="hom-focusable mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={publishDay}
              onChange={(event) => setPublishDay(event.target.value)}
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={isPending}
            className="hom-focusable rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() =>
              runSave(
                {
                  preferenceType: "publishing_day_restriction",
                  factorValue: publishDay,
                  instructionText: `Avoid publishing on ${publishDay}s.`,
                },
                "Saved — I’ll remember that publishing day preference."
              )
            }
          >
            Remember this
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">Other standing instruction</h2>
        <p className="text-sm leading-6 text-text-muted">
          For goals or brand voice, use those settings instead — this box is only for marketing
          memory instructions that do not already have a home.
        </p>
        <label className="block text-sm font-medium text-navy-900">
          Instruction
          <textarea
            className="hom-focusable mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            placeholder="Example: Prefer Google posts over email this quarter."
          />
        </label>
        <button
          type="button"
          disabled={isPending || !customText.trim()}
          className="hom-focusable rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() =>
            runSave(
              {
                preferenceType: "custom",
                instructionText: customText.trim(),
              },
              "Saved your standing instruction."
            )
          }
        >
          Remember this
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-900">Active preferences</h2>
        {activePreferences.length === 0 ? (
          <p className="text-sm leading-6 text-text-muted">
            No active marketing preferences yet. Anything you save above will show here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
            {activePreferences.map((preference) => (
              <li key={preference.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{preference.instruction_text}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {preference.preference_type.replaceAll("_", " ")}
                    {preference.source === "promoted_override" ? " · from a remembered override" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  className="hom-focusable text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60"
                  onClick={() => runDeactivate(preference.id)}
                >
                  Turn off
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-900">Recent overrides</h2>
        <p className="text-sm leading-6 text-text-muted">
          One-time choices are recorded as evidence. Permanent ones can become preferences above.
          Capture APIs exist; Weekly Briefing / Marketing Director do not write here yet.
        </p>
        {overrides.length === 0 ? (
          <p className="text-sm leading-6 text-text-muted">No overrides recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
            {overrides.slice(0, 8).map((override) => (
              <li key={override.id} className="px-5 py-4">
                <p className="text-sm font-semibold text-navy-900">
                  {override.override_type.replaceAll("_", " ")}
                  {override.is_permanent ? " · permanent" : " · one-time"}
                </p>
                {override.notes && (
                  <p className="mt-1 text-sm text-text-muted">{override.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
