import { FinalCta } from "@/components/final-cta";
import { HowItWorksSteps } from "@/components/how-it-works-steps";
import { SectionHeading } from "@/components/section-heading";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "How It Works",
  description:
    "Connect, learn, create, approve, publish, and improve — AJN Marketing handles local marketing while you stay in control with weekly approvals.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            align="left"
            eyebrow="How it works"
            title="Your marketing employee — with your approval at every step"
            description="You stay in control without doing the work. We handle Google, reviews, and local content while you focus on jobs, crews, and customers."
          />
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <HowItWorksSteps />
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="What you actually do"
            description="Most weeks, your entire job is reading one message and tapping approve."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              {
                title: "Approve updates",
                copy: "Review suggested profile changes, review replies, and content posts by email or text.",
              },
              {
                title: "Read your report",
                copy: "Get a short weekly summary in plain English — no dashboards required.",
              },
              {
                title: "Run your business",
                copy: "That’s it. We handle the rest while you stay focused on the work that pays.",
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

      <FinalCta
        title="Ready to stop worrying about marketing?"
        description="Get started with a free demo built for your business — no contracts, no marketing homework."
      />
    </>
  );
}
