import Link from "next/link";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";

const FEATURE_COPY: Record<
  string,
  { title: string; description: string; actionLabel?: string; actionHref?: string }
> = {
  Analytics: {
    title: "Analytics coming soon",
    description:
      "Performance analytics will appear here once your website analysis, Google Business Profile, and publishing activity are connected.",
    actionLabel: "Open Command Center",
    actionHref: "/dashboard/command-center",
  },
  "Market Context": {
    title: "Market context coming soon",
    description:
      "Competitive and local market insights will appear here once live monitoring is enabled for your business.",
    actionLabel: "Open Command Center",
    actionHref: "/dashboard/command-center",
  },
  Notifications: {
    title: "Notifications coming soon",
    description:
      "Approval updates, publishing reminders, and review alerts will appear here as workflow notifications are enabled.",
    actionLabel: "Open Approval Center",
    actionHref: "/dashboard/approvals",
  },
  Settings: {
    title: "Settings coming soon",
    description:
      "Team access, notification preferences, and workspace settings will be available in a future release.",
  },
  Billing: {
    title: "Billing coming soon",
    description:
      "Subscription and invoice management will be available here when billing is enabled for your workspace.",
  },
};

export function DashboardFeaturePlaceholder({ title }: { title: string }) {
  const copy = FEATURE_COPY[title] ?? {
    title: `${title} coming soon`,
    description: "This section will be available in a future release.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Manage your AJN Marketing workspace from one place.
        </p>
      </div>
      <DashboardEmptyState {...copy} />
    </div>
  );
}
