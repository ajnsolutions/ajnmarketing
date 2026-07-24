/**
 * [RC-1 fix] Previously the Brand Voice page hardcoded a "Strong Match" badge
 * regardless of the real analysis score (and even when there was no score at all).
 * This is the honest, tiered replacement — pure so it's directly testable.
 */
export function matchScoreLabel(score: number | null): { label: string; tone: string } {
  if (score == null) return { label: "Not yet analyzed", tone: "bg-white/10 text-slate-300 ring-white/10" };
  if (score < 40) return { label: "Early signal", tone: "bg-amber-500/15 text-amber-300 ring-amber-400/20" };
  if (score < 70) return { label: "Good match", tone: "bg-brand-500/15 text-brand-300 ring-brand-400/20" };
  return { label: "Strong match", tone: "bg-growth-500/15 text-growth-500 ring-emerald-400/20" };
}
