import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { HeroMarketingVisual } from "@/components/home/hero-marketing-visual";
import { PricingCard } from "@/components/pricing-card";
import { SectionHeading } from "@/components/section-heading";
import {
  getStartedHref,
  guaranteeSummary,
  howItWorksSteps,
  platformPillars,
  pricingTiers,
  weeklyApprovalSteps,
} from "@/lib/site-content";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">
      {children}
    </p>
  );
}

export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(248,250,252,1))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.08),transparent_50%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted shadow-sm ring-1 ring-slate-900/[0.03]">
            <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
            For local service businesses
          </div>

          <h1 className="max-w-xl text-[2.45rem] font-bold tracking-[-0.03em] text-navy-900 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
            Stop worrying about marketing.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-text-muted sm:text-xl sm:leading-9">
            AJN Marketing keeps your business visible, creates your marketing,
            manages your reviews, and helps you stay discoverable — while you
            focus on running your business.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaButton href={getStartedHref} showArrow className="w-full sm:w-auto">
              Get Started
            </CtaButton>
            <CtaButton
              href="/how-it-works"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              See How It Works
            </CtaButton>
          </div>

          <p className="mt-6 text-sm leading-6 text-slate-600">
            Your marketing employee — with weekly approval, not another dashboard
            to manage.
          </p>
        </div>

        <HeroMarketingVisual />
      </div>
    </section>
  );
}

export function HomeProblem() {
  return (
    <section className="border-y border-slate-200/80 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>The problem</SectionEyebrow>
          <h2 className="text-3xl font-bold tracking-[-0.02em] text-navy-900 sm:text-4xl">
            Marketing falls behind when you&apos;re busy doing the work.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Small business owners don&apos;t have time to market consistently.
            Customers now search in more places than ever — Google, Maps, and AI
            assistants — and businesses that publish trustworthy, local content
            stay easier to find.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "No time",
              copy: "Jobs, crews, and customers come first. Marketing gets postponed until visibility slips.",
            },
            {
              title: "More places to show up",
              copy: "People look you up on Google, Maps, and AI tools. Inconsistent information makes you harder to trust.",
            },
            {
              title: "Consistency wins",
              copy: "Businesses that keep useful, accurate content flowing stay visible longer than one-off campaigns.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-surface p-7 ring-1 ring-slate-900/[0.03]"
            >
              <h3 className="text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeSolution() {
  const flow = ["Connect", "Learn", "Create", "Approve", "Publish", "Improve"];

  return (
    <section className="bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="The solution"
          title="AJN Marketing becomes your marketing employee"
          description="Not another dashboard to babysit. We handle the day-to-day marketing work — and you approve before anything publishes."
        />

        <ol className="mt-14 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-2">
          {flow.map((step, index) => (
            <li key={step} className="flex items-center gap-2 lg:contents">
              <div className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-navy-900 shadow-sm lg:w-auto">
                <span className="mr-2 text-brand-600">{index + 1}.</span>
                {step}
              </div>
              {index < flow.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden text-slate-300 lg:inline"
                >
                  →
                </span>
              )}
              {index < flow.length - 1 && (
                <span
                  aria-hidden="true"
                  className="mx-auto text-slate-300 lg:hidden"
                >
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function HomeHowItWorks() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Six steps. You stay in control."
          description="We do the marketing work. You approve. Visibility keeps moving without you becoming a marketer."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {howItWorksSteps.map((step) => (
            <article
              key={step.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {step.step}
              </div>
              <h3 className="text-lg font-bold text-navy-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/how-it-works"
            className="text-sm font-semibold text-brand-700 hover:text-brand-600"
          >
            See the full walkthrough →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomePillars() {
  return (
    <section className="border-y border-slate-200/80 bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Platform pillars"
          title="Four jobs your marketing employee never drops"
          description="Built from what the product already does — Google visibility, content, reviews, and continuous improvement."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {platformPillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/[0.03]"
            >
              <h3 className="text-xl font-bold text-navy-900">{pillar.title}</h3>
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
        <div className="mt-10 text-center">
          <CtaButton href="/features" variant="secondary">
            Explore features
          </CtaButton>
        </div>
      </div>
    </section>
  );
}

export function HomeWeeklyApproval() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Weekly approval"
          title="Most weeks, your job is one message and a few taps"
          description="This is the differentiator: AI helps draft the work. You approve. AJN handles the rest."
        />
        <ol className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          {weeklyApprovalSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-surface p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-bold text-navy-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function HomeAiSearch() {
  return (
    <section className="bg-deep-navy py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-100">
            Modern discovery
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
            Customers search on Google — and with AI assistants
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            People increasingly look for local businesses using Google, Google
            Maps, ChatGPT, Gemini, Claude, Perplexity, and other tools. Consistent,
            trustworthy, locally relevant content helps your business stay
            discoverable across today&apos;s search landscape.
          </p>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            We help you publish accurate, useful information over time. We do not
            promise ranking inside any AI assistant or guaranteed AI placement.
          </p>
        </div>
      </div>
    </section>
  );
}

export function HomeTrust() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Trust"
          title="Built for owners who need control — not hype"
          description="We’re in active pilot with local service businesses. We don’t invent customer quotes. Here’s what you can count on."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Human approval every week",
              copy: "Nothing publishes without your OK. Approve by email or in your dashboard.",
            },
            {
              title: "You stay in control",
              copy: "Edit, skip, or reject recommendations. AJN works for you — not around you.",
            },
            {
              title: "Privacy & security minded",
              copy: "Business data stays scoped to your account. Ask us anytime about how we handle your information.",
            },
            {
              title: "Real team behind the product",
              copy: "AJN Marketing is built for contractors and local service owners — not generic enterprise software.",
            },
            {
              title: "Pilot-first honesty",
              copy: "We’re growing carefully with real businesses. Prefer proof over inflated logos and fake stars.",
            },
            {
              title: "Talk to us",
              copy: "Questions about fit, onboarding, or guarantees? Reach out — we’ll answer straight.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-surface p-6"
            >
              <h3 className="text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link href="/about" className="text-brand-700 hover:text-brand-600">
            About AJN →
          </Link>
          <Link href="/contact" className="text-brand-700 hover:text-brand-600">
            Contact →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeGuarantee() {
  return (
    <section className="border-y border-slate-200/80 bg-growth-50 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <SectionEyebrow>Guarantee</SectionEyebrow>
        <h2 className="text-3xl font-bold tracking-[-0.02em] text-navy-900 sm:text-4xl">
          90-day visibility guarantee
        </h2>
        <p className="mt-5 text-lg leading-8 text-slate-700">{guaranteeSummary}</p>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Month-to-month plans. Cancel anytime. Details discussed during your demo.
        </p>
      </div>
    </section>
  );
}

export function HomePricingTeaser() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Straightforward plans. No surprises."
          description="Start with a free demo. We’ll recommend the right plan for your market and goals."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <PricingCard key={tier.name} {...tier} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-brand-700 hover:text-brand-600"
          >
            Compare plans in detail →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeFinalCta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#081426] to-[#0B1426] py-20 sm:py-24">
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready for a marketing employee that never drops the ball?
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          Get started with a free demo built around your business — Google
          presence, reviews, and local content included.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CtaButton href={getStartedHref} variant="light" showArrow>
            Get Started
          </CtaButton>
          <CtaButton
            href="/how-it-works"
            variant="secondary"
            className="border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5 hover:text-white"
          >
            See How It Works
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
