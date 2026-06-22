import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeading({
  title,
  description,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`mx-auto max-w-2xl text-center ${className}`}>
      <h2 className="text-3xl font-bold tracking-[-0.02em] text-navy-900 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-lg leading-8 text-slate-600">{description}</p>
      )}
    </div>
  );
}

export function StatCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white px-6 py-9 text-center shadow-md shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <p className="text-4xl font-bold tracking-tight text-navy-900 sm:text-5xl">
        {value}
      </p>
      <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{label}</p>
    </article>
  );
}

export function FeatureCard({
  icon,
  title,
  description,
  iconVariant = "blue",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  iconVariant?: "blue" | "green";
}) {
  const iconStyles =
    iconVariant === "green"
      ? "rounded-full bg-growth-50 text-growth-500 ring-1 ring-emerald-100"
      : "rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100/80";

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className={`mb-5 inline-flex h-12 w-12 items-center justify-center ${iconStyles}`}
      >
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight text-navy-900">{title}</h3>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </article>
  );
}

export function IndustryCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-brand-600 ring-1 ring-slate-100">
        {icon}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-navy-900">{title}</h3>
      <p className="mt-2.5 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

export function TestimonialCard({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) {
  return (
    <blockquote className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <p className="text-amber-500" aria-label="5 out of 5 stars">
        ★★★★★
      </p>
      <p className="mt-4 flex-1 text-base leading-7 text-slate-600">
        &ldquo;{quote}&rdquo;
      </p>
      <footer className="mt-8 border-t border-slate-100 pt-6">
        <p className="font-semibold text-navy-900">{name}</p>
        <p className="mt-1 text-sm text-slate-500">{role}</p>
      </footer>
    </blockquote>
  );
}
