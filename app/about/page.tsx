import { CtaButton } from "@/components/cta-button";
import { FinalCta } from "@/components/final-cta";
import { SectionHeading } from "@/components/section-heading";
import { getStartedHref } from "@/lib/site-content";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "AJN Marketing helps local service businesses stay visible and market consistently — with weekly human approval, not another AI dashboard.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            align="left"
            eyebrow="About"
            title="Built for owners who don’t have time to be marketers"
            description="AJN Marketing exists so contractors, trades, and local service businesses can stay visible without hiring a full marketing team or living inside another dashboard."
          />
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-3xl space-y-8 px-6 text-lg leading-8 text-slate-600">
          <p>
            Most small business owners know marketing matters. What they don&apos;t
            have is spare hours every week to post, reply to reviews, update
            Google, and figure out what to say next.
          </p>
          <p>
            We built AJN Marketing to act like a marketing employee: connect to
            your business, learn your market, create useful updates, get your
            approval, publish, and improve over time.
          </p>
          <p>
            AI helps us draft and prioritize. You stay in control. Nothing goes
            live without your OK — usually from one weekly email.
          </p>
          <p>
            We&apos;re focused on local service businesses first, growing carefully
            with real pilot customers, and staying honest about what the product
            does today.
          </p>
          <div className="pt-4">
            <CtaButton href={getStartedHref} showArrow>
              Get Started
            </CtaButton>
          </div>
        </div>
      </section>

      <FinalCta
        title="Want to see if AJN fits your business?"
        description="Request a free demo — we’ll walk through Google visibility, reviews, and weekly approval for your market."
      />
    </>
  );
}
