"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BusinessProfile } from "@/lib/business-profile";
import {
  profileToSettingsForm,
  settingsFormToProfileRow,
  type SettingsFormData,
} from "@/lib/business-profile";
import { fetchBusinessProfile, upsertBusinessProfile } from "@/lib/business-profile-client";

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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy-900">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function Toggle({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div>
        <p className="text-sm font-semibold text-navy-900">{label}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
    </label>
  );
}

function PlatformRow({
  name,
  status,
  connected,
}: {
  name: string;
  status: string;
  connected: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-brand-600 ring-1 ring-slate-200">
          {name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-navy-900">{name}</p>
          <p className="text-sm text-text-muted">{status}</p>
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
          connected
            ? "bg-growth-50 text-growth-500 ring-emerald-100"
            : "bg-slate-100 text-slate-600 ring-slate-200"
        }`}
      >
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

export function SettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<SettingsFormData>(profileToSettingsForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { profile: savedProfile, error: loadError } = await fetchBusinessProfile();

      if (loadError) {
        setError(loadError);
      } else if (savedProfile) {
        setProfile(savedProfile);
        setForm(profileToSettingsForm(savedProfile));
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const row = settingsFormToProfileRow(
      profile?.user_id ?? "",
      form,
      profile
    );

    const { error: saveError } = await upsertBusinessProfile(row);

    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }

    const { profile: savedProfile } = await fetchBusinessProfile();
    if (savedProfile) {
      setProfile(savedProfile);
      setForm(profileToSettingsForm(savedProfile));
    }

    setMessage("Settings saved to your business profile.");
  }

  const teamMembers = [
    { name: "Mike Reynolds", role: "Owner", email: "mike@riversideplumbing.com" },
    { name: "Sarah Chen", role: "Office Manager", email: "sarah@riversideplumbing.com" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-text-muted">Loading settings...</p>
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={handleSave}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Settings</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Manage your business profile, notifications, brand voice, and connected platforms.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {message && (
        <p className="rounded-xl border border-emerald-200 bg-growth-50 px-4 py-3 text-sm font-medium text-growth-600">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Business Profile" subtitle="Information used across your AJN workspace">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Business name"
              value={form.businessName}
              onChange={(value) => setForm((current) => ({ ...current, businessName: value }))}
            />
            <Field
              label="Industry"
              value={form.industry}
              onChange={(value) => setForm((current) => ({ ...current, industry: value }))}
            />
            <Field
              label="Website"
              value={form.website}
              onChange={(value) => setForm((current) => ({ ...current, website: value }))}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              type="tel"
            />
            <Field
              label="City"
              value={form.city}
              onChange={(value) => setForm((current) => ({ ...current, city: value }))}
            />
            <Field
              label="State"
              value={form.state}
              onChange={(value) => setForm((current) => ({ ...current, state: value }))}
            />
          </div>
        </SectionCard>

        <SectionCard title="Notification Preferences" subtitle="Choose how AJN keeps you informed">
          <div className="space-y-3">
            <Toggle
              label="Email reports"
              description="Receive weekly and monthly performance summaries by email."
              defaultChecked
            />
            <Toggle
              label="SMS approvals"
              description="Approve content quickly via text message."
              defaultChecked
            />
            <Toggle
              label="Review alerts"
              description="Get notified when new Google reviews are posted."
              defaultChecked
            />
            <Toggle
              label="Weekly performance summary"
              description="A concise snapshot of visibility, content, and reviews."
              defaultChecked
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Brand Voice" subtitle="Guide how AJN AI writes for your business">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field
            label="Tone"
            value={form.tone}
            onChange={(value) => setForm((current) => ({ ...current, tone: value }))}
          />
          <Field
            label="Words to use"
            value={form.wordsToUse}
            onChange={(value) => setForm((current) => ({ ...current, wordsToUse: value }))}
          />
          <Field
            label="Words to avoid"
            value={form.wordsToAvoid}
            onChange={(value) => setForm((current) => ({ ...current, wordsToAvoid: value }))}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          AJN AI uses these settings when drafting posts, review replies, and email content for{" "}
          {form.businessName || "your business"}.
        </p>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Team" subtitle="People with access to this workspace">
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.email}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div>
                  <p className="font-semibold text-navy-900">{member.name}</p>
                  <p className="text-sm text-text-muted">{member.email}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Invite Team Member
          </button>
        </SectionCard>

        <SectionCard title="Connected Platforms" subtitle="Channels AJN publishes and monitors">
          <div className="space-y-3">
            <PlatformRow
              name="Google Business Profile"
              status={`Synced daily · ${form.city || "your city"} location`}
              connected
            />
            <PlatformRow
              name="Facebook"
              status={`Page connected · ${form.businessName || "your business"}`}
              connected
            />
            <PlatformRow name="Instagram" status="Not yet connected" connected={false} />
            <PlatformRow name="LinkedIn" status="Company page connected" connected />
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-full bg-[#081426] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
