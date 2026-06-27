"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  description,
  defaultChecked = true,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div>
        <p className="text-sm font-semibold text-navy-900">{label}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
      />
    </label>
  );
}

export function ApprovalsDeliveryPage() {
  const [testSent, setTestSent] = useState(false);

  const approvalItems = [
    { title: "Google Post: Spring maintenance reminder", type: "Google Post" },
    { title: "Google Post: Emergency service availability", type: "Google Post" },
    { title: "Reply to 5-star review from Sarah M.", type: "Review Reply" },
    { title: "Reply to 4-star review from James T.", type: "Review Reply" },
    { title: "Reply to 5-star review from Linda K.", type: "Review Reply" },
    { title: "Blog draft: Signs your water heater needs replacing", type: "Blog Draft" },
  ];

  const timeline = [
    { text: "AI package generated", time: "Sunday, 6:00 AM", tone: "blue" as const },
    { text: "Email prepared", time: "Sunday, 6:15 AM", tone: "blue" as const },
    { text: "SMS reminder queued", time: "Sunday, 6:20 AM", tone: "amber" as const },
    { text: "Owner approves", time: "Monday, 8:42 AM", tone: "green" as const },
    { text: "Content scheduled", time: "Monday, 8:45 AM", tone: "green" as const },
    { text: "Weekly report sent", time: "Friday, 5:00 PM", tone: "blue" as const },
  ];

  const safetyCards = [
    {
      title: "Owner approval required",
      description: "Every post, reply, and campaign waits for your explicit approval.",
    },
    {
      title: "No content published without approval",
      description: "AJN never publishes automatically unless you approve it first.",
    },
    {
      title: "SMS opt-out supported",
      description: "Reply STOP anytime to pause SMS approval alerts.",
    },
    {
      title: "Email unsubscribe supported",
      description: "Manage email preferences from every approval message.",
    },
    {
      title: "Delivery logs retained",
      description: "See when emails and texts were sent, opened, and acted on.",
    },
  ];

  function handleSendTest() {
    setTestSent(true);
    window.setTimeout(() => setTestSent(false), 4000);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link
            href="/dashboard/approvals"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← Back to Approval Center
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Email & SMS Approval Delivery
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Preview how AJN sends approval requests to business owners.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSendTest}
          className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
        >
          Send Test Preview
        </button>
      </div>

      {testSent && (
        <p className="rounded-xl border border-emerald-200 bg-growth-50 px-4 py-3 text-sm font-medium text-growth-600">
          Test preview queued — no email or SMS was sent. This is a UI preview only.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Delivery Summary
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white">Weekly package ready</h2>
            <p className="mt-2 text-sm text-slate-300">6 items awaiting approval</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              <li>• 3 review replies</li>
              <li>• 2 Google posts</li>
              <li>• 1 blog draft</li>
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Delivery channels
              </p>
              <p className="mt-2 text-lg font-semibold text-white">Email + SMS</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Next scheduled send
              </p>
              <p className="mt-2 text-lg font-semibold text-white">Monday 8:00 AM</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Email Preview" subtitle="Weekly approval package in the inbox">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Subject</p>
              <p className="text-sm font-semibold text-navy-900">
                Your Weekly AJN Marketing Content is Ready
              </p>
              <p className="mt-2 text-xs text-text-muted">From: AJN Marketing &lt;updates@ajnmarketing.com&gt;</p>
            </div>
            <div className="space-y-5 px-4 py-5">
              <Image
                src="/images/AJN_marketing_logo.png"
                alt="AJN Marketing"
                width={100}
                height={50}
                className="h-8 w-auto"
              />
              <p className="text-sm leading-7 text-slate-600">
                Hi Mike,
              </p>
              <p className="text-sm leading-7 text-slate-600">
                Your weekly content package for{" "}
                <strong className="text-navy-900">Riverside Plumbing Co.</strong> is ready. Review
                and approve everything in one click — or approve each item individually.
              </p>
              <div className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
                <p className="text-sm font-semibold text-navy-900">Approval summary</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>• 6 items awaiting approval</li>
                  <li>• 3 review replies · 2 Google posts · 1 blog draft</li>
                  <li>• Estimated publish window: Mon–Fri this week</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Approve All
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  Make Changes
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  View Dashboard
                </button>
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Individual approvals
                </p>
                {approvalItems.slice(0, 3).map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-3 ring-1 ring-slate-200/60"
                  >
                    <p className="text-xs font-semibold text-brand-600">{item.type}</p>
                    <p className="mt-1 text-sm font-medium text-navy-900">{item.title}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-navy-900"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-text-muted">+ 3 more items in full email</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="SMS Preview" subtitle="Quick approvals from your phone">
          <div className="mx-auto max-w-sm">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#F8FAFC] shadow-lg shadow-slate-300/40 ring-1 ring-slate-900/[0.04]">
              <div className="bg-[#081426] px-4 py-2 text-center">
                <p className="text-xs font-semibold text-white">Messages</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white shadow-sm">
                  <p className="font-semibold">AJN Marketing</p>
                  <p className="mt-2 leading-6">You have 6 items ready for approval.</p>
                  <p className="mt-3 leading-6">
                    Reply <span className="font-bold">YES</span> to approve all.
                  </p>
                  <p className="mt-1 leading-6">
                    Reply <span className="font-bold">VIEW</span> to review individually.
                  </p>
                  <p className="mt-1 leading-6">
                    Reply <span className="font-bold">PAUSE</span> to skip this week.
                  </p>
                  <p className="mt-3 text-[11px] text-brand-100">Mon, 8:00 AM</p>
                </div>
                <div className="max-w-[70%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  YES
                </div>
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white shadow-sm">
                  <p className="leading-6">
                    Approved. We&apos;ll publish your approved content this week.
                  </p>
                  <p className="mt-2 text-[11px] text-brand-100">Mon, 8:42 AM</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Delivery Preferences" subtitle="How and when AJN reaches you">
          <div className="space-y-3">
            <Toggle
              label="Weekly approval email"
              description="Full content package every Monday morning."
              defaultChecked
            />
            <Toggle
              label="SMS urgent alerts"
              description="Text when high-priority items need same-day approval."
              defaultChecked
            />
            <Toggle
              label="Review reply SMS alerts"
              description="Notify when new review replies are ready to approve."
            />
            <Toggle
              label="Weekly performance summary"
              description="Friday recap of visibility, reviews, and content published."
              defaultChecked
            />
            <label className="block rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
              <span className="text-sm font-semibold text-navy-900">Approval reminder frequency</span>
              <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100">
                <option>Once per week (Monday)</option>
                <option>Monday + Thursday reminder</option>
                <option>Only when urgent</option>
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Approval Link Preview" subtitle="Secure one-click approval from email">
          <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5 ring-1 ring-brand-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Secure approval link
            </p>
            <p className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600">
              https://ajnmarketing.com/approve/a8f3k2m9-x7b1c4d6
            </p>
            <ul className="mt-4 space-y-2 text-sm text-navy-900">
              <li className="flex items-center gap-2">
                <span className="text-growth-500">✓</span>
                Tokenized link — unique to your account
              </li>
              <li className="flex items-center gap-2">
                <span className="text-growth-500">✓</span>
                Expires in 7 days
              </li>
              <li className="flex items-center gap-2">
                <span className="text-growth-500">✓</span>
                One-click approval enabled
              </li>
              <li className="flex items-center gap-2">
                <span className="text-growth-500">✓</span>
                Owner can edit before approving
              </li>
            </ul>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Delivery Timeline" subtitle="How a weekly approval package flows">
        <ol className="relative space-y-0">
          {timeline.map((item, index) => (
            <li key={item.text} className="relative flex gap-4 pb-6 last:pb-0">
              {index < timeline.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
                />
              )}
              <span
                className={`relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white ring-2 ${
                  item.tone === "green"
                    ? "bg-growth-500 ring-emerald-100"
                    : item.tone === "amber"
                      ? "bg-amber-500 ring-amber-100"
                      : "bg-brand-600 ring-brand-100"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">{item.text}</p>
                <p className="mt-1 text-xs text-text-muted">{item.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Safety & Controls" subtitle="Built for trust and transparency">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safetyCards.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <h3 className="font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
