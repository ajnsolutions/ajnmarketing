import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { SectionHeading } from "@/components/section-heading";
import { getStartedHref } from "@/lib/site-content";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Contact AJN Marketing about demos, partnerships, or questions about local Google visibility and weekly approval marketing.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white py-20">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          align="left"
          eyebrow="Contact"
          title="Talk with us"
          description="Questions about fit, onboarding, agency partnerships, or the 90-day visibility guarantee? We’re happy to help."
        />

        <div className="mt-12 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Fastest path</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Request a free demo and tell us about your business. We&apos;ll follow
              up with a personalized walkthrough.
            </p>
            <div className="mt-5">
              <CtaButton href={getStartedHref} showArrow>
                Get Started
              </CtaButton>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-bold text-navy-900">Email</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Prefer email? Reach us at{" "}
              <a
                href="mailto:hello@ajnmarketing.com"
                className="font-semibold text-brand-700 hover:text-brand-600"
              >
                hello@ajnmarketing.com
              </a>
              .
            </p>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-bold text-navy-900">Already a customer?</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              <Link
                href="/login"
                className="font-semibold text-brand-700 hover:text-brand-600"
              >
                Log in
              </Link>{" "}
              to your dashboard, or use the support path shared during onboarding.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
