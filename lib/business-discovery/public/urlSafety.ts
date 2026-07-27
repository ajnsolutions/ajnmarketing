/**
 * SSRF hardening for the public Business Discovery snapshot.
 *
 * Extends the existing pattern in lib/interactive-demo/url-safety.ts
 * (scheme check + hostname regex blocklist) with:
 * - explicit credentials-in-URL rejection
 * - a real IPv4/IPv6 classifier (not just regex on the raw hostname string) —
 *   covers loopback, RFC1918 private ranges, link-local (incl. the
 *   169.254.169.254 cloud metadata address), carrier-grade NAT, and
 *   IPv4-mapped IPv6 (::ffff:a.b.c.d, a classic blocklist-bypass vector)
 * - DNS-resolution validation for hostnames, returning the specific validated
 *   address (`pinnedAddress`) the caller must connect to — see
 *   lib/business-discovery/public/pinnedRequest.ts and fetchWebsite.ts, which
 *   dial that literal address directly instead of re-resolving the hostname,
 *   closing the DNS-rebinding gap between validation and connection (see
 *   docs/BUSINESS_DISCOVERY_PUBLIC_SNAPSHOT.md's DNS pinning model).
 *
 * Node's WHATWG URL parser already canonicalizes obfuscated IPv4 literals
 * (decimal, octal, hex, shorthand) into standard dotted-decimal form during
 * parsing — this module only ever inspects `parsed.hostname`, never the raw
 * input string, so it gets that protection for free. Verified in
 * unit-tests/business-discovery-public-url-safety.test.ts.
 */

import { promises as dns } from "node:dns";

export class PublicSnapshotUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSnapshotUrlError";
  }
}

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
  /^metadata$/i,
];

function ipv4ToInt(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function parseIPv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((n) => n > 255)) return null;
  return octets;
}

/** True for loopback, RFC1918 private, link-local (incl. cloud metadata), CGNAT, and other non-public IPv4 ranges. */
function isBlockedIPv4(octets: number[]): boolean {
  const value = ipv4ToInt(octets);
  const inRange = (base: string, maskBits: number): boolean => {
    const baseOctets = base.split(".").map(Number);
    const baseValue = ipv4ToInt(baseOctets);
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  };

  return (
    inRange("0.0.0.0", 8) || // "this network"
    inRange("10.0.0.0", 8) || // RFC1918
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local incl. 169.254.169.254 cloud metadata
    inRange("172.16.0.0", 12) || // RFC1918
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.0.2.0", 24) || // TEST-NET-1
    inRange("192.168.0.0", 16) || // RFC1918
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("198.51.100.0", 24) || // TEST-NET-2
    inRange("203.0.113.0", 24) || // TEST-NET-3
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  );
}

/**
 * Expands a bracketed or bare IPv6 literal into 8 sixteen-bit groups, or null
 * if not a valid IPv6 literal. Assumes syntactically valid IPv6 as guaranteed
 * by having already round-tripped through the WHATWG URL parser (`new URL()`
 * already rejects malformed IPv6 literals before this ever runs) — this is
 * not a general-purpose, untrusted-input IPv6 validator.
 */
function expandIPv6(rawHost: string): number[] | null {
  const host = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
  if (!host.includes(":")) return null;

  const [headPart, tailPart] = host.split("::");
  if (tailPart === undefined && !host.includes("::")) {
    // No "::" shorthand — must be exactly 8 groups.
    const groups = host.split(":");
    if (groups.length !== 8) return null;
    const parsed = groups.map((g) => parseInt(g, 16));
    return parsed.some((n) => Number.isNaN(n)) ? null : parsed;
  }

  const headGroups = headPart ? headPart.split(":").filter(Boolean) : [];
  const tailGroups = tailPart ? tailPart.split(":").filter(Boolean) : [];
  const missing = 8 - (headGroups.length + tailGroups.length);
  if (missing < 0) return null;

  const allGroups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  if (allGroups.length !== 8) return null;
  const parsed = allGroups.map((g) => parseInt(g, 16));
  return parsed.some((n) => Number.isNaN(n)) ? null : parsed;
}

/** True for ::1, fe80::/10, fc00::/7, the unspecified address, and IPv4-mapped addresses whose embedded IPv4 is itself blocked. */
function isBlockedIPv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  const isLoopback = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1;
  const isUnspecified = groups.every((g) => g === 0);
  const isLinkLocal = (g0 & 0xffc0) === 0xfe80; // fe80::/10
  const isUniqueLocal = (g0 & 0xfe00) === 0xfc00; // fc00::/7

  if (isLoopback || isUnspecified || isLinkLocal || isUniqueLocal) return true;

  // IPv4-mapped: ::ffff:a.b.c.d -> groups[0..4] === 0, groups[5] === 0xffff.
  const isIPv4Mapped = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff;
  if (isIPv4Mapped) {
    const embeddedOctets = [(g6 >> 8) & 0xff, g6 & 0xff, (g7 >> 8) & 0xff, g7 & 0xff];
    return isBlockedIPv4(embeddedOctets);
  }

  return false;
}

/** Classifies a single hostname/IP-literal string (never resolves DNS — pure and synchronous). */
export function isBlockedHostLiteral(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const ipv4 = parseIPv4(normalized);
  if (ipv4) return isBlockedIPv4(ipv4);

  const ipv6 = expandIPv6(host); // preserve brackets/case for IPv6 literal detection
  if (ipv6) return isBlockedIPv6(ipv6);

  return false;
}

export type DnsResolver = (hostname: string) => Promise<string[]>;

async function defaultResolver(hostname: string): Promise<string[]> {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
}

export type ValidatedPublicUrl = {
  /** The canonical, re-serialized URL (never the raw visitor input) — this is what gets fetched. */
  url: string;
  /** The original hostname — preserved for the Host header and TLS SNI/certificate verification. Never used for the actual socket connection. */
  hostname: string;
  /**
   * The specific, already-validated literal IP address the caller must
   * connect to (bracket-free for IPv6). This is the fix for DNS rebinding:
   * the fetch layer dials this literal address directly, so nothing between
   * validation and connection can re-resolve the hostname to a different,
   * unvalidated address.
   */
  pinnedAddress: string;
  port: number;
  protocol: "http:" | "https:";
};

/**
 * Validates a visitor-supplied website URL for the public snapshot path.
 * Throws PublicSnapshotUrlError with a customer-safe message on any rejection.
 * Performs a DNS resolution check for non-literal hostnames (skippable via
 * `resolver` injection in tests — never touches real DNS in the test suite).
 */
export async function validatePublicSnapshotUrl(
  rawUrl: string,
  options: { resolver?: DnsResolver } = {}
): Promise<ValidatedPublicUrl> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new PublicSnapshotUrlError("Enter a website URL to get started.");
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new PublicSnapshotUrlError("Enter a valid website address, like yourbusiness.com.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PublicSnapshotUrlError("Website addresses must use http or https.");
  }

  if (parsed.username || parsed.password) {
    throw new PublicSnapshotUrlError("Website addresses with a username or password aren't supported.");
  }

  if (!parsed.hostname) {
    throw new PublicSnapshotUrlError("Enter a valid website address, like yourbusiness.com.");
  }

  if (isBlockedHostLiteral(parsed.hostname)) {
    throw new PublicSnapshotUrlError("That website address can't be scanned.");
  }

  const protocol = parsed.protocol as "http:" | "https:";
  const port = parsed.port ? Number(parsed.port) : protocol === "https:" ? 443 : 80;

  const isIpLiteral = parseIPv4(parsed.hostname) !== null || expandIPv6(parsed.hostname) !== null;
  if (isIpLiteral) {
    // Already a literal address — nothing to resolve, and nothing for a later
    // DNS lookup to disagree with. Strip IPv6 brackets for use as a raw
    // connect target.
    const pinnedAddress =
      parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]")
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;
    return { url: parsed.toString(), hostname: parsed.hostname, pinnedAddress, port, protocol };
  }

  const resolve = options.resolver ?? defaultResolver;
  let resolvedAddresses: string[];
  try {
    resolvedAddresses = await resolve(parsed.hostname);
  } catch {
    throw new PublicSnapshotUrlError("We couldn't reach that website address.");
  }

  if (resolvedAddresses.length === 0 || resolvedAddresses.some((address) => isBlockedHostLiteral(address))) {
    throw new PublicSnapshotUrlError("That website address can't be scanned.");
  }

  // Every returned address was just checked as non-blocked above (a
  // conservative all-or-nothing check), so pinning to the first one
  // deterministically is safe — this is the exact address the outbound
  // connection will use, closing the gap where a second, later DNS lookup
  // (e.g. inside a generic fetch/HTTP client) could return something else.
  const pinnedAddress = resolvedAddresses[0];

  return { url: parsed.toString(), hostname: parsed.hostname, pinnedAddress, port, protocol };
}
