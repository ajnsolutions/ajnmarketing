"use client";

/**
 * The public landing entry point into First Impression (Part 1). Deliberately
 * compact — a single required field — so it doesn't compete with or replace
 * the existing hero CTAs (components/home/homepage-sections.tsx's HomeHero);
 * it's an additive, natural next step directly beneath them.
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function HomeScanCta() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = websiteUrl.trim();
    router.push(trimmed ? `/snapshot?url=${encodeURIComponent(trimmed)}` : "/snapshot");
  }

  return (
    <section className="border-b border-slate-200/80 bg-[#F8FAFC] py-12 sm:py-14">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Meet the AI Growth Advisor that learns your business, watches your market, and helps you decide what to
          do next.
        </h2>
        <p className="mt-3 text-base leading-7 text-text-muted">
          See what we already understand about your business — free, in under a minute, no account required.
        </p>

        <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row">
          <label htmlFor="home-scan-url" className="sr-only">
            Your business website
          </label>
          <input
            id="home-scan-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbusiness.com"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-base text-navy-900 shadow-sm ring-1 ring-slate-900/[0.03] placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:flex-1"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:translate-y-0 sm:w-auto"
          >
            Scan My Business
          </button>
        </form>
        <p className="mt-3 text-xs text-text-muted">
          We&apos;ll only look at what&apos;s already public. No account required to see your Snapshot.
        </p>
      </div>
    </section>
  );
}
