import type { ReactNode } from "react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Sparkline() {
  return (
    <svg
      viewBox="0 0 72 28"
      className="h-7 w-[4.5rem] shrink-0"
      aria-hidden="true"
    >
      <path
        d="M2 22 L14 18 L24 19 L34 14 L44 15 L54 10 L64 8 L70 6"
        fill="none"
        stroke="#22C55E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="6" r="2" fill="#22C55E" />
    </svg>
  );
}

function MetricIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand-600 ring-1 ring-slate-200">
      {children}
    </div>
  );
}

const metricIcons = {
  ranking: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M10 19V9M16 19v-6M22 19V3" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.6 6.5L21 9.5l-5 4.3 1.5 6.5L12 17.8 6.5 20.3 8 13.8 3 9.5l6.4-.9L12 2Z" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  ),
} as const;

function MetricRow({
  label,
  before,
  after,
  icon,
}: {
  label: string;
  before: string;
  after: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-slate-100 px-5 py-4">
      <MetricIcon>{icon}</MetricIcon>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-400">{before}</span>
          <span className="text-slate-300">→</span>
          <span className="text-base font-bold text-brand-600">{after}</span>
        </div>
      </div>
      <Sparkline />
    </div>
  );
}

export function HeroMarketingVisual() {
  return (
    <div className="relative lg:translate-y-1">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-brand-100/25 blur-3xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/30 ring-1 ring-slate-900/[0.04]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-surface px-5 py-3.5">
          <div className="flex items-center gap-2">
            <GoogleIcon />
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Google Business Profile
            </span>
          </div>
          <span className="rounded-full bg-growth-50 px-3 py-1 text-xs font-semibold text-growth-500 ring-1 ring-emerald-100">
            Optimized
          </span>
        </div>

        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-base font-bold text-brand-600 ring-1 ring-brand-100">
              RP
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-900">Riverside Plumbing</h3>
              <p className="mt-1 text-sm text-text-muted">
                Serving homeowners across your local area
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-amber-500">
                  ★★★★★ 4.9 (128)
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-text-muted">Plumber</span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-growth-500">Open now</span>
              </div>
            </div>
          </div>
        </div>

        <MetricRow
          label="Google Ranking"
          before="Position #4"
          after="Position #1"
          icon={metricIcons.ranking}
        />
        <MetricRow
          label="Review Rating"
          before="4.2"
          after="4.9"
          icon={metricIcons.review}
        />
        <MetricRow
          label="Monthly Leads"
          before="12"
          after="47"
          icon={metricIcons.leads}
        />
      </div>
    </div>
  );
}
