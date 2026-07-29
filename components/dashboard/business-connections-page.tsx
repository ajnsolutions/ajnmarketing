import Link from "next/link";
import {
  CAPABILITY_LABELS,
  CONNECTION_HEALTH_LABELS,
  CONNECTION_STATUS_LABELS,
  ConnectionStatuses,
  type BusinessConnection,
  type BusinessConnectionsSnapshot,
} from "@/lib/business-connections/types";

function statusClass(status: BusinessConnection["status"]): string {
  switch (status) {
    case ConnectionStatuses.CONNECTED:
      return "text-brand-700";
    case ConnectionStatuses.NEEDS_ATTENTION:
      return "text-amber-700";
    case ConnectionStatuses.COMING_SOON:
      return "text-slate-500";
    default:
      return "text-slate-600";
  }
}

function ConnectionCard({ connection }: { connection: BusinessConnection }) {
  const primaryAction = connection.recommendedNextActions.find((a) => a.availableNow) ?? null;

  return (
    <article className="border-b border-slate-100 py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-navy-900">{connection.displayName}</p>
          <p className={`mt-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusClass(connection.status)}`}>
            {CONNECTION_STATUS_LABELS[connection.status]}
            {connection.status === ConnectionStatuses.CONNECTED
              ? ` · ${CONNECTION_HEALTH_LABELS[connection.health]}`
              : null}
          </p>
        </div>
        {primaryAction?.href ? (
          <Link
            href={primaryAction.href}
            className="hom-focusable shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {primaryAction.label}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          What will I learn if you connect this?
        </p>
        <p className="mt-1 text-sm leading-6 text-navy-900">{connection.whatYouLearn}</p>
      </div>

      <p className="mt-3 text-sm leading-6 text-text-muted">
        <span className="font-medium text-slate-600">Business Brain. </span>
        {connection.businessBrainContribution.summary}
      </p>

      {connection.availableCapabilities.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {connection.availableCapabilities.map((cap) => (
            <li
              key={cap}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {CAPABILITY_LABELS[cap]}
            </li>
          ))}
        </ul>
      ) : null}

      {connection.lastSyncAt ? (
        <p className="mt-3 text-xs text-text-muted">
          Last sync {new Date(connection.lastSyncAt).toLocaleString()}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Business Connections — customer experience.
 * Explains value in plain language; recommends one next connection.
 */
export function BusinessConnectionsPage({
  snapshot,
}: {
  snapshot: BusinessConnectionsSnapshot;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Business Connections
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Teach the Business Brain what you already have
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          Connections help me understand your business better. You stay in control — connect only
          what helps, and we never overwhelm you with every integration at once.
        </p>
      </header>

      {snapshot.recommendedNext ? (
        <section
          className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-5"
          aria-labelledby="recommended-connection-heading"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
            Recommended next
          </p>
          <h2 id="recommended-connection-heading" className="mt-2 text-xl font-bold text-navy-900">
            {snapshot.recommendedNext.displayName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-navy-900">{snapshot.recommendedNext.why}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">What you&apos;ll learn. </span>
            {snapshot.recommendedNext.whatYouLearn}
          </p>
          {snapshot.recommendedNext.href ? (
            <Link
              href={snapshot.recommendedNext.href}
              className="hom-focusable mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Continue
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="mt-8 border-t border-slate-100 pt-6">
          <p className="text-sm leading-7 text-text-muted">
            Your live connections look solid. Future sources will appear here when they&apos;re ready —
            we won&apos;t ask you to connect everything at once.
          </p>
        </section>
      )}

      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="readiness-heading">
        <h2 id="readiness-heading" className="text-lg font-bold text-navy-900">
          What the Business Brain can see
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Honest readiness — available, unavailable, or coming soon. Used to improve empty states
          and onboarding guidance.
        </p>
        {snapshot.emptyState === "nothing_connected" ? (
          <p className="mt-4 text-sm leading-6 text-navy-900">
            Nothing is connected yet. Start with the recommendation above — one strong connection
            beats a dozen weak ones.
          </p>
        ) : null}
        <ul className="mt-5 space-y-4">
          {snapshot.readiness.map((item) => (
            <li key={item.id}>
              <p className="text-sm font-semibold text-navy-900">
                {item.label}
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.state.replace(/_/g, " ")}
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {snapshot.byCategory.map((group) => (
        <section
          key={group.category}
          className="mt-10 border-t border-slate-100 pt-8"
          aria-labelledby={`category-${group.category}`}
        >
          <h2 id={`category-${group.category}`} className="text-lg font-bold text-navy-900">
            {group.label}
          </h2>
          <div className="mt-2">
            {group.connections.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-10 text-sm leading-7 text-text-muted">
        Looking for this week&apos;s priorities? Return to{" "}
        <Link href="/dashboard" className="hom-focusable font-medium text-brand-600 hover:text-brand-700">
          Your Growth Advisor
        </Link>
        .
      </p>
    </div>
  );
}
