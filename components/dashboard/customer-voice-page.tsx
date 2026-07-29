import Link from "next/link";
import type { CustomerVoiceInsightCard, CustomerVoicePageModel } from "@/lib/customer-voice/presentation";
import type { MarketingCopySuggestion } from "@/lib/customer-voice/copySuggestions";

function MetaRow({ card }: { card: CustomerVoiceInsightCard }) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      <div>
        <dt className="inline font-semibold text-slate-600">Confidence:</dt>{" "}
        <dd className="inline capitalize">{card.confidence}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-slate-600">Business impact:</dt>{" "}
        <dd className="inline capitalize">{card.businessImpact}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-slate-600">Supporting reviews:</dt>{" "}
        <dd className="inline">{card.supportingReviewCount}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-slate-600">Trend:</dt>{" "}
        <dd className="inline">{card.trend}</dd>
      </div>
    </dl>
  );
}

function InsightBlock({ card }: { card: CustomerVoiceInsightCard }) {
  return (
    <article className="border-b border-slate-100 py-5 last:border-b-0">
      <p className="text-base font-semibold text-navy-900">{card.insight}</p>
      <MetaRow card={card} />
      <details className="mt-3">
        <summary className="hom-focusable cursor-pointer text-sm font-semibold text-brand-600">
          Why I believe this
        </summary>
        <p className="mt-2 text-sm leading-6 text-text-muted">{card.whyBelievable}</p>
      </details>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Possible actions
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Suggestions only — your Growth Advisor decides what to prioritize.
        </p>
        <ul className="mt-2 space-y-1.5">
          {card.possibleActions.map((action) => (
            <li key={action.id} className="text-sm text-navy-900">
              {action.href ? (
                <Link
                  href={action.href}
                  className="hom-focusable font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  {action.label}
                </Link>
              ) : (
                action.label
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = title.replace(/\s+/g, "-").toLowerCase();
  return (
    <section className="mt-10 border-t border-slate-100 pt-8" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-bold tracking-tight text-navy-900">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function CopySuggestionBlock({ item }: { item: MarketingCopySuggestion }) {
  return (
    <article className="border-b border-slate-100 py-4 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
      <p className="mt-2 text-base leading-7 text-navy-900">{item.suggestion}</p>
      <p className="mt-2 text-xs text-text-muted">{item.whyBelievable}</p>
    </article>
  );
}

/**
 * Conversational Customer Voice experience — Head of Marketing tone, not a dashboard.
 */
export function CustomerVoiceExperiencePage({ model }: { model: CustomerVoicePageModel }) {
  const isEmpty = model.emptyState === "no_evidence";
  const isThin = model.emptyState === "insufficient_evidence";

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Customer Voice
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          How customers talk about {model.businessName}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{model.maturityCopy}</p>
        <div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-navy-900">
            Customer Voice Health: {model.health.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{model.health.message}</p>
          <p className="mt-1 text-xs text-slate-500">{model.health.reason}</p>
        </div>
      </header>

      {isEmpty ? (
        <section className="mt-10 border-t border-slate-100 pt-8">
          <p className="text-base leading-7 text-navy-900">
            I don&apos;t have enough customer feedback yet to share honest insights.
          </p>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Connect Google Business Profile and sync reviews — I&apos;ll learn from real customer
            language, never invent praise.
          </p>
          <Link
            href="/dashboard/google-business-profile"
            className="hom-focusable mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
          >
            Open Google Business Profile →
          </Link>
        </section>
      ) : null}

      {!isEmpty ? (
        <>
          <Section title="What customers consistently love">
            {model.loves.length > 0 ? (
              model.loves.map((card) => <InsightBlock key={card.themeKey} card={card} />)
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                {isThin
                  ? "Still establishing a baseline — themes will appear as more feedback arrives."
                  : "No recurring praise themes yet."}
              </p>
            )}
          </Section>

          <Section title="Opportunities to improve">
            {model.opportunities.length > 0 ? (
              model.opportunities.map((card) => <InsightBlock key={card.themeKey} card={card} />)
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                Nothing concerning stands out in the feedback I have so far.
              </p>
            )}
          </Section>

          <Section title="Words customers naturally use">
            {model.customerLanguage.length > 0 ? (
              model.customerLanguage.map((card) => <InsightBlock key={card.themeKey} card={card} />)
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                I&apos;m still collecting distinctive customer language.
              </p>
            )}
          </Section>

          <Section title="Services customers mention most">
            {model.mentionedServices.length > 0 ? (
              model.mentionedServices.map((card) => <InsightBlock key={card.themeKey} card={card} />)
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                No recurring service mentions yet.
              </p>
            )}
          </Section>

          <Section title="Recent customer trends">
            {model.recentTrends.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {model.recentTrends.map((point) => (
                  <li key={point.periodKey} className="text-sm leading-6 text-navy-900">
                    <span className="font-semibold">{point.periodKey}</span>
                    <span className="text-text-muted">
                      {" "}
                      — {Math.round(point.positiveShare * 100)}% positive,{" "}
                      {Math.round(point.negativeShare * 100)}% concerning,{" "}
                      {Math.round(point.neutralShare * 100)}% neutral
                      {point.evidenceCount > 0 ? ` · ${point.evidenceCount} reviews` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                Trends appear once there&apos;s enough dated feedback — I never invent them.
              </p>
            )}
          </Section>

          <Section title="Suggested marketing opportunities">
            {model.suggestedMarketingOpportunities.length > 0 ? (
              model.suggestedMarketingOpportunities.map((item) => (
                <CopySuggestionBlock key={item.surface} item={item} />
              ))
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                Copy suggestions appear only when recurring customer language supports them.
              </p>
            )}
          </Section>
        </>
      ) : null}

      <p className="mt-10 text-xs text-slate-400">
        Insights generated {new Date(model.generatedAt).toLocaleString()} · grounded in Customer
        Voice intelligence
      </p>
    </div>
  );
}
