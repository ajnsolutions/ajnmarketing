import { CtaButton } from "@/components/cta-button";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-28 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
        404
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-[-0.02em] text-navy-900">
        Page not found
      </h1>
      <p className="mt-5 text-lg leading-8 text-text-muted">
        That page doesn’t exist or moved. Head back home or request a free demo.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <CtaButton href="/" variant="secondary">
          Back to home
        </CtaButton>
        <CtaButton href="/demo" showArrow>
          Get Started
        </CtaButton>
      </div>
    </section>
  );
}
