"use client";

import Image from "next/image";

export function DashboardTopbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onMenuClick}
            className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-navy-900 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0 lg:hidden">
            <Image
              src="/images/AJN_marketing_logo.png"
              alt="AJN Marketing"
              width={96}
              height={48}
              className="h-8 w-auto"
            />
          </div>

          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Company
            </p>
            <button
              type="button"
              className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-navy-900 transition-colors hover:text-brand-600"
            >
              Riverside Plumbing Co.
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-400" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-navy-900 shadow-sm transition-colors hover:bg-slate-50 sm:inline-flex sm:items-center sm:gap-2"
          >
            Riverside Plumbing Co.
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-400" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2.5 text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m10-2.5a6.5 6.5 0 0 0-13 0V18a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3.5Z" />
            </svg>
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-colors hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#081426] text-xs font-bold text-white">
              MR
            </span>
            <span className="hidden text-sm font-medium text-navy-900 sm:inline">
              Mike R.
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
