import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import type { CustomerStatusPresentation } from "@/lib/customer-ux/statusVocabulary";
import {
  BRAIN_CONFIDENCE_LABELS,
  BRAIN_SECTION_LABELS,
  BRAIN_SECTION_ORDER,
  type BrainConfidenceLevel,
  type BusinessBrainSnapshot,
  type KnowledgeCard,
} from "@/lib/business-brain-inspector/types";

function confidencePresentation(confidence: BrainConfidenceLevel): CustomerStatusPresentation {
  const toneByConfidence: Record<BrainConfidenceLevel, CustomerStatusPresentation["tone"]> = {
    high: "success",
    medium: "warning",
    low: "neutral",
  };
  return {
    label: BRAIN_CONFIDENCE_LABELS[confidence],
    description: `${BRAIN_CONFIDENCE_LABELS[confidence]} confidence`,
    tone: toneByConfidence[confidence],
  };
}

function KnowledgeCardView({ card }: { card: KnowledgeCard }) {
  const sourceLabels = [...new Set(card.evidence.map((e) => e.sourceLabel))];

  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900">{card.title}</p>
        <StatusBadge presentation={confidencePresentation(card.confidence)} />
      </div>
      <p className="mt-2 text-sm leading-6 text-navy-900">{card.statement}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        <span className="font-medium text-slate-600">Why this confidence. </span>
        {card.confidenceReason}
      </p>
      {sourceLabels.length > 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-medium text-slate-600">Sources ({card.evidenceCount} evidence item{card.evidenceCount === 1 ? "" : "s"}). </span>
          {sourceLabels.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-medium text-slate-600">Evidence. </span>
          {card.evidenceCount} item{card.evidenceCount === 1 ? "" : "s"}
        </p>
      )}
      {card.correction ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={card.correction.href}
            className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            This isn&apos;t quite right? {card.correction.label} →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Business Brain Inspector — a customer-facing trust feature, not a
 * debugging page. Answers "does the AI actually understand my business?"
 * with what it knows, how confident it is, where that came from, what's
 * missing, and how to improve it — grouped into sections, never a raw dump.
 */
export function BusinessBrainPage({ snapshot }: { snapshot: BusinessBrainSnapshot }) {
  const sectionsWithCards = BRAIN_SECTION_ORDER.filter((section) => (snapshot.sections[section]?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Business Brain</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          What I know about your business
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          Every belief below is grounded in real evidence — never invented. See what I know, how
          confident I am, where it came from, and what would help me understand you even better.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl bg-[#F8FAFC] px-4 py-4 ring-1 ring-slate-100">
        <StatusBadge presentation={confidencePresentation(snapshot.overallConfidence)} />
        <p className="text-sm leading-6 text-text-muted">{snapshot.overallConfidenceExplanation}</p>
      </div>

      {sectionsWithCards.length === 0 ? (
        <p className="mt-8 text-sm leading-7 text-text-muted">
          I don&apos;t have enough evidence yet to describe your business — as you connect sources
          and add information, this page will fill in with what I&apos;ve learned.
        </p>
      ) : (
        sectionsWithCards.map((section) => (
          <section key={section} className="mt-10 border-t border-slate-100 pt-8" aria-labelledby={`section-${section}`}>
            <h2 id={`section-${section}`} className="text-lg font-bold text-navy-900">
              {BRAIN_SECTION_LABELS[section]}
            </h2>
            <div className="mt-4 space-y-4">
              {snapshot.sections[section]!.map((card) => (
                <KnowledgeCardView key={card.id} card={card} />
              ))}
            </div>
          </section>
        ))
      )}

      {snapshot.missingKnowledge.length > 0 ? (
        <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby="missing-knowledge-heading">
          <h2 id="missing-knowledge-heading" className="text-lg font-bold text-navy-900">
            What&apos;s still missing
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Missing information isn&apos;t a failure — it just means I stay more careful until I
            learn more. Here&apos;s what would help most.
          </p>
          <ul className="mt-5 space-y-4">
            {snapshot.missingKnowledge.map((gap) => (
              <li key={gap.id} className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-navy-900">{gap.label}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{gap.detail}</p>
                {gap.correction ? (
                  <Link
                    href={gap.correction.href}
                    className="hom-focusable mt-2 inline-flex text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                  >
                    {gap.correction.label} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-sm leading-7 text-text-muted">
        Return to{" "}
        <Link href="/dashboard" className="hom-focusable font-medium text-brand-600 hover:text-brand-700">
          Your Growth Advisor
        </Link>
        .
      </p>
    </div>
  );
}
