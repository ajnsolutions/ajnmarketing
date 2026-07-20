"use client";

import { useId, useRef, useState, useTransition } from "react";
import { groupInteractiveHomPrompts } from "@/lib/interactive-hom/promptGroups";
import type {
  InteractiveHomAnswer,
  InteractiveHomTurn,
} from "@/lib/interactive-hom/types";
import { PartialDataNotice } from "@/components/dashboard/ui/dashboard-states";

function makeTurnId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ask Your Head of Marketing — session-scoped grounded Q&A panel.
 * Explains existing MD / brief / campaign / memory signals. Never mutates state.
 */
export function AskHeadOfMarketingPanel() {
  const formId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<InteractiveHomTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const promptGroups = groupInteractiveHomPrompts();

  function appendAnswer(userText: string, answer: InteractiveHomAnswer) {
    setTurns((prev) => [
      ...prev,
      { id: makeTurnId("u"), role: "user", content: userText },
      {
        id: makeTurnId("a"),
        role: "assistant",
        content: answer.answer,
        category: answer.category,
        grounded: answer.grounded,
        evidenceLabels: answer.evidenceLabels,
        insufficientData: answer.insufficientData,
      },
    ]);
    if (answer.insufficientData) {
      setPartialWarning(
        "Some answers are limited by missing evidence. That is normal — I will not invent certainty.",
      );
    }
  }

  function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || isPending) return;

    startTransition(async () => {
      try {
        setError(null);
        setQuestion("");
        const response = await fetch("/api/interactive-hom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "Could not get an answer");
        }
        const data = (await response.json()) as { answer: InteractiveHomAnswer };
        appendAnswer(trimmed, data.answer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setQuestion(trimmed);
      }
    });
  }

  return (
    <section
      className="hom-disclose-content mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="ask-hom-heading"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
        Ask your Head of Marketing
      </p>
      <h2 id="ask-hom-heading" className="mt-2 text-xl font-bold text-navy-900">
        Got a question?
      </h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">
        I&apos;ll explain priorities, recommendations, campaigns, and what we&apos;ve learned—using
        only what we already know. I won&apos;t approve, publish, or invent new recommendations.
      </p>

      <div className="mt-5 space-y-4" role="group" aria-label="Suggested questions by topic">
        {promptGroups.map((group) => (
          <div key={group.group}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => ask(prompt.label)}
                  className="hom-focusable min-h-11 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-semibold text-navy-900 transition-colors hover:bg-slate-100 disabled:opacity-60 sm:text-sm"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        id={listId}
        className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isPending}
      >
        {turns.length === 0 ? (
          <p className="text-sm leading-6 text-text-muted">
            Conversation stays on this page for your current session. Pick a suggestion or type a
            question below.
          </p>
        ) : (
          <ul className="space-y-3">
            {turns.map((turn) => (
              <li key={turn.id}>
                <p
                  className={
                    turn.role === "user"
                      ? "text-sm font-semibold text-navy-900"
                      : "whitespace-pre-wrap text-sm leading-6 text-text-muted"
                  }
                >
                  <span className="sr-only">
                    {turn.role === "user" ? "You asked: " : "Head of Marketing answered: "}
                  </span>
                  {turn.content}
                </p>
                {turn.role === "assistant" && turn.evidenceLabels && turn.evidenceLabels.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Based on: {turn.evidenceLabels.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {isPending && (
          <p className="text-sm font-medium text-navy-900" role="status">
            Looking through what we already know…
          </p>
        )}
      </div>

      {partialWarning && (
        <div className="mt-3">
          <PartialDataNotice message={partialWarning} />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-amber-800" role="alert">
          {error}
        </p>
      )}

      <form
        id={formId}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
          inputRef.current?.focus();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={`${formId}-question`} className="sr-only">
            Ask your Head of Marketing
          </label>
          <input
            ref={inputRef}
            id={`${formId}-question`}
            type="text"
            name="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={isPending}
            maxLength={500}
            autoComplete="off"
            placeholder="Ask about priorities, campaigns, or what changed…"
            className="hom-focusable w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-slate-400 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !question.trim()}
          className="hom-focusable inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#081426] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426] disabled:opacity-60"
        >
          {isPending ? "Asking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
