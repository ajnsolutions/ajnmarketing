/**
 * Hardened website fetch for the public Business Discovery snapshot.
 *
 * The existing lib/website-analysis/fetcher.ts (authenticated path) uses
 * `redirect: "follow"` with no redirect-target revalidation, no redirect-count
 * cap, and no response-size cap — acceptable for an authenticated customer
 * analyzing their own already-connected website, but not safe to expose
 * pre-auth to an anonymous visitor who can point it at anything. This module
 * is the public-safe replacement: manual redirect following with per-hop
 * SSRF revalidation, a bounded redirect chain, a hard response-size cap, and
 * a request timeout.
 */

import type { FetchedWebsite } from "@/lib/website-analysis/types";
import { validatePublicSnapshotUrl, type DnsResolver } from "@/lib/business-discovery/public/urlSafety";

export type PublicSnapshotFetchErrorCode =
  | "timeout"
  | "too_many_redirects"
  | "blocked_redirect"
  | "upstream_error"
  | "too_large";

export class PublicSnapshotFetchError extends Error {
  readonly code: PublicSnapshotFetchErrorCode;

  constructor(message: string, code: PublicSnapshotFetchErrorCode) {
    super(message);
    this.name = "PublicSnapshotFetchError";
    this.code = code;
  }
}

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB — a marketing page has no legitimate reason to exceed this.
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "AJNMarketingSnapshotBot/1.0 (+https://ajnmarketing.com)";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads a response body up to `maxBytes`, aborting the underlying stream the instant the cap is exceeded. */
async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new PublicSnapshotFetchError("That page was too large to analyze.", "too_large");
    }
    return text;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PublicSnapshotFetchError("That page was too large to analyze.", "too_large");
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type FetchImpl = typeof fetch;

/**
 * Fetches a pre-validated URL, following redirects manually (never
 * `redirect: "follow"`) so every hop can be re-validated against the same
 * SSRF policy as the original URL before it's ever requested.
 */
export async function fetchPublicSnapshotWebsite(
  validatedUrl: string,
  options: { resolver?: DnsResolver; fetchImpl?: FetchImpl } = {}
): Promise<FetchedWebsite> {
  const doFetch = options.fetchImpl ?? fetch;
  let currentUrl = validatedUrl;
  let redirectCount = 0;

  for (;;) {
    let response: Response;
    try {
      response = await doFetch(currentUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new PublicSnapshotFetchError("That website took too long to respond.", "timeout");
      }
      throw new PublicSnapshotFetchError("We couldn't reach that website.", "upstream_error");
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    if (isRedirect) {
      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        throw new PublicSnapshotFetchError("That website has too many redirects to follow safely.", "too_many_redirects");
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new PublicSnapshotFetchError("That website's redirect couldn't be followed.", "blocked_redirect");
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new PublicSnapshotFetchError("That website's redirect couldn't be followed.", "blocked_redirect");
      }

      try {
        const revalidated = await validatePublicSnapshotUrl(nextUrl, { resolver: options.resolver });
        currentUrl = revalidated.url;
      } catch {
        throw new PublicSnapshotFetchError("That website redirects somewhere that can't be scanned.", "blocked_redirect");
      }
      continue;
    }

    if (!response.ok) {
      throw new PublicSnapshotFetchError(`That website returned an error (${response.status}).`, "upstream_error");
    }

    const html = await readBodyWithLimit(response, MAX_RESPONSE_BYTES);
    return {
      url: validatedUrl,
      finalUrl: response.url || currentUrl,
      html,
      textContent: stripHtml(html),
      fetchedAt: new Date().toISOString(),
    };
  }
}
