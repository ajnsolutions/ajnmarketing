export type ContextSignalSourceKind = "live" | "profile-based" | "fallback" | "unknown";

export function getContextSignalSourceKind(
  metadata: Record<string, unknown> | null | undefined
): ContextSignalSourceKind {
  if (!metadata) return "unknown";

  if (
    metadata.isProfileBased === true ||
    metadata.provider === "profile.competitors"
  ) {
    return "profile-based";
  }

  if (metadata.isFallback === true || metadata.mock === true) {
    return "fallback";
  }

  if (metadata.isFallback === false) {
    return "live";
  }

  const provider = String(metadata.provider ?? "");
  if (provider === "mock") {
    return "fallback";
  }

  if (
    provider === "weather.gov" ||
    provider === "nager.date" ||
    provider === "rss"
  ) {
    return "live";
  }

  return "unknown";
}

export function getContextSignalSourceLabel(
  metadata: Record<string, unknown> | null | undefined
): string {
  const kind = getContextSignalSourceKind(metadata);

  if (kind === "profile-based") {
    return "Profile-based";
  }

  if (kind === "live") {
    const provider = String(metadata?.provider ?? "live");
    if (provider === "weather.gov") return "Live · Weather.gov";
    if (provider === "nager.date") return "Live · Nager.Date";
    if (provider === "rss") return "Live · RSS";
    return "Live signal";
  }

  if (kind === "fallback") {
    return "Fallback";
  }

  return "Estimated";
}

export function getContextSignalSourceStyles(
  metadata: Record<string, unknown> | null | undefined
): string {
  const kind = getContextSignalSourceKind(metadata);

  if (kind === "live") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (kind === "profile-based") {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }

  if (kind === "fallback") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}
