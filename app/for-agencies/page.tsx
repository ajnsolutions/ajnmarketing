import { CtaButton } from "@/components/cta-button";
import { FinalCta } from "@/components/final-cta";
import { SectionHeading } from "@/components/section-heading";

export const metadata = {
  title: "For Agencies",
  description:
    "White-label AJN Marketing for small agencies and local SEO shops serving contractors and trades.",
};

export default function ForAgenciesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            align="left"
            eyebrow="For agencies"
            title="White-label local visibility your clients will actually understand"
            description="Resell AJN Marketing under your brand. We handle Google presence, reviews, and local content for contractors and trades — so you can serve more clients without hiring a full marketing team."
          />
          <div className="mt-8">
            <CtaButton>Partner With Us</CtaButton>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="Built for small agencies and local SEO shops"
            description="If your clients are plumbers, roofers, HVAC companies, and landscapers — not enterprise brands — this is for you."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "White-label delivery",
                copy: "Your clients see your brand. We work behind the scenes on Google, reviews, and content.",
              },
              {
                title: "Plain-English reporting",
                copy: "Weekly reports you can forward as-is — clear enough for busy owners, professional enough for your agency.",
              },
              {
                title: "Approval flow included",
                copy: "Clients approve by email or text. No extra tools for you to manage or train them on.",
              },
              {
                title: "Predictable fulfillment",
                copy: "Consistent monthly delivery across profiles, reviews, and local content at scale.",
              },
              {
                title: "Trade-focused content",
                copy: "Local-aware content written for service businesses — not generic blog posts that miss the mark.",
              },
              {
                title: "Room to grow",
                copy: "Add clients without adding headcount. We help you expand your local service offering profitably.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHeading
              align="left"
              title="How agency partnerships work"
              description="We keep it simple so you can focus on sales and client relationships."
            />
            <ol className="space-y-4">
              {[
                "You bring the client relationship and billing.",
                "We deliver Google visibility, reviews, and local content under your brand.",
                "Clients approve updates through our email/SMS flow.",
                "You receive reports you can share — or we send them white-labeled.",
                "You set your price. We provide wholesale fulfillment.",
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-7 text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Serve more local clients without burning out your team
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Request a demo to see how AJN Marketing fits your agency workflow
            and client mix.
          </p>
          <div className="mt-8">
            <CtaButton>Get Started</CtaButton>
          </div>
        </div>
      </section>

      <FinalCta
        title="Let's build your white-label local offering"
        description="See a demo built for agency partners serving contractors, trades, and local service businesses."
      />
    </>
  );
}
