import test from "node:test";
import assert from "node:assert/strict";
import { fetchPublicSnapshotWebsite, PublicSnapshotFetchError } from "../lib/business-discovery/public/fetchWebsite.ts";

const publicResolver = async () => ["93.184.216.34"];

function htmlResponse(html: string): Response {
  return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
}

function withUrl(response: Response, url: string): Response {
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

test("fetches a normal page successfully", async () => {
  let calls = 0;
  const fetchImpl = (async (input: string) => {
    calls += 1;
    return withUrl(htmlResponse("<html><body>Hello</body></html>"), input);
  }) as typeof fetch;

  const result = await fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl });
  assert.equal(calls, 1);
  assert.match(result.textContent, /Hello/);
  assert.equal(result.finalUrl, "https://example.com/");
});

test("strips script and style tags from extracted text content", async () => {
  const fetchImpl = (async (input: string) =>
    withUrl(
      htmlResponse("<html><head><style>.a{}</style></head><body><script>evil()</script>Real content</body></html>"),
      input
    )) as typeof fetch;

  const result = await fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl });
  assert.doesNotMatch(result.textContent, /evil/);
  assert.match(result.textContent, /Real content/);
});

test("follows a redirect chain within the limit and re-validates each hop", async () => {
  const sequence = ["https://example.com/a", "https://example.com/b", "https://example.com/final"];
  let step = 0;
  const fetchImpl = (async () => {
    const current = sequence[step];
    step += 1;
    if (current === "https://example.com/final") {
      return withUrl(htmlResponse("<html>done</html>"), current);
    }
    return redirectResponse(sequence[step]);
  }) as typeof fetch;

  const result = await fetchPublicSnapshotWebsite("https://example.com/a", {
    fetchImpl,
    resolver: publicResolver,
  });
  assert.match(result.textContent, /done/);
});

test("rejects a redirect to a blocked destination", async () => {
  const fetchImpl = (async (input: string) => {
    if (input === "https://example.com/") return redirectResponse("http://169.254.169.254/latest/meta-data");
    throw new Error("should not be called again after a blocked redirect");
  }) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "blocked_redirect"
  );
});

test("rejects an excessive redirect chain", async () => {
  let hop = 0;
  const fetchImpl = (async () => {
    hop += 1;
    return redirectResponse(`https://example.com/hop-${hop}`);
  }) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/hop-0", { fetchImpl, resolver: publicResolver }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "too_many_redirects"
  );
});

test("rejects a redirect with no Location header", async () => {
  const fetchImpl = (async () => new Response(null, { status: 302 })) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "blocked_redirect"
  );
});

test("rejects a timeout", async () => {
  const fetchImpl = (async () => {
    const error = new Error("The operation was aborted");
    error.name = "TimeoutError";
    throw error;
  }) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "timeout"
  );
});

test("rejects a non-ok upstream response", async () => {
  const fetchImpl = (async (input: string) => withUrl(new Response("", { status: 500 }), input)) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "upstream_error"
  );
});

test("rejects a response body larger than the size cap", async () => {
  const hugeHtml = "a".repeat(3 * 1024 * 1024); // 3MB, over the 2MB cap
  const fetchImpl = (async (input: string) => withUrl(htmlResponse(hugeHtml), input)) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "too_large"
  );
});

test("a generic network failure surfaces as upstream_error, not an unhandled rejection", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;

  await assert.rejects(
    () => fetchPublicSnapshotWebsite("https://example.com/", { fetchImpl }),
    (error: unknown) => error instanceof PublicSnapshotFetchError && error.code === "upstream_error"
  );
});
