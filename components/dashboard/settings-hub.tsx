import Link from "next/link";
import { OrientationNote, PageHeader } from "@/components/dashboard/ui/page-chrome";

const FOUNDATION_LINKS = [
  {
    href: "/dashboard/setup",
    label: "Setup checklist",
    description: "See what is required, optional, blocked, or ready — and what to do next.",
  },
  {
    href: "/dashboard/setup/business",
    label: "Business information",
    description: "Name, industry, location, and contact basics.",
  },
  {
    href: "/dashboard/setup/goals",
    label: "Marketing goals",
    description: "What success looks like for your marketing.",
  },
  {
    href: "/dashboard/brand-voice",
    label: "Brand voice",
    description: "How drafts should sound before you approve them.",
  },
  {
    href: "/dashboard/ai-profile",
    label: "Marketing profile",
    description: "Reusable business summary for plans and content.",
  },
  {
    href: "/dashboard/website-analysis",
    label: "Website understanding",
    description: "What I've learned from your website so far.",
  },
  {
    href: "/dashboard/marketing-plan",
    label: "This month's plan",
    description: "Themes and focus for the current month.",
  },
  {
    href: "/dashboard/google-business-profile",
    label: "Google Profile",
    description: "Optional connection for local posts, reviews, and insights.",
  },
  {
    href: "/dashboard/marketing-preferences",
    label: "Marketing preferences",
    description: "Standing instructions I should remember (days to avoid, context to skip).",
  },
] as const;

const ACCOUNT_LINKS = [
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    description: "How you'll hear about approvals and important updates (coming soon).",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    description: "Subscription and invoices (coming soon).",
  },
] as const;

function SettingsLinkList({
  items,
}: {
  items: readonly { href: string; label: string; description: string }[];
}) {
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="hom-focusable flex min-h-11 flex-col justify-center gap-1 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
          >
            <span className="text-sm font-semibold text-navy-900">{item.label}</span>
            <span className="text-sm leading-6 text-text-muted">{item.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Configuration hub — kept separate from the Head of Marketing relationship.
 * Presentation only; routes and engines unchanged.
 */
export function SettingsHub() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="How I work with your business"
        description="Adjust foundation and account preferences here. Your weekly check-in stays on Head of Marketing."
        showBack
      />
      <OrientationNote
        whyItMatters="Clear setup and preferences keep drafts and plans accurate."
        whatHappensNext="Finish foundation items first, then return to Head of Marketing for priorities."
      />

      <section className="space-y-3" aria-labelledby="settings-foundation-heading">
        <h2 id="settings-foundation-heading" className="text-lg font-bold text-navy-900">
          Marketing foundation
        </h2>
        <p className="text-sm text-text-muted">
          Business basics, voice, profile, plan, and optional Google connection.
        </p>
        <SettingsLinkList items={FOUNDATION_LINKS} />
      </section>

      <section className="space-y-3" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading" className="text-lg font-bold text-navy-900">
          Account
        </h2>
        <p className="text-sm text-text-muted">Notifications and billing stay separate from strategy.</p>
        <SettingsLinkList items={ACCOUNT_LINKS} />
      </section>

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
