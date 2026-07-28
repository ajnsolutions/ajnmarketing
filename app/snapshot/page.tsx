import { Suspense } from "react";
import { SnapshotFlow } from "@/components/snapshot/snapshot-flow";
import { buildPageMetadata, organizationJsonLd } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Scan My Business — Free Snapshot",
  description:
    "See what AJN Marketing already understands about your business — for free, before you create an account.",
  path: "/snapshot",
});

export default function SnapshotPage() {
  const jsonLd = {
    ...organizationJsonLd(),
    "@type": ["Organization", "WebApplication"],
    name: "AJN Marketing Free Business Snapshot",
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="bg-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white py-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.08),transparent_55%)]"
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted shadow-sm ring-1 ring-slate-900/[0.03]">
            <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
            Free — no account required
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-[-0.03em] text-navy-900 sm:text-5xl">
            Let&apos;s see what your business looks like online.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-text-muted">
            Enter your website and I&apos;ll study what&apos;s already public — then tell you what I learned, in plain
            language.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:p-10">
          <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Loading…</div>}>
            <SnapshotFlow />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
