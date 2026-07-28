/**
 * DNS-pinned HTTP(S) request primitive.
 *
 * This is the actual fix for the DNS-rebinding gap: connects the TCP/TLS
 * socket directly to an already-validated literal IP address (`pinnedAddress`
 * from urlSafety.ts), while presenting the *original* hostname for the HTTP
 * `Host` header and, for HTTPS, the TLS `servername` (SNI + certificate
 * hostname verification).
 *
 * Deliberately built on Node's built-in `node:http`/`node:https` rather than
 * the global `fetch` (undici) or a new dependency: `http.request`/
 * `https.request` accept a `hostname` that is already an IP literal and, in
 * that case, perform **no DNS lookup at all** — `net.isIP()` short-circuits
 * resolution internally. There is nothing left in the runtime that could
 * silently re-resolve the original hostname to a different address; the
 * literal IP validated a moment ago is the literal IP connected to. This
 * closes the gap left by the previous implementation, which validated a
 * hostname's resolved addresses and then called `fetch(url)` — which
 * performs its *own*, separate DNS lookup at connect time, capable of
 * returning a different (rebound) address than the one just validated.
 *
 * TLS certificate verification: passing `servername` to `https.request`
 * makes Node's default `tls.checkServerIdentity` validate the presented
 * certificate against that hostname (not against the IP used for the
 * socket) — exactly preserving normal certificate-hostname behavior even
 * though the connection target is a raw IP.
 */

import * as http from "node:http";
import * as https from "node:https";
import type { IncomingMessage } from "node:http";

export type PinnedRequestOptions = {
  protocol: "http:" | "https:";
  /** Original hostname — used only for the Host header and TLS SNI/cert check, never for connecting. */
  hostname: string;
  /** The already-validated literal IP address to connect to. */
  pinnedAddress: string;
  port: number;
  path: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type PinnedResponse = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: IncomingMessage;
};

export class PinnedRequestTimeoutError extends Error {
  constructor() {
    super("Pinned request timed out");
    this.name = "PinnedRequestTimeoutError";
  }
}

/**
 * Performs one HTTP(S) request pinned to a literal IP address. This is the
 * injectable seam for tests — never mock the global `fetch` for this path;
 * inject a replacement for this function instead so pinning behavior itself
 * stays covered by real (non-network) assertions on the options passed in.
 */
export async function performPinnedRequest(options: PinnedRequestOptions): Promise<PinnedResponse> {
  if (!options.pinnedAddress) {
    // Fail closed: never fall back to hostname-based connection if, for any
    // reason, no validated address is available.
    throw new Error("No pinned address available — refusing to connect by hostname.");
  }

  const transport = options.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: options.pinnedAddress,
        port: options.port,
        path: options.path,
        method: "GET",
        headers: { ...options.headers, Host: options.hostname },
        // HTTPS-only option; harmless/ignored by the plain http module.
        servername: options.protocol === "https:" ? options.hostname : undefined,
        timeout: options.timeoutMs,
      },
      (res) => {
        resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: res });
      }
    );

    req.on("timeout", () => {
      req.destroy(new PinnedRequestTimeoutError());
    });
    req.on("error", (error) => reject(error));
    req.end();
  });
}
