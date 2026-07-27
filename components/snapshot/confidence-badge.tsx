import { DiscoveryConfidenceTiers, type DiscoveryConfidenceTier } from "@/lib/business-discovery/types";
import { confidenceBadgeText } from "@/lib/snapshot-ui/confidenceLanguage";

/**
 * Plain-language confidence treatment. Deliberately never color-only —
 * every tier pairs its (subtle) color with distinct text, so the
 * distinction survives grayscale/colorblind viewing (Part 13's
 * no-color-only-confidence-communication requirement).
 */
const TIER_STYLE: Record<DiscoveryConfidenceTier, string> = {
  [DiscoveryConfidenceTiers.KNOWN]: "bg-growth-50 text-growth-500 ring-emerald-100",
  [DiscoveryConfidenceTiers.ASSUMED]: "bg-brand-50 text-brand-600 ring-brand-100",
  [DiscoveryConfidenceTiers.MISSING]: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ConfidenceBadge({ tier }: { tier: DiscoveryConfidenceTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TIER_STYLE[tier]}`}
    >
      {confidenceBadgeText(tier)}
    </span>
  );
}
