import "server-only";

import { logMarketContextProviderError } from "@/lib/market-context/providers/providerLogger";

export type RssFeedItem = {
  title: string;
  link: string | null;
  pubDate: Date | null;
  description: string;
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readTag(block: string, tagNames: string[]): string {
  for (const tag of tagNames) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match?.[1]) {
      return decodeXmlEntities(match[1]);
    }
  }
  return "";
}

function parseDate(value: string): Date | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRssItems(xml: string): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  for (const block of blocks) {
    const title = readTag(block, ["title"]);
    if (!title) continue;

    const link =
      readTag(block, ["link"]) ||
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
      null;

    const pubDate = parseDate(
      readTag(block, ["pubDate", "published", "updated", "dc:date"])
    );

    const description = readTag(block, ["description", "summary", "content"]);

    items.push({
      title,
      link,
      pubDate,
      description,
    });
  }

  return items;
}

function looksLikeFeedXml(xml: string): boolean {
  return /<rss|<feed|<channel/i.test(xml);
}

export async function fetchRssFeedItems(feedUrl: string, limit = 10): Promise<RssFeedItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "User-Agent": "AJN Marketing Market Context",
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    if (!looksLikeFeedXml(xml)) {
      return [];
    }

    return parseRssItems(xml).slice(0, limit);
  } catch (error) {
    logMarketContextProviderError("rss", `Failed to fetch feed ${feedUrl}`, error);
    return [];
  }
}

export function filterUpcomingFeedItems(
  items: RssFeedItem[],
  referenceDate: Date,
  maxDaysAhead = 45
): RssFeedItem[] {
  const referenceMs = new Date(referenceDate).setHours(0, 0, 0, 0);

  return items
    .filter((item) => {
      if (!item.pubDate) return true;
      const eventMs = new Date(item.pubDate).setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((eventMs - referenceMs) / (1000 * 60 * 60 * 24));
      return daysUntil >= -7 && daysUntil <= maxDaysAhead;
    })
    .slice(0, 5);
}
