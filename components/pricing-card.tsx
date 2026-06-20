import { CtaButton } from "./cta-button";

type PricingCardProps = {
  name: string;
  price: number;
  description: string;
  highlights: readonly string[];
  featured?: boolean;
};

export function PricingCard({
  name,
  price,
  description,
  highlights,
  featured = false,
}: PricingCardProps) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-8 ${
        featured
          ? "border-brand-600 bg-brand-50 shadow-lg shadow-brand-100"
          : "border-slate-200 bg-white"
      }`}
    >
      {featured && (
        <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-700">
          Most popular
        </p>
      )}
      <h3 className="text-2xl font-bold text-slate-900">{name}</h3>
      <p className="mt-2 text-4xl font-bold text-slate-900">
        ${price}
        <span className="text-base font-medium text-slate-500">/mo</span>
      </p>
      <p className="mt-4 text-slate-600">{description}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {highlights.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-1 text-brand-600" aria-hidden="true">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <CtaButton
        variant={featured ? "primary" : "secondary"}
        className="mt-8 w-full"
      >
        See Your Free Demo
      </CtaButton>
    </div>
  );
}
