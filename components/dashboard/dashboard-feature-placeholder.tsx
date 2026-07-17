import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";

const FEATURE_COPY: Record<
  string,
  { title: string; description: string; actionLabel?: string; actionHref?: string }
> = {
  Analytics: {
    title: "Results live next door",
    description:
      "What's improving now lives under Results — visibility, reviews, engagement, and progress over time.",
    actionLabel: "Open Results",
    actionHref: "/dashboard/results",
  },
  "Market Context": {
    title: "I'm still gathering local context",
    description:
      "When local and seasonal signals are ready, I'll fold the useful parts into your Weekly Briefing.",
    actionLabel: "Your Head of Marketing",
    actionHref: "/dashboard",
  },
  Notifications: {
    title: "Notifications are coming soon",
    description:
      "For now, your Weekly Briefing is the calm place I'll ask for your opinion — no noisy alerts.",
    actionLabel: "Your Head of Marketing",
    actionHref: "/dashboard",
  },
  Settings: {
    title: "Settings are coming soon",
    description:
      "Team access and preferences will live here later. Google Profile and brand voice are available today.",
    actionLabel: "Open Google Profile",
    actionHref: "/dashboard/google-business-profile",
  },
  Billing: {
    title: "Billing is coming soon",
    description:
      "Subscription and invoices will appear here when billing is enabled for your business.",
    actionLabel: "Back to Settings",
    actionHref: "/dashboard/settings",
  },
};

export function DashboardFeaturePlaceholder({ title }: { title: string }) {
  const copy = FEATURE_COPY[title] ?? {
    title: `${title} is coming soon`,
    description: "I'll let you know when this is ready — nothing important is locked away.",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Configuration stays separate from your Weekly Briefing so setup never interrupts our
          check-in.
        </p>
      </div>
      <DashboardEmptyState {...copy} />
    </div>
  );
}
