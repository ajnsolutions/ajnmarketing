import Link from "next/link";
import {
  KNOWLEDGE_STATE_LABELS,
  MilestoneStates,
  type GuidedSetupExperience,
} from "@/lib/guided-setup/types";

type Milestone = GuidedSetupExperience["milestones"][number];

function milestoneStateLabel(state: Milestone["state"]): string {
  switch (state) {
    case MilestoneStates.COMPLETE:
      return "Complete";
    case MilestoneStates.CURRENT:
      return "Up next";
    case MilestoneStates.OPTIONAL_WAITING:
      return "Optional";
    default:
      return "Later";
  }
}

function MilestoneItem({ milestone }: { milestone: Milestone }) {
  return (
    <li>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {milestoneStateLabel(milestone.state)}
      </p>
      <p className="mt-1 text-sm font-semibold text-navy-900">{milestone.title}</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        <span className="font-medium text-slate-600">What&apos;s known. </span>
        {milestone.knownSummary}
      </p>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        <span className="font-medium text-slate-600">Business Brain. </span>
        {milestone.brainImprovement}
      </p>
    </li>
  );
}

/**
 * Guided setup experience — milestones, one next step, first wins.
 * No percentage bars. Never overwhelms with every connection.
 */
export function GuidedSetupExperiencePage({
  experience,
}: {
  experience: GuidedSetupExperience;
}) {
  const completedMilestones = experience.milestones.filter(
    (milestone) => milestone.state === MilestoneStates.COMPLETE,
  );
  const activeMilestones = experience.milestones.filter(
    (milestone) => milestone.state !== MilestoneStates.COMPLETE,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Guided setup
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          {experience.headline}
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">{experience.lead}</p>
      </header>

      {experience.latestFirstWin ? (
        <section
          className="mt-8 rounded-2xl border border-emerald-200 bg-growth-50/50 px-5 py-5"
          aria-labelledby="latest-first-win-heading"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            First win
          </p>
          <h2 id="latest-first-win-heading" className="mt-2 text-xl font-bold text-navy-900">
            {experience.latestFirstWin.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-navy-900">{experience.latestFirstWin.detail}</p>
          {experience.firstWins.length > 1 ? (
            <p className="mt-3 text-xs text-text-muted">
              {experience.firstWins.length} wins unlocked so far — value grows with each step.
            </p>
          ) : null}
        </section>
      ) : null}

      {experience.recommendedNext ? (
        <section
          className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-5"
          aria-labelledby="guided-next-heading"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
            Recommended next
          </p>
          <h2 id="guided-next-heading" className="mt-2 text-xl font-bold text-navy-900">
            {experience.recommendedNext.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-navy-900">{experience.recommendedNext.why}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">How this helps the Business Brain. </span>
            {experience.recommendedNext.brainImprovement}
          </p>
          <Link
            href={experience.recommendedNext.href}
            className="hom-focusable mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {experience.recommendedNext.actionLabel}
          </Link>
        </section>
      ) : (
        <section className="mt-8 border-t border-slate-100 pt-6">
          <p className="text-sm leading-7 text-text-muted">
            No urgent setup step right now. Return to{" "}
            <Link href="/dashboard" className="hom-focusable font-medium text-brand-600 hover:text-brand-700">
              Your Growth Advisor
            </Link>{" "}
            for this week&apos;s priorities.
          </p>
        </section>
      )}

      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="milestones-heading">
        <h2 id="milestones-heading" className="text-lg font-bold text-navy-900">
          Meaningful milestones
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Not a percentage bar — just the stages that unlock real advice.
        </p>
        {activeMilestones.length > 0 ? (
          <ol className="mt-5 space-y-5">
            {activeMilestones.map((milestone) => (
              <MilestoneItem key={milestone.key} milestone={milestone} />
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-sm leading-6 text-navy-900">
            Every setup milestone is complete — nice work.
          </p>
        )}

        {completedMilestones.length > 0 ? (
          <details className="group mt-6">
            <summary className="hom-focusable cursor-pointer list-none text-sm font-semibold text-brand-600 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex min-h-11 items-center gap-2">
                See {completedMilestones.length} completed step
                {completedMilestones.length === 1 ? "" : "s"}
                <span
                  className="text-slate-400 transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
                >
                  ›
                </span>
              </span>
            </summary>
            <ol className="hom-disclose-content mt-3 space-y-5">
              {completedMilestones.map((milestone) => (
                <MilestoneItem key={milestone.key} milestone={milestone} />
              ))}
            </ol>
          </details>
        ) : null}
      </section>

      <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="knowledge-heading">
        <h2 id="knowledge-heading" className="text-lg font-bold text-navy-900">
          Known · Learning · Waiting
        </h2>
        <ul className="mt-4 space-y-4">
          {experience.knowledgeSignals.map((signal) => (
            <li key={signal.id}>
              <p className="text-sm font-semibold text-navy-900">
                {signal.label}
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {KNOWLEDGE_STATE_LABELS[signal.state]}
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{signal.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {experience.emptyStates.length > 0 && !experience.advisorReady ? (
        <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="text-lg font-bold text-navy-900">
            What&apos;s still helpful to add
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Missing information isn&apos;t a failure — it just means advice stays more careful until
            we learn more.
          </p>
          <ul className="mt-4 space-y-4">
            {experience.emptyStates.slice(0, 3).map((item) => (
              <li key={item.id}>
                <p className="text-sm font-semibold text-navy-900">{item.whatMissing}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  <span className="font-medium text-slate-600">Why it matters. </span>
                  {item.whyItMatters}
                </p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  <span className="font-medium text-slate-600">What improves. </span>
                  {item.whatImproves}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-sm leading-7 text-text-muted">
        Prefer the full checklist?{" "}
        <Link
          href="/dashboard/setup?view=checklist"
          className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
        >
          Open detailed setup
        </Link>
        . Or review{" "}
        <Link
          href="/dashboard/business-connections"
          className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
        >
          Business Connections
        </Link>
        .
      </p>
    </div>
  );
}
