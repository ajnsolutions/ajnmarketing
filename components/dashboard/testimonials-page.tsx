"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WebsiteTestimonialRecord } from "@/lib/testimonials/types";

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

type IngestResponse = { testimonials?: WebsiteTestimonialRecord[]; errors?: string[]; error?: string };

export function TestimonialsPage({ initialTestimonials }: { initialTestimonials: WebsiteTestimonialRecord[] }) {
  const router = useRouter();
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [quote, setQuote] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  async function submit(mode: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...body }),
      });
      const payload = (await response.json().catch(() => null)) as IngestResponse | null;
      if (!response.ok) {
        setMessage(payload?.error ?? "Something went wrong.");
        return;
      }
      const added = payload?.testimonials ?? [];
      if (added.length > 0) {
        setTestimonials((prev) => [...added, ...prev]);
      }
      const errorText = payload?.errors?.length ? ` (${payload.errors.join(" ")})` : "";
      setMessage(added.length > 0 ? `Added ${added.length} testimonial${added.length === 1 ? "" : "s"}.${errorText}` : `No testimonials were added.${errorText}`);
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/testimonials/${id}`, { method: "DELETE" });
      if (response.ok) {
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Customer Voice</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Website testimonials</h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          Add testimonials from your website, reviews, or anywhere customers have praised your business. We learn
          reusable knowledge from every one — never just storing the quote.
        </p>
      </header>

      <SectionCard title="Add a testimonial" subtitle="One at a time, in your own words or copied from your site.">
        <div className="space-y-3">
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Paste or type the testimonial..."
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Customer name (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || quote.trim().length === 0}
            onClick={() => {
              void submit("manual", { quote, authorName });
              setQuote("");
              setAuthorName("");
            }}
            className="hom-focusable rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add testimonial
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Bulk paste" subtitle="Paste many testimonials at once, separated by a blank line or '---'.">
        <div className="space-y-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"First testimonial...\n\nSecond testimonial..."}
            rows={6}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || pastedText.trim().length === 0}
            onClick={() => {
              void submit("bulk_paste", { pastedText });
              setPastedText("");
            }}
            className="hom-focusable rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Import pasted testimonials
          </button>
        </div>
      </SectionCard>

      <SectionCard title="CSV import" subtitle='Paste CSV text with a "quote" column (author, rating, source_url optional).'>
        <div className="space-y-3">
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"quote,author\n\"Great service!\",Jane Smith"}
            rows={6}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            disabled={busy || csvText.trim().length === 0}
            onClick={() => {
              void submit("csv_import", { csvText });
              setCsvText("");
            }}
            className="hom-focusable rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Import CSV
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Import from your website" subtitle="We'll look for testimonial-shaped quotes on the page.">
        <div className="space-y-3">
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourbusiness.com/testimonials"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || websiteUrl.trim().length === 0}
            onClick={() => {
              void submit("website_import", { websiteUrl });
              setWebsiteUrl("");
            }}
            className="hom-focusable rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Import from website
          </button>
        </div>
      </SectionCard>

      {message ? (
        <p className="text-sm text-navy-900" role="status">
          {message}
        </p>
      ) : null}

      <SectionCard title="Your testimonials" subtitle={`${testimonials.length} active`}>
        {testimonials.length === 0 ? (
          <p className="text-sm text-text-muted">No testimonials yet — add one above.</p>
        ) : (
          <ul className="space-y-4">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id} className="border-b border-slate-100 pb-4 last:border-b-0">
                <p className="text-sm leading-6 text-navy-900">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-text-muted">
                    {testimonial.author_name ?? "Anonymous"}
                    {testimonial.author_title ? `, ${testimonial.author_title}` : ""}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(testimonial.id)}
                    className="hom-focusable text-xs font-medium text-slate-500 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
