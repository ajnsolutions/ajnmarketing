import Link from "next/link";
import { MarketingAgentRefreshButton } from "@/components/dashboard/marketing-agent-actions";
import { MarketingAgentTaskCard } from "@/components/dashboard/marketing-agent-task-card";
import type { MarketingAgentTasksPageData } from "@/lib/marketing-agent/types";

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-8 text-center ring-1 ring-slate-200/60">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function MarketingAgentTasksPage({ data }: { data: MarketingAgentTasksPageData }) {
  const activeTasks = data.tasks.filter(
    (task) => task.status === "pending" || task.status === "in_progress"
  );
  const highPriority = activeTasks.filter((task) => task.priority === "high");
  const mediumPriority = activeTasks.filter((task) => task.priority === "medium" || task.priority === "low");
  const completedToday = data.tasks.filter((task) => task.status === "completed");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Today&apos;s Marketing Tasks
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Your AI Marketing Agent monitors your plan, approvals, publishing queue, and business
            intelligence to surface the highest-priority work for today.
          </p>
        </div>
        <MarketingAgentRefreshButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tasks Due Today", value: String(data.stats.dueToday) },
          { label: "High Priority", value: String(data.stats.highPriorityPending) },
          { label: "Completed Today", value: String(data.stats.completedToday) },
          {
            label: "Top Priority",
            value: data.stats.topPriority?.title ?? "None yet",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]"
          >
            <p className="text-sm font-medium text-text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-bold tracking-tight text-navy-900">{item.value}</p>
          </article>
        ))}
      </div>

      {data.stats.topPriority && (
        <SectionCard title="Today's Top Priority" subtitle="Start here">
          <MarketingAgentTaskCard task={data.stats.topPriority} />
        </SectionCard>
      )}

      {data.tasks.length === 0 ? (
        <SectionCard title="Today's Tasks" subtitle="AI-recommended work for today">
          <EmptyState message="No tasks yet. Click Refresh Tasks to let the AI Marketing Agent plan today's work." />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="High Priority" subtitle="Most important work for today">
            {highPriority.length === 0 ? (
              <EmptyState message="No high-priority tasks right now." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {highPriority.map((task) => (
                  <MarketingAgentTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Medium Priority" subtitle="Supporting tasks for today">
            {mediumPriority.length === 0 ? (
              <EmptyState message="No medium-priority tasks right now." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {mediumPriority.map((task) => (
                  <MarketingAgentTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Completed Today" subtitle="Work you've finished">
            {completedToday.length === 0 ? (
              <EmptyState message="Nothing completed yet today." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {completedToday.map((task) => (
                  <MarketingAgentTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/marketing-plan"
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          Open Marketing Plan →
        </Link>
        <Link
          href="/dashboard/approvals"
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          Open Approval Center →
        </Link>
        <Link
          href="/dashboard/publishing"
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          Open Publishing Queue →
        </Link>
      </div>
    </div>
  );
}
