const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractUrls(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const matches = text.match(URL_REGEX) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;]+$/, "")))];
}

export function normalizeWebsiteOrigin(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;

  try {
    const withProtocol = website.trim().startsWith("http") ? website.trim() : `https://${website.trim()}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function isLikelyEventFeedUrl(url: string): boolean {
  return /rss|feed|atom|calendar|events|ical|\.xml$/i.test(url);
}

export function isGoogleBusinessUrl(url: string): boolean {
  return /google\.(?:com|[a-z]{2,3})\/maps|g\.co\/|goo\.gl\/maps|business\.google\.com/i.test(
    url
  );
}

export function isSocialProfileUrl(url: string): boolean {
  return /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com/i.test(
    url
  );
}

export function stripUrlsFromText(text: string): string {
  return text.replace(URL_REGEX, " ").replace(/\s+/g, " ").trim();
}
