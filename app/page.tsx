import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { FeatureGrid } from "@/components/feature-grid";
import { FinalCta } from "@/components/final-cta";
import { HowItWorksSteps } from "@/components/how-it-works-steps";
import { PricingCard } from "@/components/pricing-card";
import { SectionHeading } from "@/components/section-heading";
import { pricingTiers, tagline, targetIndustries } from "@/lib/site-content";

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-700">
              For local service businesses
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              {tagline}
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">
              AJN Marketing helps contractors, trades, and local service
              businesses improve Google visibility, manage reviews, and publish
              local content — without the owner doing any marketing.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <CtaButton>See Your Free Demo</CtaButton>
              <CtaButton href="/how-it-works" variant="secondary">
                How It Works
              </CtaButton>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {targetIndustries.map((industry) => (
                <span
                  key={industry}
                  className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  {industry}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="The problem"
            title="You're great at the work. Marketing keeps getting in the way."
            description="Most local business owners didn't start a company to chase SEO reports, reply to every review, or figure out what to post on Google. Yet that's what it takes to stay visible — and most vendors make it harder, not easier."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              "Tired of SEO vendors who overpromise and underdeliver",
              "No time to manage Google, reviews, and content between jobs",
              "Unsure what's actually working in your town",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="The solution"
            title="Your Google presence, reviews, and local content — handled for you."
            description="We improve how you show up on Google, watch your reviews, and publish content that sounds like your business and your town. You approve from your phone. We do the rest."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              {
                title: "Google visibility",
                copy: "A stronger Business Profile and local presence so nearby customers find you first.",
              },
              {
                title: "Review management",
                copy: "New reviews monitored and professional reply drafts sent for your quick approval.",
              },
              {
                title: "Local content",
                copy: "Posts and updates written for your trade, your city, and the work you actually do.",
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

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="How it works"
            title="Five simple steps. Zero marketing homework."
            description="We scan your presence, create updates, get your approval, publish, and report back every week."
          />
          <div className="mt-12">
            <HowItWorksSteps compact />
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/how-it-works"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              See the full process →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="What's included"
            title="Everything you need to stay visible locally"
            description="Built for owners who want results without learning marketing."
          />
          <div className="mt-12">
            <FeatureGrid />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border border-brand-200 bg-brand-50 px-8 py-12 text-center sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              Our guarantee
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              90-day visibility guarantee
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              If we don&apos;t improve your local Google visibility within 90
              days, we&apos;ll work for free until we do. No fine print. No
              runaround.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple monthly plans"
            description="Choose the level that fits your business. Every plan starts with a free demo."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <PricingCard key={tier.name} {...tier} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Compare all plan details →
            </Link>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
