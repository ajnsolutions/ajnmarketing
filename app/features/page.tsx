import { CtaButton } from "@/components/cta-button";
import { FinalCta } from "@/components/final-cta";
import { SectionHeading } from "@/components/section-heading";
import { features, getStartedHref, platformPillars } from "@/lib/site-content";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Features",
  description:
    "Be found, stay active, build trust, and learn & improve — Google Business Profile, reviews, local content, Market Context, and weekly approval.",
  path: "/features",
});

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            align="left"
            eyebrow="Features"
            title="Everything your marketing employee handles"
            description="AJN Marketing is built around outcomes for local service businesses — not feature checklists for marketers."
          />
          <div className="mt-8">
            <CtaButton href={getStartedHref} showArrow>
              Get Started
            </CtaButton>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {platformPillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <h2 className="text-2xl font-bold text-navy-900">{pillar.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {pillar.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {pillar.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-6 text-slate-700"
                    >
                      <span className="text-brand-600" aria-hidden="true">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="What that looks like week to week"
            description="Capabilities that already exist in the product — explained in plain English."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-lg font-bold text-navy-900">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
