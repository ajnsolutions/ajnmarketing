import type { FetchedWebsite } from "@/lib/website-analysis/types";

function normalizeWebsiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("Website URL is required");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWebsiteContent(rawUrl: string): Promise<FetchedWebsite> {
  const url = normalizeWebsiteUrl(rawUrl);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AJNMarketingBot/1.0 (+https://ajnmarketing.com)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch website (${response.status})`);
  }

  const html = await response.text();

  return {
    url,
    finalUrl: response.url,
    html,
    textContent: stripHtml(html),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchWebsiteContentSafe(rawUrl: string): Promise<FetchedWebsite | null> {
  try {
    return await fetchWebsiteContent(rawUrl);
  } catch {
    return null;
  }
}
