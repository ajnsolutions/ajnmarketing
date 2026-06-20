import { features } from "@/lib/site-content";

export function FeatureGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <article
          key={feature.title}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {feature.description}
          </p>
        </article>
      ))}
    </div>
  );
}
