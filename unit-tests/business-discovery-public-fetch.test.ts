import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { fetchPublicSnapshotWebsite, PublicSnapshotFetchError } from "../lib/business-discovery/public/fetchWebsite.ts";
import type { ValidatedPublicUrl } from "../lib/business-discovery/public/urlSafety.ts";
import type { PinnedRequestOptions, PinnedResponse } from "../lib/business-discovery/public/pinnedRequest.ts";

const publicResolver = async () => ["93.184.216.34"];

function validated(url: string, pinnedAddress = "93.184.216.34"): ValidatedPublicUrl {
  const parsed = new URL(url);
  return {
    url: parsed.toString(),
    hostname: parsed.hostname,
    pinnedAddress,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
    protocol: parsed.protocol as "http:" | "https:",
  };
}

function htmlResponse(html: string, statusCode = 200): PinnedResponse {
  return { statusCode, headers: { "content-type": "text/html" }, body: Readable.from([html]) as PinnedResponse["body"] };
}

function redirectResponse(location: string): PinnedResponse {
  return { statusCode: 302, headers: { location }, body: Readable.from([]) as PinnedResponse["body"] };
}

test("fetches a normal page successfully and pins to the validated address", async () => {
  let calls = 0;
  let seenOptions: PinnedRequestOptions | undefined;
  const requestImpl = async (options: PinnedRequestOptions) => {
    calls += 1;
    seenOptions = options;
    return htmlResponse("<html><body>Hello</body></html>");
  };

  const result = await fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl });
  assert.equal(calls, 1);
  assert.match(result.textContent, /Hello/);
  assert.equal(seenOptions?.pinnedAddress, "93.184.216.34");
  assert.equal(seenOptions?.hostname, "example.com");
});

test("preserves the original hostname for the Host header and TLS SNI, never the pinned IP", async () => {
  let seenOptions: PinnedRequestOptions | undefined;
  const requestImpl = async (options: PinnedRequestOptions) => {
    seenOptions = options;
    return htmlResponse("<html>ok</html>");
  };

  await fetchPublicSnapshotWebsite(validated("https://example.com/page"), { requestImpl });
  // The request function itself is responsible for setting Host/servername from
  // `hostname` — this asserts the caller supplies the right raw materials for that.
  assert.equal(seenOptions?.hostname, "example.com");
  assert.notEqual(seenOptions?.hostname, seenOptions?.pinnedAddress);
});

test("strips script and style tags from extracted text content", async () => {
  const requestImpl = async () =>
    htmlResponse("<html><head><style>.a{}</style></head><body><script>evil()</script>Real content</body></html>");

  const result = await fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl });
  assert.doesNotMatch(result.textContent, /evil/);
  assert.match(result.textContent, /Real content/);
});

test("follows a redirect chain within the limit, re-validating and re-pinning each hop independently", async () => {
  const sequence = ["https://example.com/a", "https://example.com/b", "https://example.com/final"];
  let step = 0;
  const seenPinnedAddresses: string[] = [];
  const requestImpl = async (options: PinnedRequestOptions) => {
    seenPinnedAddresses.push(options.pinnedAddress);
    const current = sequence[step];
    step += 1;
    if (current === "https://example.com/final") {
      return htmlResponse("<html>done</html>");
    }
    return redirectResponse(sequence[step]);
  };

  const result = await fetchPublicSnapshotWebsite(validated("https://example.com/a"), {
    requestImpl,
    resolver: publicResolver,
  });
  assert.match(result.textContent, /done/);
  // Every hop pinned to a (freshly re-validated) address — never skipped.
  assert.equal(seenPinnedAddresses.length, 3);
  assert.ok(seenPinnedAddresses.every((addr) => addr === "93.184.216.34"));
});

test("rejects a redirect to a blocked destination", async () => {
  let calls = 0;
  const requestImpl = async () => {
    calls += 1;
    if (calls === 1) return redirectResponse("http://169.254.169.254/latest/meta-data");
    throw new Error("should not be called again after a blocked redirect");
  };

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "blocked_redirect"
  );
});

test("rejects a redirect to a hostname that resolves to a blocked IP", async () => {
  const rebindingResolver = async () => ["10.0.0.5"];
  const requestImpl = async () => redirectResponse("https://looks-public.example/next");

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl, resolver: rebindingResolver }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "blocked_redirect"
  );
});

test("rejects an excessive redirect chain", async () => {
  let hop = 0;
  const requestImpl = async () => {
    hop += 1;
    return redirectResponse(`https://example.com/hop-${hop}`);
  };

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/hop-0"), { requestImpl, resolver: publicResolver }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "too_many_redirects"
  );
});

test("rejects a redirect with no Location header", async () => {
  const requestImpl = async () => ({ statusCode: 302, headers: {}, body: Readable.from([]) as PinnedResponse["body"] });

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "blocked_redirect"
  );
});

test("rejects a timeout", async () => {
  const requestImpl = async () => {
    const { PinnedRequestTimeoutError } = await import("../lib/business-discovery/public/pinnedRequest.ts");
    throw new PinnedRequestTimeoutError();
  };

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "timeout"
  );
});

test("rejects a non-ok upstream response", async () => {
  const requestImpl = async () => ({ statusCode: 500, headers: {}, body: Readable.from([]) as PinnedResponse["body"] });

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "upstream_error"
  );
});

test("rejects a response body larger than the size cap", async () => {
  const hugeHtml = "a".repeat(3 * 1024 * 1024); // 3MB, over the 2MB cap
  const requestImpl = async () => htmlResponse(hugeHtml);

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "too_large"
  );
});

test("enforces the size cap after decompression, not before (no decompression-bomb bypass)", async () => {
  const zlib = await import("node:zlib");
  const hugePlainText = "a".repeat(3 * 1024 * 1024); // decompresses to 3MB, over the 2MB cap
  const compressed = zlib.gzipSync(Buffer.from(hugePlainText));
  const requestImpl = async () => ({
    statusCode: 200,
    headers: { "content-type": "text/html", "content-encoding": "gzip" },
    body: Readable.from([compressed]) as PinnedResponse["body"],
  });

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "too_large"
  );
});

test("a generic network failure surfaces as upstream_error, not an unhandled rejection", async () => {
  const requestImpl = async () => {
    throw new Error("ECONNREFUSED");
  };

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(validated("https://example.com/"), { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "upstream_error"
  );
});

test("fails closed when no pinned address is available, rather than falling back to hostname connection", async () => {
  const noPinAddress: ValidatedPublicUrl = { ...validated("https://example.com/"), pinnedAddress: "" };
  const requestImpl = async () => {
    throw new Error("should never be called without a pinned address");
  };

  await assert.rejects(
    () => fetchPublicSnapshotWebsite(noPinAddress, { requestImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "pinning_unavailable"
  );
});
