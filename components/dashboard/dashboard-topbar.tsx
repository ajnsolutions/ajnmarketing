"use client";

import Image from "next/image";
import Link from "next/link";

export function DashboardTopbar({
  businessName,
  userName,
  userInitials,
  onMenuClick,
}: {
  businessName: string;
  userName: string;
  userInitials: string;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onMenuClick}
            className="hom-focusable inline-flex rounded-xl border border-slate-200 bg-white p-2 text-navy-900 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Business
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-navy-900">{businessName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard/settings"
            className="hidden max-w-[220px] truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-navy-900 shadow-sm transition-colors hover:bg-slate-50 md:inline-flex"
          >
            {businessName}
          </Link>

          <Link
            href="/dashboard/notifications"
            aria-label="Notifications"
            className="hom-focusable relative inline-flex rounded-xl border border-slate-200 bg-white p-2.5 text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m10-2.5a6.5 6.5 0 0 0-13 0V18a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3.5Z" />
            </svg>
          </Link>

          <Link
            href="/dashboard/settings"
            aria-label={`Settings for ${userName}`}
            className="hom-focusable inline-flex max-w-[220px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-colors hover:bg-slate-50 sm:gap-3 sm:pr-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#081426] text-xs font-bold text-white">
              {userInitials}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-sm font-semibold leading-tight text-navy-900">
                {userName}
              </span>
              <span className="block truncate text-xs leading-tight text-text-muted">
                {businessName}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
