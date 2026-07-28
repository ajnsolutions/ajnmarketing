import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RESOLVE = "/api/business-discovery/continuation/resolve";
const CLAIM = "/api/business-discovery/continuation/claim";
const CONFIRM = "/api/business-discovery/continuation/confirm";

test("unauthenticated resolve is rejected with a structured 401", async ({ request }) => {
  const response = await request.post(RESOLVE, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ snapshotReference: "a".repeat(48) }),
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error.code).toBe("unauthenticated");
});

test("unauthenticated claim is rejected with a structured 401", async ({ request }) => {
  const response = await request.post(CLAIM, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ snapshotReference: "a".repeat(48) }),
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error.code).toBe("unauthenticated");
});

test("unauthenticated confirm is rejected with a structured 401", async ({ request }) => {
  const response = await request.post(CONFIRM, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ snapshotReference: "a".repeat(48), decisions: [] }),
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error.code).toBe("unauthenticated");
});

test("auth is checked before body parsing — a malformed body doesn't leak past the 401", async ({ request }) => {
  const response = await request.post(RESOLVE, {
    headers: { "content-type": "application/json" },
    data: "{not valid json",
  });
  expect(response.status()).toBe(401);
});

test("no route leaks a stack trace or internal error shape", async ({ request }) => {
  for (const endpoint of [RESOLVE, CLAIM, CONFIRM]) {
    const response = await request.post(endpoint, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({}),
    });
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/);
  }
});

test("visiting /onboarding with an invalid snapshotRef never blocks the redirect to login (fails gracefully)", async ({ page }) => {
  const response = await page.goto("/onboarding?snapshotRef=not-a-real-reference");
  await expect(page).toHaveURL(/\/login/);
  expect(response?.status()).toBeLessThan(500);
});

test("visiting /onboarding with no snapshotRef behaves exactly like standard onboarding (redirects to login when unauthenticated)", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("visiting /onboarding with an oversized/garbage snapshotRef does not 500", async ({ page }) => {
  const response = await page.goto(`/onboarding?snapshotRef=${"x".repeat(5000)}`);
  expect(response?.status()).toBeLessThan(500);
});

test("continuation routes never import a Supabase write beyond the one documented, narrow business_profiles update", async () => {
  const files = [
    "lib/business-discovery/continuation/service.ts",
    "lib/business-discovery/continuation/claimStore.ts",
    "lib/business-discovery/continuation/confirmationStore.ts",
    "lib/business-discovery/continuation/applyConfirmations.ts",
  ];
  for (const relativePath of files) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/from\(["']users["']\)/);
    expect(source).not.toMatch(/from\(["']tenants?["']\)/);
  }
});

test("the confirmation contract never accepts an 'originalValue' field from the client", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/continuation/types.ts"), "utf8");
  const inputTypeBlock = source.slice(
    source.indexOf("export type ConfirmationDecisionInput"),
    source.indexOf("export type ConfirmationDecisionInput") + 400
  );
  expect(inputTypeBlock).not.toMatch(/originalValue/);
  expect(inputTypeBlock).not.toMatch(/originalConfidenceTier/);
  expect(inputTypeBlock).not.toMatch(/originalSources/);
});

test("insight keys are stable literal strings, not array-position based", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/continuation/types.ts"), "utf8");
  expect(source).toContain("export const InsightKeys");
  expect(source).toMatch(/PRIMARY_SERVICES:\s*"primaryServices"/);
});

test("DNS pinning: fetchWebsite.ts never falls back to hostname-only fetch", async () => {
  const source = readFileSync(join(process.cwd(), "lib/business-discovery/public/fetchWebsite.ts"), "utf8");
  // Strip block comments before checking — the file's own header comment
  // explains, in prose, what the *old* hostname-based fetch() call looked
  // like for context, which would otherwise false-positive this check.
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(codeOnly).not.toMatch(/\bfetch\(/);
  expect(codeOnly).toContain("performPinnedRequest");
  expect(codeOnly).toContain("pinnedAddress");
  expect(codeOnly).toContain("pinning_unavailable");
});

test("cron gate remains false — this feature never touches schedule activation", async () => {
  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
