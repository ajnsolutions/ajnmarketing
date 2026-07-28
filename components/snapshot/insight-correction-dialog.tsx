"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Accessible correction dialog — focus moves in on open, Escape and the
 * backdrop close it, focus returns to the trigger on close, and Tab is
 * trapped within the dialog while open. Built fresh rather than reusing
 * components/dashboard/schedule-post-modal.tsx, which doesn't implement
 * focus trapping/return — this is the pattern future dialogs in this
 * codebase should follow.
 */
export function InsightCorrectionDialog({
  open,
  label,
  currentValue,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  label: string;
  currentValue: string;
  onClose: () => void;
  onSave: (correctedValue: string, note: string) => void;
  saving: boolean;
}) {
  const [correctedValue, setCorrectedValue] = useState(currentValue);
  const [note, setNote] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Reset the form fields whenever the dialog transitions to open — adjusting
  // state during render (React's recommended pattern for this) rather than in
  // an effect, since an effect would call setState synchronously on mount.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCorrectedValue(currentValue);
      setNote("");
    }
  }

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close correction dialog"
        onClick={onClose}
        className="absolute inset-0 bg-[#081426]/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-dialog-title"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-slate-900/[0.03] sm:rounded-2xl sm:pb-6"
      >
        <h2 id="correction-dialog-title" className="text-lg font-bold text-navy-900">
          Let&apos;s fix that
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Here&apos;s what I currently understand about <span className="font-semibold text-navy-900">{label.toLowerCase()}</span>.
          Tell me what&apos;s actually right.
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-navy-900">Correct answer</span>
          <textarea
            ref={inputRef}
            rows={3}
            value={correctedValue}
            onChange={(event) => setCorrectedValue(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-navy-900 shadow-sm ring-1 ring-slate-900/[0.03] focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-navy-900">
            Add a note <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything else I should know?"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-navy-900 shadow-sm ring-1 ring-slate-900/[0.03] focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !correctedValue.trim()}
            onClick={() => onSave(correctedValue.trim(), note.trim())}
            className="min-h-11 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
}
