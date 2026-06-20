import { CtaButton } from "./cta-button";

type FinalCtaProps = {
  title?: string;
  description?: string;
};

export function FinalCta({
  title = "Ready to show up when your town searches?",
  description = "See a free demo built for your business — no contracts, no marketing homework.",
}: FinalCtaProps) {
  return (
    <section className="bg-brand-700 py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-brand-100">
          {description}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <CtaButton className="bg-white text-brand-700 hover:bg-brand-50">
            See Your Free Demo
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
