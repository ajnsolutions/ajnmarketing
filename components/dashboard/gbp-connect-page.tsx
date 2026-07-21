"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatGbpConnectionStatus,
  formatGbpSyncDate,
} from "@/lib/google-business-profile/persistence";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";

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

function GoogleConnectButton() {
  return (
    <a
      href="/api/google-business-profile/connect"
      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#081426] shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-lg"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Connect Google Business Profile
    </a>
  );
}

export function GbpConnectPage({
  initialStatus,
}: {
  initialStatus: GoogleBusinessProfileConnectionStatus;
}) {
  const searchParams = useSearchParams();
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);

  const status = initialStatus;
  const connection = status.connection;
  const isConnected = status.connected && connection?.connection_status === "connected";

  const bannerMessage = useMemo(() => {
    if (searchParams.get("connected") === "1") {
      return "Google Business Profile connected successfully. Sync your location data from the Google Business Profile dashboard.";
    }

    const error = searchParams.get("error");
    if (error) {
      // Customer-safe only — never surface raw provider/config internals.
      return "Google connection did not finish. You can try again, or continue setup without Google for now.";
    }

    if (!status.scopesValid && connection) {
      return "Google Business Profile is missing required permissions and needs to be reconnected. Click Connect Google Business Profile to grant access again.";
    }

    if (connection?.connection_status === "revoked") {
      return "Google Business Profile access was revoked or the connection is no longer valid. Reconnect to restore syncing.";
    }

    return null;
  }, [searchParams, status.scopesValid, connection]);

  const accessItems = [
    "Profile details",
    "Reviews",
    "Performance insights",
    "Posts",
    "Photos",
  ];

  const steps = [
    { title: "Sign in with Google", description: "Use the Google account that manages your business profile." },
    { title: "Choose your business profile", description: "Select the Google Business Profile location you want AJN to manage." },
    { title: "Grant approved permissions", description: "Review exactly what AJN can read and publish on your behalf." },
    { title: "AJN begins monitoring and optimizing", description: "We import your data and start generating recommendations." },
  ];

  const permissions = [
    {
      title: "Read profile information",
      description: "Business name, hours, services, and contact details.",
    },
    {
      title: "Read reviews",
      description: "Monitor new reviews and draft replies for your approval.",
    },
    {
      title: "View performance insights",
      description: "Track calls, directions, website clicks, and visibility.",
    },
    {
      title: "Publish posts after approval",
      description: "AJN only publishes Google posts you approve in the Approval Center.",
    },
    {
      title: "Manage photos after approval",
      description: "Suggested photo updates are sent to you before anything goes live.",
    },
  ];

  const syncStages = [
    "Business info synced",
    "Reviews imported",
    "Performance metrics imported",
    "Posts history imported",
    "Optimization scan completed",
  ];

  const securityCards = [
    {
      title: "You stay in control",
      description: "Nothing is published without your approval through AJN workflows.",
    },
    {
      title: "We only publish approved content",
      description: "Posts, replies, and photo updates follow your Approval Center queue.",
    },
    {
      title: "You can disconnect anytime",
      description: "Remove access instantly from your AJN settings or Google account.",
    },
    {
      title: "Secure OAuth connection",
      description: "Industry-standard Google sign-in — AJN never stores your Google password.",
    },
  ];

  const nextSteps = [
    "Review business information",
    "Import reviews",
    "Generate optimization recommendations",
    "Begin weekly approval workflow",
  ];

  const previewInitials = (connection?.google_account_name ?? connection?.gbp_location_name ?? "GBP")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link
            href="/dashboard/google-business-profile"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← Back to Google Business Profile
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Connect Google Business Profile
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Optional connection for local posts, reviews, and performance insights. Nothing
            publishes without your approval. You can skip this and continue setup.
          </p>
          <p className="mt-2 text-sm">
            <Link
              href="/dashboard/setup"
              className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
            >
              ← Back to setup checklist
            </Link>
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Current Status
              </p>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                  status.setupRequired
                    ? "bg-amber-500/15 text-amber-300 ring-amber-400/20"
                    : isConnected
                      ? "bg-growth-500/15 text-growth-300 ring-emerald-400/20"
                      : "bg-amber-500/15 text-amber-300 ring-amber-400/20"
                }`}
              >
                {status.setupRequired
                  ? "Setup Required"
                  : !status.scopesValid && connection
                    ? "Missing Permissions"
                    : formatGbpConnectionStatus(connection?.connection_status ?? "not_connected")}
              </span>
            </div>

            {status.setupRequired ? (
              <>
                <p className="mt-4 text-lg font-semibold text-white">
                  Google connection is temporarily unavailable.
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Connecting Google is optional. You can keep using Head of Marketing and finish
                  other setup while this is unavailable. If you need Google features, contact
                  support — technical configuration stays with your workspace admins.
                </p>
              </>
            ) : isConnected ? (
              <>
                <p className="mt-4 text-lg font-semibold text-white">Google account connected</p>
                <dl className="mt-5 space-y-3 text-sm text-slate-200">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Connected account
                    </dt>
                    <dd className="mt-1">
                      {connection?.google_account_name ?? "Google account"} ·{" "}
                      {connection?.google_account_email ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Location selected
                    </dt>
                    <dd className="mt-1">
                      {connection?.gbp_location_name ??
                        "Not selected yet — location sync comes in the next phase"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Last synced
                    </dt>
                    <dd className="mt-1">{formatGbpSyncDate(connection?.last_synced_at)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() =>
                    setDisconnectMessage(
                      "Disconnect is UI-only for now. Token removal will ship in a future update."
                    )
                  }
                  className="mt-6 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="mt-4 text-lg font-semibold text-white">
                  Recommended action: <span className="text-brand-300">Connect Google</span>
                </p>
                <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  What AJN will access
                </p>
                <ul className="mt-3 space-y-2">
                  {accessItems.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="text-growth-500">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <GoogleConnectButton />
              </>
            )}

            {(bannerMessage || disconnectMessage) && (
              <p
                className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
                  bannerMessage?.includes("failed") ||
                  bannerMessage?.includes("revoked") ||
                  bannerMessage?.includes("missing required permissions") ||
                  searchParams.get("error")
                    ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-100"
                }`}
              >
                {disconnectMessage ?? bannerMessage}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {isConnected ? "Connected account preview" : "Preview after connecting"}
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/10">
                {previewInitials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {isConnected
                      ? (connection?.gbp_location_name ??
                        connection?.google_account_name ??
                        "Connected Google account")
                      : "Your business profile"}
                  </h3>
                  {isConnected && (
                    <span className="rounded-full bg-growth-500/20 px-2 py-0.5 text-[11px] font-semibold text-growth-400 ring-1 ring-emerald-400/20">
                      Connected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {isConnected
                    ? (connection?.google_account_email ?? "Google account linked")
                    : "Profile details, reviews, and insights will appear here after connection"}
                </p>
                {!isConnected && (
                  <p className="mt-2 text-sm text-slate-400">
                    Live profile data sync is not enabled in this phase.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionCard title="How It Works" subtitle="Four simple steps to connect your profile">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Permission Preview" subtitle="What AJN requests and why">
        <div className="grid gap-4 lg:grid-cols-2">
          {permissions.map((item) => (
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

      <SectionCard title="Connected Profile Preview" subtitle="What you will see after connecting">
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-6 ring-1 ring-brand-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-bold text-brand-600 shadow-sm ring-1 ring-slate-200">
              {previewInitials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-navy-900">
                  {isConnected
                    ? (connection?.gbp_location_name ??
                      connection?.google_account_name ??
                      "Connected Google account")
                    : "Your business profile"}
                </h3>
                {isConnected && (
                  <span className="rounded-full bg-growth-50 px-2.5 py-1 text-[11px] font-semibold text-growth-500 ring-1 ring-emerald-100">
                    Connected
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {isConnected
                  ? (connection?.google_account_email ?? "Google account linked")
                  : "Live profile details will appear here after connection and sync."}
              </p>
              {!isConnected && (
                <p className="mt-3 text-sm text-text-muted">
                  Reviews, insights, and post history sync are coming in the next phase.
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Sync Checklist" subtitle="Data AJN will import after you connect">
        <div className="space-y-3">
          {syncStages.map((stage) => (
            <div
              key={stage}
              className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-navy-900">{stage}</span>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Security & Control" subtitle="How AJN protects your business">
          <div className="grid gap-3 sm:grid-cols-2">
            {securityCards.map((item) => (
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

        <SectionCard title="Next Steps After Connecting" subtitle="What happens once your profile is linked">
          <ol className="space-y-3">
            {nextSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600 ring-1 ring-brand-100">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm font-medium text-navy-900">{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
