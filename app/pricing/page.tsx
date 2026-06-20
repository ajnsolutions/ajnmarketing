import { FinalCta } from "@/components/final-cta";
import { PricingCard } from "@/components/pricing-card";
import { SectionHeading } from "@/components/section-heading";
import { pricingTiers } from "@/lib/site-content";

export const metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for local service businesses. Starter $99/mo, Growth $199/mo, Pro $299/mo.",
};

export default function PricingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Straightforward plans. No surprises."
            description="Every plan includes Google visibility support, review monitoring, and our 90-day visibility guarantee. Start with a free demo to see what we'd do for your business."
          />
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <PricingCard key={tier.name} {...tier} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="What's included in every plan"
            description="All plans are month-to-month. Cancel anytime."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
            {[
              "Google Business Profile optimization",
              "Review monitoring and reply drafts",
              "Email/SMS approval flow",
              "Weekly plain-English reports",
              "90-day visibility guarantee",
              "Dedicated support from a real team",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700"
              >
                <span className="text-brand-600" aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Not sure which plan fits?
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Request a free demo and we&apos;ll recommend the right plan based on
            your market, competition, and goals.
          </p>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
