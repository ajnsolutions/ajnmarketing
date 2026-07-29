import Link from "next/link";
import {
  KNOWLEDGE_STATE_LABELS,
  type GuidedSetupExperience,
} from "@/lib/guided-setup/types";

/**
 * Compact onboarding recognition strip for Growth Advisor.
 * Celebrates first wins; distinguishes Known / Learning / Waiting.
 */
export function GrowthAdvisorSetupProgress({
  experience,
}: {
  experience: GuidedSetupExperience;
}) {
  if (experience.advisorReady && !experience.latestFirstWin && !experience.recommendedNext) {
    return null;
  }

  return (
    <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="setup-progress-heading">
      <h2 id="setup-progress-heading" className="text-lg font-bold text-navy-900">
        Getting to know your business
      </h2>

      {experience.latestFirstWin ? (
        <div className="mt-4 rounded-xl bg-growth-50/60 px-4 py-3 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            New insight unlocked
          </p>
          <p className="mt-1 text-sm font-semibold text-navy-900">{experience.latestFirstWin.title}</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{experience.latestFirstWin.detail}</p>
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {experience.knowledgeSignals.slice(0, 4).map((signal) => (
          <li key={signal.id}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {KNOWLEDGE_STATE_LABELS[signal.state]}
            </p>
            <p className="mt-1 text-sm font-semibold text-navy-900">{signal.label}</p>
            <p className="mt-1 text-sm leading-6 text-text-muted">{signal.detail}</p>
          </li>
        ))}
      </ul>

      {experience.recommendedNext && !experience.advisorReady ? (
        <p className="mt-4 text-sm leading-6 text-text-muted">
          Highest-value next step:{" "}
          <Link
            href={experience.recommendedNext.href}
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            {experience.recommendedNext.title}
          </Link>
          .{" "}
          <Link
            href="/dashboard/setup"
            className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
          >
            Guided setup
          </Link>
        </p>
      ) : experience.recommendedNext ? (
        <p className="mt-4 text-sm leading-6 text-text-muted">
          Optional deepen:{" "}
          <Link
            href={experience.recommendedNext.href}
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            {experience.recommendedNext.title}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
