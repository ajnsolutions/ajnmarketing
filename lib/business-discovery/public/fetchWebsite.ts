/**
 * Hardened, DNS-pinned website fetch for the public Business Discovery
 * snapshot.
 *
 * The existing lib/website-analysis/fetcher.ts (authenticated path) uses
 * `fetch(url, { redirect: "follow" })` with no redirect-target revalidation,
 * no redirect-count cap, no response-size cap, and no protection against a
 * hostname re-resolving to a different address between validation and
 * connection — acceptable for an authenticated customer analyzing their own
 * already-connected website, not safe pre-auth. This module is the public
 * replacement: manual redirect following with per-hop SSRF revalidation, a
 * bounded redirect chain, a hard response-size cap, a request timeout, and —
 * as of this pass — a DNS-pinned connection (see pinnedRequest.ts) so the
 * literal IP address validated by urlSafety.ts is the literal IP address the
 * socket actually connects to, at every hop.
 */

import * as zlib from "node:zlib";
import type { FetchedWebsite } from "@/lib/website-analysis/types";
import { validatePublicSnapshotUrl, type DnsResolver, type ValidatedPublicUrl } from "@/lib/business-discovery/public/urlSafety";
import { performPinnedRequest, PinnedRequestTimeoutError, type PinnedResponse } from "@/lib/business-discovery/public/pinnedRequest";

export type PublicSnapshotFetchErrorCode =
  | "timeout"
  | "too_many_redirects"
  | "blocked_redirect"
  | "upstream_error"
  | "too_large"
  | "pinning_unavailable";

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

function decodeContentEncoding(stream: NodeJS.ReadableStream, contentEncoding: string | undefined): NodeJS.ReadableStream {
  switch ((contentEncoding ?? "").toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return stream.pipe(zlib.createGunzip());
    case "deflate":
      return stream.pipe(zlib.createInflate());
    case "br":
      return stream.pipe(zlib.createBrotliDecompress());
    default:
      return stream;
  }
}

/**
 * Reads a (possibly decompressed) stream up to `maxBytes`, destroying the
 * underlying stream the instant the cap is exceeded. The cap is enforced on
 * the *decoded* output, so a compressed response can't bypass it via a
 * decompression bomb.
 */
async function readBodyWithLimit(stream: NodeJS.ReadableStream, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > maxBytes) {
      if ("destroy" in stream && typeof (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy === "function") {
        (stream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
      }
      throw new PublicSnapshotFetchError("That page was too large to analyze.", "too_large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type PerformPinnedRequestFn = typeof performPinnedRequest;

/**
 * Fetches a pre-validated URL, following redirects manually and re-validating
 * (and re-pinning) every hop against the identical SSRF policy — never
 * `redirect: "follow"`, and never a connection made by hostname alone.
 */
export async function fetchPublicSnapshotWebsite(
  validated: ValidatedPublicUrl,
  options: { resolver?: DnsResolver; requestImpl?: PerformPinnedRequestFn } = {}
): Promise<FetchedWebsite> {
  const doRequest = options.requestImpl ?? performPinnedRequest;
  let current = validated;
  let redirectCount = 0;

  for (;;) {
    if (!current.pinnedAddress) {
      // Fail closed — never proceed without a validated, pinned address.
      throw new PublicSnapshotFetchError("Couldn't safely verify that website's address.", "pinning_unavailable");
    }

    const url = new URL(current.url);
    let response: PinnedResponse;
    try {
      response = await doRequest({
        protocol: current.protocol,
        hostname: current.hostname,
        pinnedAddress: current.pinnedAddress,
        port: current.port,
        path: `${url.pathname}${url.search}`,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "gzip, deflate, br" },
        timeoutMs: FETCH_TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof PinnedRequestTimeoutError) {
        throw new PublicSnapshotFetchError("That website took too long to respond.", "timeout");
      }
      throw new PublicSnapshotFetchError("We couldn't reach that website.", "upstream_error");
    }

    const isRedirect = response.statusCode >= 300 && response.statusCode < 400;
    if (isRedirect) {
      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        throw new PublicSnapshotFetchError("That website has too many redirects to follow safely.", "too_many_redirects");
      }

      const location = response.headers.location;
      if (!location || Array.isArray(location)) {
        throw new PublicSnapshotFetchError("That website's redirect couldn't be followed.", "blocked_redirect");
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(location, current.url).toString();
      } catch {
        throw new PublicSnapshotFetchError("That website's redirect couldn't be followed.", "blocked_redirect");
      }

      try {
        // Every hop is independently validated AND re-pinned — a redirect
        // target's own hostname is resolved and classified fresh, exactly
        // like the original URL, never inheriting the previous hop's trust.
        current = await validatePublicSnapshotUrl(nextUrl, { resolver: options.resolver });
      } catch {
        throw new PublicSnapshotFetchError("That website redirects somewhere that can't be scanned.", "blocked_redirect");
      }
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new PublicSnapshotFetchError(`That website returned an error (${response.statusCode}).`, "upstream_error");
    }

    const decoded = decodeContentEncoding(response.body, Array.isArray(response.headers["content-encoding"]) ? undefined : response.headers["content-encoding"]);
    const html = await readBodyWithLimit(decoded, MAX_RESPONSE_BYTES);
    return {
      url: validated.url,
      finalUrl: current.url,
      html,
      textContent: stripHtml(html),
      fetchedAt: new Date().toISOString(),
    };
  }
}
