"use client";

import { useEffect, useState } from "react";

type SchedulePostModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (scheduledFor: string) => void;
};

function toLocalDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SchedulePostModal({
  open,
  title,
  onClose,
  onConfirm,
}: SchedulePostModalProps) {
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    if (open) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setScheduledFor(toLocalDateTimeValue(tomorrow));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close schedule modal"
        onClick={onClose}
        className="absolute inset-0 bg-[#081426]/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-900/[0.03]">
        <h2 className="text-lg font-bold text-navy-900">Schedule Post</h2>
        <p className="mt-2 text-sm text-text-muted">
          Choose when this post should be published. This is a workflow preview — no real publishing
          happens yet.
        </p>

        <div className="mt-5 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Post</p>
          <p className="mt-1 text-sm font-semibold text-navy-900">{title}</p>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-navy-900">Publish date & time</span>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!scheduledFor}
            onClick={() => onConfirm(new Date(scheduledFor).toISOString())}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
