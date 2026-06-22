import { AjnLogo } from "@/components/ajn-logo";
import { DemoFaq } from "@/components/demo/demo-faq";
import { DemoGbpMockup } from "@/components/demo/demo-gbp-mockup";
import { DemoForm } from "./demo-form";

export const metadata = {
  title: "Free Demo",
  description:
    "Request a free demo and see how AJN Marketing improves your Google visibility, reviews, and local customer reach.",
};

const trustBadges = [
  "90-Day Visibility Guarantee",
  "Built For Local Businesses",
  "No Marketing Experience Required",
] as const;

const receiveCards = [
  {
    title: "Google Visibility Analysis",
    description:
      "See how your business appears on Google and where opportunities exist.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      </svg>
    ),
  },
  {
    title: "Competitor Snapshot",
    description:
      "Discover what nearby competitors are doing differently.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-6" />
      </svg>
    ),
  },
  {
    title: "AI Content Preview",
    description:
      "See example content generated specifically for your business.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.2 3.6L17 8l-3.6 1.2L12 13l-1.2-3.6L7 8l3.6-1.2L12 3ZM5 18l.6 1.8L7.4 20l-1.8.6L5 22.4l-.6-1.8L2.6 20l1.8-.6L5 18Zm14 0l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" />
      </svg>
    ),
  },
] as const;

const timelineSteps = [
  {
    step: "1",
    title: "Submit Your Website",
    description: "Tell us about your business in a quick form.",
  },
  {
    step: "2",
    title: "We Analyze Your Online Presence",
    description: "We review your Google profile, reviews, and local visibility.",
  },
  {
    step: "3",
    title: "Receive Your Custom Demo",
    description: "Get a personalized look at how you could rank higher and win more customers.",
  },
] as const;

function ScrollToFormButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "light";
  className?: string;
}) {
  const styles =
    variant === "light"
      ? "bg-white text-brand-700 shadow-lg shadow-black/10 hover:bg-slate-50"
      : "bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700";

  return (
    <a
      href="#demo-form"
      className={`inline-flex items-center justify-center rounded-full px-7 py-3.5 text-base font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${styles} ${className}`}
    >
      {children}
    </a>
  );
}

function SectionHeading({
  title,
  description,
  light = false,
}: {
  title: string;
  description?: string;
  light?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2
        className={`text-3xl font-bold tracking-[-0.02em] sm:text-4xl ${
          light ? "text-white" : "text-navy-900"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 text-lg leading-8 ${
            light ? "text-slate-300" : "text-text-muted"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="bg-surface">
      {/* Section 1 — Hero */}
      <section className="demo-fade-section relative overflow-hidden border-b border-slate-200/80 bg-white py-16 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.06),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(248,250,252,0.9),rgba(255,255,255,0))]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <AjnLogo size={44} />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Free Demo
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-[-0.03em] text-navy-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              See Exactly How Your Business Could Rank Higher On Google
            </h1>
            <p className="mt-6 text-lg leading-8 text-text-muted sm:text-xl">
              Enter your website and we&apos;ll show you how AJN Marketing can
              improve your Google visibility, reviews, and local customer reach.
            </p>

            <ul className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {trustBadges.map((badge) => (
                <li
                  key={badge}
                  className="flex items-center gap-2 text-sm font-medium text-navy-800"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs text-brand-600 ring-1 ring-brand-100">
                    ✓
                  </span>
                  {badge}
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <ScrollToFormButton>Get My Free Demo</ScrollToFormButton>
            </div>
          </div>

          <div className="hidden lg:block">
            <DemoGbpMockup />
          </div>
        </div>
      </section>

      {/* Section 2 — What You'll Receive */}
      <section className="demo-fade-section border-b border-slate-200/80 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading title="Your Free Demo Includes" />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {receiveCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100/80">
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-navy-900">{card.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-muted">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — Existing Form (unchanged logic) */}
      <section
        id="demo-form"
        className="demo-fade-section scroll-mt-28 border-b border-slate-200/80 bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/[0.04] sm:p-8 lg:p-10">
            <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              Request Your Free Demo
            </h2>
            <p className="mt-3 text-base leading-7 text-text-muted">
              We&apos;ll analyze your online presence and show opportunities to
              increase visibility and customer engagement.
            </p>
            <div className="mt-8">
              <DemoForm />
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 — How It Works */}
      <section className="demo-fade-section border-b border-slate-200/80 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="Simple. Fast. Done For You."
            description="Three steps from your website to a personalized growth demo."
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {timelineSteps.map((item, index) => (
              <article
                key={item.title}
                className="relative rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {index < timelineSteps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-1/2 hidden h-px w-6 translate-x-full bg-slate-200 lg:block"
                  />
                )}
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-md shadow-brand-600/25">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-navy-900">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-muted">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — Risk Reversal */}
      <section className="demo-fade-section bg-navy-900 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-growth-50 px-4 py-2 text-sm font-semibold text-growth-500 ring-1 ring-emerald-200">
            <span aria-hidden="true">✓</span>
            90-Day Visibility Guarantee
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
            Marketing Shouldn&apos;t Feel Like A Gamble.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Most local business owners have been burned by marketing companies.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            That&apos;s why AJN Marketing includes a 90-Day Visibility
            Guarantee. If your Google Business Profile visibility doesn&apos;t
            improve, you don&apos;t pay.
          </p>
        </div>
      </section>

      {/* Section 6 — FAQ */}
      <section className="demo-fade-section border-b border-slate-200/80 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading title="Frequently Asked Questions" />
          <div className="mt-14">
            <DemoFaq />
          </div>
        </div>
      </section>

      {/* Section 7 — Final CTA */}
      <section className="demo-fade-section bg-navy-900 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionHeading
            light
            title="Get Found By More Local Customers"
            description="See what AJN Marketing can do for your business before spending a dollar."
          />
          <div className="mt-10">
            <ScrollToFormButton variant="light">Get My Free Demo</ScrollToFormButton>
          </div>
        </div>
      </section>
    </div>
  );
}
