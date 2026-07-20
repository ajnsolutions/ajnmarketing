import type { CustomerStatusPresentation, StatusTone } from "@/lib/customer-ux/statusVocabulary";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-white text-navy-900 ring-slate-200",
  info: "bg-brand-50 text-brand-700 ring-brand-100",
  success: "bg-growth-50 text-growth-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-800 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  muted: "bg-slate-50 text-slate-600 ring-slate-200",
};

/**
 * Status badge with text label + tone. Never color-only — label is always present.
 */
export function StatusBadge({
  presentation,
  className = "",
}: {
  presentation: CustomerStatusPresentation;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${TONE_CLASSES[presentation.tone]} ${className}`}
      title={presentation.description}
    >
      <span className="sr-only">{presentation.description}. Status: </span>
      {presentation.label}
    </span>
  );
}

export function ConfidenceBadge({
  presentation,
  className = "",
}: {
  presentation: CustomerStatusPresentation;
  className?: string;
}) {
  return <StatusBadge presentation={presentation} className={className} />;
}
