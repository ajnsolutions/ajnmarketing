import { AiDemoFlow } from "@/components/ai-demo/ai-demo-flow";
import { buildPageMetadata, organizationJsonLd } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Interactive AI Marketing Demo",
  description:
    "See what AJN Marketing would do for your business: website snapshot, marketing profile, recommendations, example content, and weekly approval workflow.",
  path: "/ai-demo",
});

export default function AiDemoPage() {
  const jsonLd = {
    ...organizationJsonLd(),
    "@type": ["Organization", "WebApplication"],
    name: "AJN Marketing Interactive Demo",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <div className="bg-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white py-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.08),transparent_55%)]"
        />

        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted shadow-sm ring-1 ring-slate-900/[0.03]">
            <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
            Interactive marketing demo
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-[-0.03em] text-navy-900 sm:text-5xl">
            Experience AJN Marketing before you sign up
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-text-muted">
            Not an SEO score. A guided preview of how AJN would analyze your
            website, prioritize recommendations, draft example content, and help
            every week — with your approval.
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
