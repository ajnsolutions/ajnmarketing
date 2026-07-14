/**
 * Pure grouping / ordering / summary helpers for the Weekly Approval Package.
 * No Supabase / Next imports — unit-testable in isolation.
 */

import {
  WeeklyPackageItemKinds,
  WeeklyPackagePlatforms,
  type WeeklyPackageExecutiveSummary,
  type WeeklyPackageItem,
  type WeeklyPackagePlatform,
  type WeeklyPackagePlatformGroup,
} from "@/lib/weekly-approval-package/types";

const PLATFORM_ORDER: WeeklyPackagePlatform[] = [
  WeeklyPackagePlatforms.GOOGLE_BUSINESS_PROFILE,
  WeeklyPackagePlatforms.REVIEW_REPLY,
  WeeklyPackagePlatforms.FACEBOOK,
  WeeklyPackagePlatforms.INSTAGRAM,
  WeeklyPackagePlatforms.LINKEDIN,
  WeeklyPackagePlatforms.EMAIL,
  WeeklyPackagePlatforms.OTHER,
];

const PLATFORM_LABELS: Record<WeeklyPackagePlatform, string> = {
  google_business_profile: "Google Business Profile",
  review_reply: "Review replies",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  email: "Email",
  other: "Other",
};

export function platformLabel(platform: WeeklyPackagePlatform): string {
  return PLATFORM_LABELS[platform] ?? "Other";
}

export function mapContentTypeToPlatform(contentType: string): WeeklyPackagePlatform {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("review")) return WeeklyPackagePlatforms.REVIEW_REPLY;
  if (normalized.includes("facebook")) return WeeklyPackagePlatforms.FACEBOOK;
  if (normalized.includes("instagram")) return WeeklyPackagePlatforms.INSTAGRAM;
  if (normalized.includes("linkedin")) return WeeklyPackagePlatforms.LINKEDIN;
  if (normalized.includes("email")) return WeeklyPackagePlatforms.EMAIL;
  if (
    normalized.includes("google") ||
    normalized.includes("gbp") ||
    normalized.includes("business profile")
  ) {
    return WeeklyPackagePlatforms.GOOGLE_BUSINESS_PROFILE;
  }
  return WeeklyPackagePlatforms.OTHER;
}

export function classifyContentDraftKind(contentType: string): typeof WeeklyPackageItemKinds[keyof typeof WeeklyPackageItemKinds] {
  const platform = mapContentTypeToPlatform(contentType);
  if (platform === WeeklyPackagePlatforms.GOOGLE_BUSINESS_PROFILE) {
    return WeeklyPackageItemKinds.GBP_UPDATE;
  }
  return WeeklyPackageItemKinds.CONTENT_DRAFT;
}

/**
 * Stable sort: platform order, then recommendation grouping (nulls last), then newest first.
 */
export function sortWeeklyPackageItems(items: WeeklyPackageItem[]): WeeklyPackageItem[] {
  return [...items].sort((a, b) => {
    const pa = PLATFORM_ORDER.indexOf(a.platform);
    const pb = PLATFORM_ORDER.indexOf(b.platform);
    if (pa !== pb) return pa - pb;

    const ra = a.recommendationId ?? "\uffff";
    const rb = b.recommendationId ?? "\uffff";
    if (ra !== rb) return ra.localeCompare(rb);

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function groupWeeklyPackageItems(items: WeeklyPackageItem[]): WeeklyPackagePlatformGroup[] {
  const sorted = sortWeeklyPackageItems(items);
  const byPlatform = new Map<WeeklyPackagePlatform, WeeklyPackageItem[]>();

  for (const item of sorted) {
    const list = byPlatform.get(item.platform) ?? [];
    list.push(item);
    byPlatform.set(item.platform, list);
  }

  return PLATFORM_ORDER.filter((platform) => byPlatform.has(platform)).map((platform) => ({
    platform,
    platformLabel: platformLabel(platform),
    items: byPlatform.get(platform)!,
  }));
}

export function buildExecutiveSummary(items: WeeklyPackageItem[]): WeeklyPackageExecutiveSummary {
  const totalItems = items.length;
  const counts = new Map<WeeklyPackagePlatform, number>();
  for (const item of items) {
    counts.set(item.platform, (counts.get(item.platform) ?? 0) + 1);
  }

  const byPlatform = PLATFORM_ORDER.filter((p) => counts.has(p)).map((platform) => ({
    platform,
    label: platformLabel(platform),
    count: counts.get(platform)!,
  }));

  const headline =
    totalItems === 0
      ? "Nothing is waiting for your approval this week."
      : totalItems === 1
        ? "We prepared 1 item for you this week."
        : `We prepared ${totalItems} items for you this week.`;

  return { totalItems, headline, byPlatform };
}

export function formatWeekLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
}

export function truncateSummary(text: string, max = 160): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}
