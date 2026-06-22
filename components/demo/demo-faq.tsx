"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How long does the demo take?",
    answer:
      "Most demos are prepared within a few business days. We review your online presence first, then share a personalized walkthrough showing specific opportunities for your business.",
  },
  {
    question: "What information do I need?",
    answer:
      "Just your business name, website, location, and contact details. We handle the analysis — no marketing reports or technical setup required on your end.",
  },
  {
    question: "Will I have to manage marketing myself?",
    answer:
      "No. AJN Marketing is done-for-you. You approve updates by email or text when needed, but we manage your Google presence, reviews, and local content.",
  },
  {
    question: "Do you work with agencies?",
    answer:
      "Yes. We partner with small agencies and local SEO shops that want white-label fulfillment for contractors, trades, and local service businesses.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Plans are month-to-month with no long-term contracts. You stay because it works — not because you're locked in.",
  },
] as const;

export function DemoFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03]">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={faq.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50/80"
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold text-[#0F172A]">
                {faq.question}
              </span>
              <span
                className={`shrink-0 text-xl font-light text-[#64748B] transition-transform duration-200 ${
                  isOpen ? "rotate-45" : ""
                }`}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="animate-fade-in px-6 pb-5">
                <p className="text-base leading-7 text-[#64748B]">{faq.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
