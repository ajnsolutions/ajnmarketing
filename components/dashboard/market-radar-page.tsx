"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { groupMarketRadarEntriesForDisplay } from "@/lib/market-radar/display";
import { MarketRadarEntryKinds, type MarketRadarEntry, type MarketRadarEntryKind } from "@/lib/market-radar/types";

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

function AddEntryForm({
  kind,
  busy,
  onAdd,
}: {
  kind: MarketRadarEntryKind;
  busy: boolean;
  onAdd: (name: string, notes: string) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const label = kind === MarketRadarEntryKinds.COMPETITOR ? "competitor" : "benchmark";

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Business name`}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={busy || name.trim().length === 0}
        onClick={() => {
          onAdd(name, notes);
          setName("");
          setNotes("");
        }}
        className="hom-focusable rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        + Add a {label}
      </button>
    </div>
  );
}

function EntryList({
  entries,
  emptyMessage,
  busy,
  onRemove,
}: {
  entries: MarketRadarEntry[];
  emptyMessage: string;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="border-b border-slate-100 pb-4 last:border-b-0">
          <p className="text-sm font-semibold text-navy-900">{entry.name}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-muted">{entry.notes ?? ""}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(entry.id)}
              className="hom-focusable text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MarketRadarPage({ initialEntries }: { initialEntries: MarketRadarEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { competitors, benchmarks } = groupMarketRadarEntriesForDisplay(entries);

  async function handleAdd(kind: MarketRadarEntryKind, name: string, notes: string) {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/market-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, notes: notes.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { entry?: MarketRadarEntry; error?: string } | null;
      if (!response.ok || !payload?.entry) {
        setMessage(payload?.error ?? "Something went wrong.");
        return;
      }
      setEntries((prev) => [...prev, payload.entry as MarketRadarEntry]);
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/market-radar/${id}`, { method: "DELETE" });
      if (response.ok) {
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Market Radar</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Keeping an eye on your market</h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          This is the list of businesses you&apos;ve told us to keep in view — a self-managed list, not an automatic
          feed. Add a competitor to track, or a benchmark business you admire.
        </p>
      </header>

      <SectionCard
        title={`Tracking ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}`}
        subtitle="Businesses you're directly up against."
      >
        <EntryList
          entries={competitors}
          emptyMessage="You haven't added any competitors yet. Add one below to start tracking it here."
          busy={busy}
          onRemove={handleRemove}
        />
        <AddEntryForm kind={MarketRadarEntryKinds.COMPETITOR} busy={busy} onAdd={(name, notes) => void handleAdd(MarketRadarEntryKinds.COMPETITOR, name, notes)} />
      </SectionCard>

      <SectionCard title="Benchmarking" subtitle="For inspiration and pattern-matching — not a head-to-head comparison.">
        <EntryList
          entries={benchmarks}
          emptyMessage="You haven't added any benchmarks yet. Add a business you admire below."
          busy={busy}
          onRemove={handleRemove}
        />
        <AddEntryForm kind={MarketRadarEntryKinds.BENCHMARK} busy={busy} onAdd={(name, notes) => void handleAdd(MarketRadarEntryKinds.BENCHMARK, name, notes)} />
      </SectionCard>

      {message ? (
        <p className="text-sm text-navy-900" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
