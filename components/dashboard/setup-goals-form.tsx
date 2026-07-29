"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PageHeader } from "@/components/dashboard/ui/page-chrome";
import { fetchBusinessProfile, upsertBusinessProfile } from "@/lib/business-profile-client";
import {
  applyAudienceToGoals,
  applyCustomerOriginToGoals,
  audienceFromGoals,
  customerOriginFromGoals,
  marketingGoalOptions,
  type BusinessAudience,
  type CustomerOrigin,
  type GoalTimeframeChoice,
} from "@/lib/onboarding-storage";
import { GOAL_TIMEFRAME_OPTIONS } from "@/lib/goals/catalog";
import {
  applyBusinessGoalsToMarketingGoals,
  decodeBusinessGoalsFromMarketingGoals,
  goalsFromSelectedLabels,
  reorderGoals,
} from "@/lib/goals/persistence";
import type { GoalKey } from "@/lib/goals/types";

export function SetupGoalsForm() {
  const router = useRouter();
  const formId = useId();
  const [goals, setGoals] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<GoalTimeframeChoice>("");
  const [audience, setAudience] = useState<BusinessAudience>("");
  const [origin, setOrigin] = useState<CustomerOrigin>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { profile, error: loadError } = await fetchBusinessProfile();
      if (cancelled) return;
      if (loadError || !profile) {
        setError("Unable to load marketing goals.");
        setLoading(false);
        return;
      }
      const existing = profile.marketing_goals ?? [];
      const structured = decodeBusinessGoalsFromMarketingGoals(existing);
      setGoals(structured.map((goal) => goal.label));
      setTimeframe((structured[0]?.targetTimeframe as GoalTimeframeChoice) ?? "");
      setAudience(audienceFromGoals(existing));
      setOrigin(customerOriginFromGoals(existing));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleGoal(goal: string) {
    setSuccess(null);
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal],
    );
  }

  function moveGoal(label: string, direction: -1 | 1) {
    setGoals((current) => {
      const index = current.indexOf(label);
      if (index < 0) return current;
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
  }

  async function onSave() {
    setError(null);
    setSuccess(null);
    if (goals.length === 0 && !audience && !origin) {
      setError("Choose at least one success goal, or confirm audience and customer origin.");
      return;
    }

    setSaving(true);
    const { profile, error: loadError } = await fetchBusinessProfile();
    if (loadError || !profile) {
      setSaving(false);
      setError("Unable to save — please try again.");
      return;
    }

    const timeframeValue =
      timeframe === "90_days" || timeframe === "6_months" || timeframe === "1_year"
        ? timeframe
        : null;
    let structured = goalsFromSelectedLabels(goals, timeframeValue);
    structured = reorderGoals(
      structured,
      goals
        .map((label) => structured.find((goal) => goal.label === label)?.key)
        .filter(Boolean) as GoalKey[],
    );

    const base = applyCustomerOriginToGoals(applyAudienceToGoals([], audience), origin);
    const marketing_goals = applyBusinessGoalsToMarketingGoals(base, structured);

    const { error: saveError } = await upsertBusinessProfile({
      ...profile,
      marketing_goals,
    });
    setSaving(false);

    if (saveError) {
      setError("Unable to save goals. Please try again.");
      return;
    }

    setSuccess("Goals saved — your Growth Advisor will aim recommendations here.");
    router.refresh();
    document.getElementById(`${formId}-success`)?.focus();
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading goals…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Setup"
        title="What success looks like"
        description="Tell me what a great year would look like. This keeps Growth Advisor focused — it does not automatically regenerate strategy."
        backHref="/dashboard/setup"
        backLabel="Back to setup"
      />

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-navy-900">
          What would success look like for your business over the next year?
        </h2>
        <p className="text-sm text-text-muted">
          Select multiple goals. Use the arrows to set priority (first = most important).
        </p>
        <ul className="space-y-2">
          {marketingGoalOptions.map((goal) => {
            const selected = goals.includes(goal);
            const priority = selected ? goals.indexOf(goal) + 1 : null;
            return (
              <li key={goal} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleGoal(goal)}
                  className={`hom-focusable min-h-11 flex-1 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    selected
                      ? "border-brand-300 bg-brand-50/70 text-navy-900 ring-1 ring-brand-200"
                      : "border-slate-200 bg-white text-navy-900 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{goal}</span>
                    {priority ? (
                      <span className="text-xs font-semibold text-brand-600">#{priority}</span>
                    ) : null}
                  </span>
                </button>
                {selected ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Move ${goal} up in priority`}
                      onClick={() => moveGoal(goal, -1)}
                      className="hom-focusable min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-900"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${goal} down in priority`}
                      onClick={() => moveGoal(goal, 1)}
                      className="hom-focusable min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-900"
                    >
                      ↓
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-navy-900">Optional target timeframe</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Target timeframe">
          {GOAL_TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={timeframe === option.id}
              onClick={() =>
                setTimeframe((current) => (current === option.id ? "" : option.id))
              }
              className={`hom-focusable min-h-11 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                timeframe === option.id
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "border border-slate-200 bg-white text-navy-900 ring-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-navy-900">Business direction</h2>
        <p className="text-sm text-text-muted">
          From onboarding — edit anytime. Either a goal above or this direction is enough for
          Growth Advisor readiness.
        </p>
        <div>
          <p className="text-sm font-medium text-navy-900" id={`${formId}-audience-label`}>
            Audience
          </p>
          <div
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            role="group"
            aria-labelledby={`${formId}-audience-label`}
          >
            {(
              [
                ["local", "Local business"],
                ["online", "Online business"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={audience === value}
                onClick={() => setAudience(value)}
                className={`hom-focusable min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  audience === value
                    ? "border-brand-300 bg-brand-50/70"
                    : "border-slate-200 bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-navy-900" id={`${formId}-origin-label`}>
            Where customers come from
          </p>
          <div
            className="mt-2 flex flex-col gap-2"
            role="group"
            aria-labelledby={`${formId}-origin-label`}
          >
            {(
              [
                ["local_community", "Local community"],
                ["regional", "Regional"],
                ["national", "National"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={origin === value}
                onClick={() => setOrigin(value)}
                className={`hom-focusable min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold ${
                  origin === value
                    ? "border-brand-300 bg-brand-50/70"
                    : "border-slate-200 bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

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
          type="button"
          disabled={saving}
          onClick={onSave}
          className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save goals"}
        </button>
        <Link
          href="/dashboard/setup"
          className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
        >
          Return to setup
        </Link>
      </div>
    </div>
  );
}
