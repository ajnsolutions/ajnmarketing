"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  formatSearchConsoleConnectionStatus,
  formatSearchConsoleSyncDate,
} from "@/lib/google-search-console/persistence";
import type {
  GoogleSearchConsoleConnectionStatusResult,
  GoogleSearchConsoleProperty,
} from "@/lib/google-search-console/types";

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function ConnectButton() {
  return (
    <a
      href="/api/google-search-console/connect"
      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#081426] shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-lg"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Connect Search Console
    </a>
  );
}

export function SearchConsoleConnectPage({
  initialStatus,
  initialProperties,
}: {
  initialStatus: GoogleSearchConsoleConnectionStatusResult;
  initialProperties: GoogleSearchConsoleProperty[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initialStatus);
  const [properties, setProperties] = useState(initialProperties);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connection = status.connection;
  const isConnected = status.connected && connection?.connection_status === "connected";
  const isReady = isConnected && status.propertySelected;

  const bannerMessage = (() => {
    if (message) return message;
    if (searchParams.get("connected") === "1") {
      return "Search Console connected. Choose a property below, then sync to start building Business Brain evidence.";
    }
    const error = searchParams.get("error");
    if (error) {
      return "Google connection did not finish. You can try again, or continue without Search Console for now.";
    }
    if (!status.scopesValid && connection) {
      return "Search Console is missing required permissions and needs to be reconnected.";
    }
    if (connection?.connection_status === "revoked") {
      return "Search Console access was revoked or is no longer valid. Reconnect to restore insights.";
    }
    if (isConnected && !status.propertySelected) {
      return "Search Console is connected — select a property below to start syncing search performance.";
    }
    return null;
  })();

  async function handleSelectProperty(siteUrl: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/google-search-console/properties/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to select that property.");
        return;
      }
      setMessage(`Selected ${siteUrl}. Syncing now may take a few minutes to populate insights.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshProperties() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/google-search-console/properties", { method: "POST" });
      const payload = (await response.json()) as { properties?: GoogleSearchConsoleProperty[]; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to refresh properties.");
        return;
      }
      setProperties(payload.properties ?? []);
      setMessage("Property list refreshed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/google-search-console/sync", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to start sync.");
        return;
      }
      setMessage("Sync started. Search performance evidence will appear in Growth Advisor once it completes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/google-search-console/disconnect", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to disconnect.");
        return;
      }
      setProperties([]);
      setStatus({
        setupRequired: false,
        connected: false,
        connection: null,
        scopesValid: true,
        missingScopes: [],
        propertySelected: false,
      });
      setMessage("Search Console disconnected. You can reconnect anytime.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <Link
          href="/dashboard/business-connections"
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          ← Back to Business Connections
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Connect Search Console
        </h1>
        <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
          Optional connection. We use which searches bring people to your site to sharpen
          recommendations — never to publish or change anything on your behalf. You can skip
          this and continue using Growth Advisor without it.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Current Status
          </p>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              status.setupRequired
                ? "bg-amber-500/15 text-amber-300 ring-amber-400/20"
                : isReady
                  ? "bg-growth-500/15 text-growth-300 ring-emerald-400/20"
                  : "bg-amber-500/15 text-amber-300 ring-amber-400/20"
            }`}
          >
            {status.setupRequired
              ? "Setup Required"
              : !status.scopesValid && connection
                ? "Missing Permissions"
                : isConnected && !status.propertySelected
                  ? "Property Needed"
                  : formatSearchConsoleConnectionStatus(connection?.connection_status ?? "not_connected")}
          </span>
        </div>

        {status.setupRequired ? (
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Search Console connection is temporarily unavailable. This is optional — you can keep
            using Growth Advisor without it.
          </p>
        ) : isConnected ? (
          <>
            <dl className="mt-5 space-y-3 text-sm text-slate-200">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-400">Connected account</dt>
                <dd className="mt-1">
                  {connection?.google_account_name ?? "Google account"} · {connection?.google_account_email ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-400">Selected property</dt>
                <dd className="mt-1">{connection?.selected_site_url ?? "Not selected yet — choose one below"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-400">Last synced</dt>
                <dd className="mt-1">{formatSearchConsoleSyncDate(connection?.last_synced_at)}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              {status.propertySelected && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSync}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  Sync now
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleDisconnect}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg font-semibold text-white">
              Recommended action: <span className="text-brand-300">Connect Search Console</span>
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              We&apos;ll only read search performance (queries, pages, clicks, impressions) —
              read-only access, nothing is ever published on your behalf.
            </p>
            <ConnectButton />
          </>
        )}

        {bannerMessage && (
          <p
            className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
              bannerMessage.includes("revoked") || bannerMessage.includes("did not finish") || bannerMessage.includes("Unable")
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border-amber-400/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            {bannerMessage}
          </p>
        )}
      </section>

      {isConnected && (
        <SectionCard
          title="Choose a property"
          subtitle="Select the verified site whose search performance should feed the Business Brain"
        >
          {properties.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                No verified properties found yet for this Google account. Verify a site in{" "}
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Google Search Console
                </a>
                , then refresh.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleRefreshProperties}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh properties
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => (
                <div
                  key={property.site_url}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{property.site_url}</p>
                    <p className="text-xs text-text-muted">{property.permission_level ?? "Verified"}</p>
                  </div>
                  {connection?.selected_site_url === property.site_url ? (
                    <span className="rounded-full bg-growth-50 px-2.5 py-1 text-[11px] font-semibold text-growth-500 ring-1 ring-emerald-100">
                      Selected
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelectProperty(property.site_url)}
                      className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                    >
                      Select
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={handleRefreshProperties}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60"
              >
                Refresh property list
              </button>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="What we learn from Search Console" subtitle="How this strengthens the Business Brain">
        <ul className="space-y-2 text-sm leading-6 text-slate-600">
          <li>• Rising and declining queries — which searches bring more or fewer visitors</li>
          <li>• Pages gaining or losing search visibility</li>
          <li>• Search opportunities — where you show up but aren&apos;t getting clicked</li>
          <li>• Possible seasonal or trend shifts in demand</li>
        </ul>
        <p className="mt-4 text-sm text-text-muted">
          Search Console usually takes 2-3 days to finalize new data, and this connection needs at
          least a couple of weeks of history to compare against — so insights build up gradually,
          not immediately after connecting.
        </p>
      </SectionCard>

      <SectionCard title="Security & Control" subtitle="How AJN protects your Search Console access">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Read-only access", description: "We only request webmasters.readonly — AJN cannot change anything in Search Console." },
            { title: "You can disconnect anytime", description: "Remove access instantly from this page or your Google account." },
            { title: "Nothing is published", description: "Search Console only supplies evidence — it never triggers publishing." },
            { title: "Secure OAuth connection", description: "Industry-standard Google sign-in — AJN never stores your Google password." },
          ].map((item) => (
            <article key={item.title} className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
              <h3 className="font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
