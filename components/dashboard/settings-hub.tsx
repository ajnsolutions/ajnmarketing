import Link from "next/link";

const SETTINGS_LINKS = [
  {
    href: "/dashboard/google-business-profile",
    label: "Google Profile",
    description: "Connect and manage how customers find you on Google.",
  },
  {
    href: "/dashboard/brand-voice",
    label: "Brand voice",
    description: "How I write and speak on behalf of your business.",
  },
  {
    href: "/dashboard/marketing-preferences",
    label: "Marketing preferences",
    description: "Standing instructions I should remember (days to avoid, context to skip).",
  },
  {
    href: "/dashboard/website-analysis",
    label: "Website understanding",
    description: "What I've learned from your website so far.",
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    description: "How you'd like me to reach you (coming soon).",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    description: "Subscription and invoices (coming soon).",
  },
] as const;

/**
 * Configuration hub — kept separate from the Head of Marketing relationship.
 * Presentation only; routes and engines unchanged.
 */
export function SettingsHub() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">Settings</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-text-muted">
          Adjust how I work with your business. This stays separate from your Weekly Briefing so
          setup never interrupts our check-in.
        </p>
      </header>

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        {SETTINGS_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="hom-focusable flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
            >
              <span className="text-sm font-semibold text-navy-900">{item.label}</span>
              <span className="text-sm leading-6 text-text-muted">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm leading-7 text-text-muted">
        Looking for this week&apos;s review? Start from{" "}
        <Link
          href="/dashboard"
          className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
        >
          Your Head of Marketing
        </Link>
        .
      </p>
    </div>
  );
}
