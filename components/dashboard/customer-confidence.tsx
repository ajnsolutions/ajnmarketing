"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AwarenessChip,
  MilestoneNotice,
  TrustSignalList,
} from "@/components/dashboard/ui/page-chrome";
import {
  LAST_VISIT_STORAGE_KEY,
  MILESTONE_SEEN_STORAGE_KEY,
  buildMilestones,
  buildSinceLastVisitItems,
  dashboardAwareness,
  formatTrustTimestamp,
  type MilestoneKind,
  type SinceLastVisitItem,
} from "@/lib/customer-ux/trustPresentation";

type ConfidenceFacts = {
  thisWeek: string[];
  celebrations?: string[];
  pendingApprovals: number;
  publishFailures: number;
  openRecommendations: number;
  publishingReady: number;
  primaryActionKind: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  hasBusinessProfile: boolean;
  hasMarketingPlan: boolean;
  hasPublishedContent: boolean;
  hasGoogleSync: boolean;
  hasCompletedRecommendation: boolean;
  trustSignals?: Array<{ label: string; isoDate: string }>;
};

function readSeenMilestones(): Set<MilestoneKind> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MILESTONE_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed.filter(Boolean) as MilestoneKind[]);
  } catch {
    return new Set();
  }
}

function markMilestoneSeen(kind: MilestoneKind) {
  if (typeof window === "undefined") return;
  const seen = readSeenMilestones();
  seen.add(kind);
  window.localStorage.setItem(MILESTONE_SEEN_STORAGE_KEY, JSON.stringify([...seen]));
}

/**
 * Head of Marketing confidence strip — priorities, since-last-visit, milestones.
 * Client-only for last-visit timestamp; facts come from already-loaded server data.
 */
function readPreviousVisitLabel(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return formatTrustTimestamp(window.localStorage.getItem(LAST_VISIT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function initialUnseenMilestone(facts: ConfidenceFacts) {
  if (typeof window === "undefined") return null;
  const milestones = buildMilestones({
    hasBusinessProfile: facts.hasBusinessProfile,
    hasMarketingPlan: facts.hasMarketingPlan,
    hasPublishedContent: facts.hasPublishedContent,
    hasGoogleSync: facts.hasGoogleSync,
    hasCompletedRecommendation: facts.hasCompletedRecommendation,
  });
  const seen = readSeenMilestones();
  return [...milestones].reverse().find((item) => !seen.has(item.kind)) ?? null;
}

export function CustomerConfidencePanel({ facts }: { facts: ConfidenceFacts }) {
  const [lastVisitLabel] = useState<string | null>(() => readPreviousVisitLabel());
  const [unseenMilestone, setUnseenMilestone] = useState<ReturnType<
    typeof buildMilestones
  >[number] | null>(() => initialUnseenMilestone(facts));

  const awareness = dashboardAwareness({
    pendingApprovals: facts.pendingApprovals,
    publishFailures: facts.publishFailures,
    primaryActionKind: facts.primaryActionKind,
  });

  const sinceItems: SinceLastVisitItem[] = useMemo(
    () =>
      buildSinceLastVisitItems({
        thisWeek: facts.thisWeek,
        celebrations: facts.celebrations,
        pendingApprovals: facts.pendingApprovals,
        publishFailures: facts.publishFailures,
        openRecommendations: facts.openRecommendations,
        publishingReady: facts.publishingReady,
      }),
    [facts],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Ignore storage failures — confidence panel still works without persistence.
    }
  }, []);

  const awarenessTone =
    awareness.state === "all_caught_up" || awareness.state === "complete" || awareness.state === "up_to_date"
      ? "success"
      : awareness.state === "attention_needed" || awareness.state === "waiting_on_you"
        ? "warning"
        : "info";

  return (
    <section
      className="mt-6 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-label="Customer confidence"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Can I trust where things stand?
          </p>
          <p className="mt-2 text-base font-semibold text-navy-900">
            Today’s priorities, recent progress, and what needs you — clearly.
          </p>
        </div>
        <AwarenessChip label={awareness.label} detail={awareness.detail} tone={awarenessTone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Today’s priority
          </p>
          {facts.primaryActionKind === "none" ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Nothing urgent. You’re caught up — I’ll surface the next step when it matters.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-navy-900">{facts.primaryActionLabel}</p>
              <Link
                href={facts.primaryActionHref}
                className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Take this step →
              </Link>
            </>
          )}
        </article>

        <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Pending work
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
            <li>
              Approvals waiting:{" "}
              <span className="font-semibold text-navy-900">{facts.pendingApprovals}</span>
            </li>
            <li>
              Ready to publish:{" "}
              <span className="font-semibold text-navy-900">{facts.publishingReady}</span>
            </li>
            <li>
              Needs retry:{" "}
              <span className="font-semibold text-navy-900">{facts.publishFailures}</span>
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Completed marketing
          </p>
          {facts.thisWeek.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Recent wins will show here as we publish and finish work together.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
              {facts.thisWeek.slice(0, 3).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-growth-600" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-navy-900">Since your last visit</h3>
          {lastVisitLabel ? (
            <p className="text-xs text-text-muted">Last here: {lastVisitLabel}</p>
          ) : (
            <p className="text-xs text-text-muted">Welcome back — here’s what’s current</p>
          )}
        </div>
        {sinceItems.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-text-muted">
            No new activity to highlight yet. That’s normal early on — create or approve when you’re
            ready.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sinceItems.slice(0, 6).map((item) => (
              <li key={item.id} className="text-sm leading-6 text-slate-700">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
                  >
                    {item.text}
                  </Link>
                ) : (
                  item.text
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {facts.trustSignals && facts.trustSignals.length > 0 ? (
        <TrustSignalList signals={facts.trustSignals} />
      ) : null}

      {unseenMilestone ? (
        <div>
          <MilestoneNotice
            title={unseenMilestone.title}
            detail={unseenMilestone.detail}
            href={unseenMilestone.href}
            ctaLabel={unseenMilestone.ctaLabel}
          />
          <button
            type="button"
            className="hom-focusable mt-2 text-xs font-medium text-text-muted hover:text-navy-900"
            onClick={() => {
              markMilestoneSeen(unseenMilestone.kind);
              setUnseenMilestone(null);
            }}
          >
            Dismiss milestone
          </button>
        </div>
      ) : null}
    </section>
  );
}
