"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type FormFields = {
  business_name: string;
  website_url: string;
  city: string;
  state: string;
  business_type: string;
  email: string;
  phone: string;
};

const initialForm: FormFields = {
  business_name: "",
  website_url: "",
  city: "",
  state: "",
  business_type: "",
  email: "",
  phone: "",
};

export function DemoForm() {
  const [form, setForm] = useState<FormFields>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof FormFields, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError(null);

    const { error: insertError } = await supabase
      .from("demo_requests")
      .insert(form);

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    setForm(initialForm);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Business name
        <input
          required
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={(event) => updateField("business_name", event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Website URL
        <input
          required
          type="url"
          name="website_url"
          value={form.website_url}
          onChange={(event) => updateField("website_url", event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input
            required
            type="text"
            name="city"
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          State
          <input
            required
            type="text"
            name="state"
            value={form.state}
            onChange={(event) => updateField("state", event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Business type
        <input
          required
          type="text"
          name="business_type"
          value={form.business_type}
          onChange={(event) => updateField("business_type", event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          required
          type="email"
          name="email"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Phone
        <input
          required
          type="tel"
          name="phone"
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Submitting..." : "Request free demo"}
      </button>

      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          Thank you. Your free demo request has been received.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
