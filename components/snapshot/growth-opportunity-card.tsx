/**
 * One growth opportunity, framed as "What I noticed / Why it may matter /
 * What we could do" per Part 7. The underlying data
 * (possibleGrowthOpportunities.value) is a short phrase list, not already
 * broken into this 3-part narrative — "Why it may matter" reuses the
 * insight's own real `reason` text (never fabricated), and "What we could
 * do" is deliberately generic and honestly framed as future work, never a
 * specific invented tactic or promised outcome (see Part 7's "do not create
 * unsupported financial projections").
 */
export function GrowthOpportunityCard({ notice, reason }: { notice: string; reason: string }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">What I noticed</p>
      <p className="mt-1.5 text-base font-semibold text-navy-900">{notice}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Why it may matter</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{reason}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">What we could do</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">
        This becomes part of your growth plan once we&apos;re working together — nothing is decided or acted on yet.
      </p>
    </article>
  );
}
