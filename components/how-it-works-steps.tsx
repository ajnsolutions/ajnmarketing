import { howItWorksSteps } from "@/lib/site-content";

type HowItWorksStepsProps = {
  compact?: boolean;
};

export function HowItWorksSteps({ compact = false }: HowItWorksStepsProps) {
  return (
    <div
      className={`grid gap-6 ${
        compact
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {howItWorksSteps.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {item.step}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
