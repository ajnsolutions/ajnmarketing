import { CtaButton } from "@/components/cta-button";
import { HeroMarketingVisual } from "@/components/home/hero-marketing-visual";
import { HeroTrustBar } from "@/components/home/hero-trust-bar";
import {
  FeatureCard,
  IndustryCard,
  SectionHeading,
  TestimonialCard,
} from "@/components/home/home-sections";
import { StatsStrip } from "@/components/home/stats-strip";

const processCards = [
  {
    title: "Optimize",
    description:
      "We improve your Google Business Profile, local listings, and online presence so you show up in more searches.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      </svg>
    ),
  },
  {
    title: "Promote",
    description:
      "We create local content and visibility strategies that help the right customers find your business.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9v6h2l5 5V4L6 9H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 9a3 3 0 1 1 0 6" />
      </svg>
    ),
  },
  {
    title: "Convert",
    description:
      "We turn visibility into phone calls, leads, appointments, and real revenue for your business.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 6l3-3 3 3M19 3v5" />
      </svg>
    ),
  },
] as const;

const industriesServed = [
  {
    title: "Plumbing",
    description: "Help homeowners find your business when they need service fast.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h4v4M10 20H6v-4M20 10l-8 8M6 6l4 4" />
      </svg>
    ),
  },
  {
    title: "HVAC",
    description: "Stay visible when customers search for heating and cooling help.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" />
      </svg>
    ),
  },
  {
    title: "Electrical",
    description: "Build trust with homeowners searching for licensed electricians.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
    ),
  },
  {
    title: "Roofing",
    description: "Show up for repair, replacement, and storm damage searches.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 9-9 9 9M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    title: "Insurance",
    description: "Improve local discoverability when prospects compare agencies.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
  {
    title: "Landscaping",
    description: "Get found by homeowners looking for lawn and outdoor services.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V8M8 12c-3-2-4-6 0-8 4 2 4 6 0 8M16 12c3-2 4-6 0-8-4 2-4 6 0 8" />
      </svg>
    ),
  },
] as const;

const testimonials = [
  {
    quote:
      "AJN helped us improve our visibility on Google and brought in more calls from local customers.",
    name: "Mike R.",
    role: "Plumbing Business Owner",
  },
  {
    quote:
      "We used to struggle with reviews and online visibility. Now our Google presence looks professional and active every week.",
    name: "Sarah T.",
    role: "HVAC Company Owner",
  },
  {
    quote:
      "The best part is that we don't have to manage the marketing ourselves. AJN keeps everything moving.",
    name: "Daniel M.",
    role: "Roofing Contractor",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(248,250,252,1))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.08),transparent_50%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(34,197,94,0.05),transparent_45%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted shadow-sm ring-1 ring-slate-900/[0.03]">
              <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
              Local Marketing That Delivers Results
            </div>

            <h1 className="max-w-xl text-[2.85rem] font-bold tracking-[-0.03em] text-navy-900 sm:text-6xl lg:text-[4rem] lg:leading-[1.05]">
              More Visibility.
              <br />
              More Calls.
              <br />
              <span className="text-growth-500">More Customers.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-text-muted sm:text-xl sm:leading-9">
              We manage and optimize your Google Business Profile so local
              customers find your business before they find your competitors.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <CtaButton showArrow>See Your Free Demo</CtaButton>
              <CtaButton href="/how-it-works" variant="secondary">
                How It Works
              </CtaButton>
            </div>

            <HeroTrustBar />
          </div>

          <HeroMarketingVisual />
        </div>
      </section>

      <StatsStrip />

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
              Our Proven Process
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-navy-900 sm:text-4xl">
              How We Grow Your Business
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {processCards.map((card) => (
              <FeatureCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                description={card.description}
                iconVariant="green"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-surface py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="Industries We Serve"
            description="Purpose-built for local service businesses that depend on phone calls, appointments, and trust."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {industriesServed.map((industry) => (
              <IndustryCard
                key={industry.title}
                icon={industry.icon}
                title={industry.title}
                description={industry.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading title="Trusted By Local Business Owners" />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.name}
                quote={testimonial.quote}
                name={testimonial.name}
                role={testimonial.role}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#081426] to-[#0B1426] py-24 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.14) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,0.1),transparent_50%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-8 h-64 w-64 rounded-full border border-white/[0.04] sm:-right-12"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full border border-white/[0.03]"
        />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="text-lg leading-8 text-slate-200 sm:text-xl sm:leading-9">
            Get a free personalized demo and see how AJN Marketing can improve
            your online visibility.
          </p>
          <div className="mt-10">
            <CtaButton variant="light" showArrow>
              See Your Free Demo
            </CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
