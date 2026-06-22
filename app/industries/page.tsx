import { CtaButton } from "@/components/cta-button";
import { FinalCta } from "@/components/final-cta";
import { SectionHeading } from "@/components/section-heading";

const industries = [
  {
    name: "Plumbing",
    description:
      "Rank for emergency and service calls in your city with a stronger Google presence and review reputation.",
  },
  {
    name: "HVAC",
    description:
      "Stay visible for seasonal heating and cooling searches when homeowners need help fast.",
  },
  {
    name: "Electrical",
    description:
      "Build trust with local homeowners and commercial clients searching for licensed electricians.",
  },
  {
    name: "Roofing",
    description:
      "Show up for storm damage, repairs, and replacement searches in your service area.",
  },
  {
    name: "Insurance Agencies",
    description:
      "Improve local discoverability and credibility when prospects compare agencies online.",
  },
  {
    name: "Contractors",
    description:
      "Win more project inquiries with better Google visibility, reviews, and local content.",
  },
] as const;

export const metadata = {
  title: "Industries",
  description:
    "AJN Marketing helps plumbers, HVAC companies, electricians, roofers, insurance agencies, and contractors get found on Google.",
};

export default function IndustriesPage() {
  return (
    <>
      <section className="border-b border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            align="left"
            eyebrow="Industries"
            title="Built for local service businesses"
            description="We help trades and local service companies improve Google visibility, manage reviews, and generate more leads — without adding marketing work to your plate."
          />
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => (
              <article
                key={industry.name}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <h2 className="text-xl font-bold text-navy-900">{industry.name}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {industry.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-navy-900">
            Don&apos;t see your industry listed?
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            If you serve local customers, we can likely help. Request a free demo
            and we&apos;ll show you what&apos;s possible for your business.
          </p>
          <div className="mt-8">
            <CtaButton>Get My Free Demo</CtaButton>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
