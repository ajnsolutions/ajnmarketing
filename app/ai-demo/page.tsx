import { AiDemoFlow } from "@/components/ai-demo/ai-demo-flow";

export const metadata = {
  title: "AI Demo Preview",
  description:
    "See a free preview of how AJN Marketing could improve your Google visibility, reviews, and local customer reach.",
};

export default function AiDemoPage() {
  return (
    <div className="bg-surface">
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white py-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.08),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(248,250,252,0.4))]"
        />

        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted shadow-sm ring-1 ring-slate-900/[0.03]">
            <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
            Public AI Demo Preview
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-[-0.03em] text-navy-900 sm:text-5xl">
            See What AJN Marketing Could Do For Your Business
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-text-muted">
            Enter your website and business details to preview sample Google
            posts, social content, and local marketing ideas — built for business
            owners who want more calls without doing the marketing themselves.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AiDemoFlow />
        </div>
      </section>
    </div>
  );
}
