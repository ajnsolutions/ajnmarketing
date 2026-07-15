import { createHash } from "node:crypto";
import type { InteractiveDemoResult } from "@/lib/interactive-demo/types";

type CacheEntry = {
  expiresAt: number;
  value: InteractiveDemoResult;
};

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 15 * 60 * 1000;

export function demoCacheKey(websiteUrl: string): string {
  return createHash("sha256").update(websiteUrl.trim().toLowerCase()).digest("hex");
}

export function getCachedDemoResult(websiteUrl: string): InteractiveDemoResult | null {
  const key = demoCacheKey(websiteUrl);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value, meta: { ...entry.value.meta, cached: true } };
}

export function setCachedDemoResult(
  websiteUrl: string,
  value: InteractiveDemoResult,
  ttlMs = DEFAULT_TTL_MS,
): void {
  cache.set(demoCacheKey(websiteUrl), {
    expiresAt: Date.now() + ttlMs,
    value: { ...value, meta: { ...value.meta, cached: false } },
  });
}

export function resetDemoResultCache(): void {
  cache.clear();
}
