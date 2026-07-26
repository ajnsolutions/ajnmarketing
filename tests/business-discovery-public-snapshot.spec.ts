import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ENDPOINT = "/api/business-discovery/snapshot";

/**
 * These tests share the endpoint's per-IP rate-limit bucket (5 requests/hour),
 * so they must run in a fixed order, never in parallel with each other —
 * `test.describe.serial` is Playwright's mechanism for exactly that. The
 * final test intentionally trips the limit using the quota the earlier tests
 * in this block have already consumed.
 */
test.describe.serial("public business discovery snapshot — request handling", () => {
  test("rejects a non-JSON content type", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "text/plain" },
      data: "websiteUrl=https://example.com",
    });
    expect(response.status()).toBe(415);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
  });

  test("rejects malformed JSON", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "application/json" },
      data: "{not valid json",
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
  });

  test("rejects a missing websiteUrl", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({}),
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
  });

  test("is reachable without authentication and rejects a blocked URL with a structured, safe error", async ({
    request,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ websiteUrl: "http://localhost/" }),
    });
    // Not 401/403 — this endpoint is intentionally public, pre-auth.
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("blocked_url");
    expect(typeof body.error.message).toBe("string");
    // No stack traces, no internal object dumps, no raw exception shape.
    expect(body.error).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/); // no stack-trace-shaped lines
  });

  test("rejects an oversized request body", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ websiteUrl: "https://example.com", businessName: "a".repeat(20_000) }),
    });
    expect(response.status()).toBe(413);
  });

  test("returns a structured 429 with Retry-After once the anonymous limit is reached", async ({ request }) => {
    // The five prior tests in this serial block already consumed 5 of the 5
    // allowed requests for this hour from this test runner's IP — this next
    // request must be rate-limited regardless of its body.
    const response = await request.post(ENDPOINT, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ websiteUrl: "http://localhost/" }),
    });
    expect(response.status()).toBe(429);
    expect(response.headers()["retry-after"]).toBeTruthy();
    const body = await response.json();
    expect(body.error.code).toBe("rate_limited");
  });
});

test("no account, business, or tenant is ever created on the public snapshot path", async () => {
  const filesToCheck = [
    "lib/business-discovery/public/service.ts",
    "lib/business-discovery/public/adapter.ts",
    "app/api/business-discovery/snapshot/route.ts",
  ];
  for (const relativePath of filesToCheck) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(/createClient\(/);
    expect(source).not.toMatch(/\.upsert\(/);
    expect(source).not.toMatch(/\.insert\(/);
    // Checks for an actual import from a supabase module, not the word
    // "Supabase" appearing in an explanatory code comment.
    expect(source).not.toMatch(/from\s+["'][^"']*supabase[^"']*["']/i);
  }
});

test("the public path never imports an authenticated-only Business Discovery collector", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/public/service.ts"), "utf8");
  expect(source).not.toMatch(/collectGoogleBusinessProfileObservations/);
  expect(source).not.toMatch(/collectPublicReviewObservations/);
  expect(source).not.toMatch(/collectMarketContextObservations/);
  expect(source).toContain("collectBusinessProfileObservations");
  expect(source).toContain("collectWebsiteAnalysisObservations");
  expect(source).toContain("collectAiMarketingProfileObservations");
});

test("the public path enforces a runtime source allowlist as defense in depth", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/public/service.ts"), "utf8");
  expect(source).toContain("PUBLIC_DISCOVERY_SOURCE_ALLOWLIST");
});

test("public snapshot types define an explicit, narrow source allowlist distinct from the authenticated source list", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/public/types.ts"), "utf8");
  const allowlistBlock = source.slice(
    source.indexOf("export const PublicDiscoverySourceTypes"),
    source.indexOf("} as const satisfies")
  );
  expect(allowlistBlock).not.toMatch(/GOOGLE_BUSINESS_PROFILE/);
  expect(allowlistBlock).not.toMatch(/PUBLIC_REVIEWS/);
  expect(allowlistBlock).not.toMatch(/MARKET_CONTEXT/);
  expect(allowlistBlock).not.toMatch(/FUTURE_CONNECTOR/);
  expect(allowlistBlock).not.toMatch(/SMART_UPLOAD/);
});

test("the public contract never exposes a raw confidence score, only tier/label/explanation", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/public/types.ts"), "utf8");
  expect(source).toContain("PublicOverallConfidence");
  expect(source).not.toMatch(/PublicOverallConfidence\s*=\s*\{[^}]*score:\s*number/);
});

test("cron gate remains false — this feature never touches schedule activation", async () => {
  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
