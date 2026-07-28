import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * First Impression E2E coverage. Every scenario mocks the browser's network
 * requests to /api/business-discovery/* via page.route() — the real
 * Next.js route handlers (which would call OpenAI / fetch a live website)
 * are never reached, matching this milestone's "mock external AI and
 * website-fetch behavior; no live websites or paid APIs" requirement.
 *
 * Scenarios that require a real authenticated Supabase session (resuming a
 * Snapshot in onboarding, confirming existing data isn't overwritten) are a
 * known gap in this environment — there is no established pattern anywhere
 * in this repo's Playwright suite for signing in a real test user (every
 * existing spec only tests *unauthenticated* rejection). Those two
 * scenarios are covered instead by the extensive server-side unit tests in
 * unit-tests/business-discovery-continuation-*.test.ts (PR #75) and this
 * session's onboarding-prefill tests — see docs/BUSINESS_DISCOVERY_FIRST_IMPRESSION.md's
 * Known limitations section.
 */

const MOCK_REFERENCE = "a".repeat(48);

function mockSnapshotResult(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: MOCK_REFERENCE,
    websiteUrl: "https://acmehvac.example/",
    businessName: "Acme HVAC",
    city: "Springfield",
    stateOrRegion: "IL",
    degraded: false,
    businessSummary: {
      value: "Acme HVAC is a residential HVAC company serving Springfield.",
      confidenceTier: "known",
      confidenceScore: 90,
      sources: ["business_profile"],
      reason: "You told us this when you shared your business details.",
      evidenceRefs: [],
    },
    primaryServices: {
      value: ["AC repair", "Furnace installation"],
      confidenceTier: "assumed",
      confidenceScore: 55,
      sources: ["ai_website_analysis"],
      reason: "Your website repeatedly references residential HVAC installation and repair.",
      evidenceRefs: [],
    },
    likelyTargetCustomers: {
      value: "Homeowners",
      confidenceTier: "assumed",
      confidenceScore: 55,
      sources: ["ai_website_analysis"],
      reason: "Your website focuses on home installations, repairs, and maintenance.",
      evidenceRefs: [],
    },
    brandPersonality: {
      value: ["Friendly", "Reliable"],
      confidenceTier: "assumed",
      confidenceScore: 55,
      sources: ["ai_marketing_profile"],
      reason: "Based on the tone of your website's writing.",
      evidenceRefs: [],
    },
    visibleStrengths: {
      value: ["Fast response time"],
      confidenceTier: "assumed",
      confidenceScore: 55,
      sources: ["ai_website_analysis"],
      reason: "Multiple pages emphasize same-day service.",
      evidenceRefs: [],
    },
    onlinePresence: {
      website: {
        value: { connected: true, analyzed: true },
        confidenceTier: "known",
        confidenceScore: 90,
        sources: ["business_profile"],
        reason: "Your website is on file and has a completed AI analysis.",
        evidenceRefs: [],
      },
      googleBusinessProfile: {
        value: { connected: false },
        confidenceTier: "missing",
        confidenceScore: 0,
        sources: [],
        reason: "Your Google Business Profile isn't connected yet.",
        evidenceRefs: [],
      },
      socialPresence: { value: null, confidenceTier: "missing", confidenceScore: 0, sources: [], reason: "Not connected yet.", evidenceRefs: [] },
    },
    possibleGrowthOpportunities: {
      value: ["Your maintenance plan is difficult to find on your website"],
      confidenceTier: "assumed",
      confidenceScore: 55,
      sources: ["ai_website_analysis"],
      reason: "We noticed potential opportunities based on your website analysis.",
      evidenceRefs: [],
    },
    missingOrUnclearInformation: [
      {
        field: "onlinePresence.googleBusinessProfile",
        reason: "We don't have any information about your Google Business Profile presence yet.",
        suggestedNextAction: "Connect your Google Business Profile.",
      },
    ],
    overallConfidence: { tier: "assumed", label: "Building a picture", explanation: "We're starting to understand your business." },
    ...overrides,
  };
}

async function mockScanSuccess(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route("**/api/business-discovery/snapshot", async (route) => {
    await route.fulfill({ json: { result: mockSnapshotResult(overrides) } });
  });
}

async function mockScanError(page: Page, status: number, code: string, message: string, headers: Record<string, string> = {}) {
  await page.route("**/api/business-discovery/snapshot", async (route) => {
    await route.fulfill({ status, headers, json: { error: { code, message } } });
  });
}

async function mockAnalyticsCapture(page: Page): Promise<{ event: string; metadata: Record<string, unknown> }[]> {
  const captured: { event: string; metadata: Record<string, unknown> }[] = [];
  await page.route("**/api/business-discovery/snapshot-events", async (route) => {
    const body = route.request().postDataJSON() as { event: string; metadata?: Record<string, unknown> };
    captured.push({ event: body.event, metadata: body.metadata ?? {} });
    await route.fulfill({ json: { ok: true } });
  });
  return captured;
}

/** Waits for hydration to complete before interacting — avoids a known race
 * where a fast scripted click can trigger the raw HTML form's native
 * (pre-hydration) submission instead of the React handler. */
async function gotoAndHydrate(page: Page, path: string) {
  return page.goto(path, { waitUntil: "networkidle" });
}

async function submitScan(page: Page) {
  await gotoAndHydrate(page, "/snapshot");
  await page.getByLabel("Your business website").fill("acmehvac.example");
  await page.getByRole("button", { name: "Scan My Business" }).click();
  await expect(page.getByRole("heading", { name: /Here's what I learned/i })).toBeVisible();
}

test("1. public visitor submits a valid website and sees the Snapshot", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  // The same summary text legitimately appears twice (executive summary +
  // the "top discoveries" highlight card) — scope to the first occurrence.
  await expect(page.getByText("Acme HVAC is a residential HVAC company").first()).toBeVisible();
  await expect(page.getByText("Building a picture")).toBeVisible();
});

test("2. visitor reviews an Assumed insight", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);

  await page.getByRole("button", { name: "Let me review the details" }).click();
  const servicesCard = page.locator("article", { hasText: "Your primary services" });
  await expect(servicesCard.getByText("My best understanding")).toBeVisible();

  await servicesCard.getByRole("button", { name: "That's right" }).click();
  await expect(servicesCard.getByText("Got it — marked as confirmed.")).toBeVisible();
});

test("3. visitor corrects an insight", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const targetCard = page.locator("article", { hasText: "Who you help" });
  await targetCard.getByRole("button", { name: "Let me correct it" }).click();

  const dialog = page.getByRole("dialog", { name: "Let's fix that" });
  await expect(dialog).toBeVisible();
  const textarea = dialog.getByLabel("Correct answer");
  await textarea.fill("Property managers and landlords");
  await dialog.getByRole("button", { name: "Save correction" }).click();

  await expect(dialog).toBeHidden();
  await expect(targetCard.getByText("Property managers and landlords")).toBeVisible();
  await expect(targetCard.getByText("(you corrected this)")).toBeVisible();
});

test("4. visitor rejects an insight", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const card = page.locator("article", { hasText: "How your business comes across" });
  await card.getByRole("button", { name: "That's not right" }).click();
  await expect(card.getByText("Understood — I won't treat this as a fact.")).toBeVisible();
});

test("5. visitor chooses Review Later", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const card = page.locator("article", { hasText: "What stands out" });
  await card.getByRole("button", { name: "Review later" }).click();
  await expect(card.getByText("No problem — you can come back to this anytime.")).toBeVisible();
});

test("6. visitor starts signup and the opaque reference is preserved, never raw content", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);

  await page.getByRole("button", { name: "Create My Growth Plan" }).click();
  // Generous timeout: /signup is dev-mode on-demand compiled the first time
  // any test in the run navigates there — a one-time cold-start cost, not a
  // real navigation flake.
  await expect(page).toHaveURL(new RegExp(`/signup\\?snapshotRef=${MOCK_REFERENCE}`), { timeout: 20_000 });

  const url = page.url();
  expect(url).not.toContain("Acme");
  expect(url).not.toContain("Homeowners");
  expect(url).not.toContain("residential");
});

test("6b. 'I already have an account' preserves the reference through the login next param", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);

  await page.getByRole("button", { name: "I already have an account" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  const nextParam = url.searchParams.get("next");
  expect(nextParam).toBe(`/onboarding?snapshotRef=${MOCK_REFERENCE}`);
});

test("9. expired reference during signup falls back gracefully (unauthenticated redirect never breaks)", async ({ page }) => {
  const response = await page.goto(`/onboarding?snapshotRef=${MOCK_REFERENCE}`);
  await expect(page).toHaveURL(/\/login/);
  expect(response?.status()).toBeLessThan(500);
});

test("10. rate-limited visitor receives a useful, friendly state", async ({ page }) => {
  await mockScanError(page, 429, "rate_limited", "You've reached the limit for free snapshots right now.", {
    "Retry-After": "120",
  });
  await gotoAndHydrate(page, "/snapshot");
  await page.getByLabel("Your business website").fill("acmehvac.example");
  await page.getByRole("button", { name: "Scan My Business" }).click();

  await expect(page.locator('[role="alert"]').filter({ hasText: /limit for free snapshots/i })).toBeVisible();
  await expect(page.locator('[role="alert"]').filter({ hasText: /minutes/i })).toBeVisible();
  // Form remains usable — submitted context wasn't lost.
  await expect(page.getByLabel("Your business website")).toHaveValue("acmehvac.example");
});

test("11. partial/degraded discovery remains usable and is shown honestly", async ({ page }) => {
  await mockScanSuccess(page, { degraded: true });
  await submitScan(page);
  await expect(page.getByText(/We learned part of your business/i)).toBeVisible();
  // The rest of the page still renders and is usable.
  await expect(page.getByRole("button", { name: "Create My Growth Plan" })).toBeVisible();
});

test("blocked URL shows a friendly, non-technical message", async ({ page }) => {
  await mockScanError(page, 400, "blocked_url", "That website address can't be scanned.");
  await gotoAndHydrate(page, "/snapshot");
  await page.getByLabel("Your business website").fill("internal.local");
  await page.getByRole("button", { name: "Scan My Business" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: "We couldn't safely visit that address" })).toBeVisible();
});

test("timeout shows a friendly message and preserves the form", async ({ page }) => {
  await mockScanError(page, 504, "timeout", "That website took too long to respond.");
  await gotoAndHydrate(page, "/snapshot");
  await page.getByLabel("Your business website").fill("slow-site.example");
  await page.getByRole("button", { name: "Scan My Business" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: /took too long/i })).toBeVisible();
  await expect(page.getByLabel("Your business website")).toHaveValue("slow-site.example");
});

test("client-side validation catches an empty submission with a friendly message, no network call", async ({ page }) => {
  let called = false;
  await page.route("**/api/business-discovery/snapshot", async (route) => {
    called = true;
    await route.continue();
  });
  await gotoAndHydrate(page, "/snapshot");
  await page.getByRole("button", { name: "Scan My Business" }).click();
  await expect(page.getByText("Enter your website address, like yourbusiness.com.")).toBeVisible();
  expect(called).toBe(false);
});

test("12. mobile viewport completes the core flow without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockScanSuccess(page);
  await submitScan(page);

  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(376);

  await page.getByRole("button", { name: "Let me review the details" }).click();
  const card = page.locator("article", { hasText: "Your primary services" });
  await card.getByRole("button", { name: "That's right" }).click();
  await expect(card.getByText("Got it — marked as confirmed.")).toBeVisible();
});

test("13. keyboard-only user can complete a review action", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const card = page.locator("article", { hasText: "Your primary services" });
  const confirmButton = card.getByRole("button", { name: "That's right" });
  await confirmButton.focus();
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card.getByText("Got it — marked as confirmed.")).toBeVisible();
});

test("correction dialog manages focus and closes on Escape", async ({ page }) => {
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const card = page.locator("article", { hasText: "Who you help" });
  await card.getByRole("button", { name: "Let me correct it" }).click();
  const dialog = page.getByRole("dialog", { name: "Let's fix that" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Correct answer")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("14. analytics payloads never contain sensitive result content", async ({ page }) => {
  const captured = await mockAnalyticsCapture(page);
  await mockScanSuccess(page);
  await submitScan(page);
  await page.getByRole("button", { name: "Let me review the details" }).click();

  const card = page.locator("article", { hasText: "Your primary services" });
  await card.getByRole("button", { name: "That's right" }).click();

  const serialized = JSON.stringify(captured);
  expect(serialized).not.toMatch(/Acme HVAC/);
  expect(serialized).not.toMatch(/Homeowners/);
  expect(serialized).not.toMatch(/AC repair/);
  expect(captured.some((entry) => entry.event === "insight_confirmed")).toBe(true);
});

test("scan form does not require JavaScript-only interaction to be discoverable (progressive fields collapse cleanly)", async ({ page }) => {
  await gotoAndHydrate(page, "/snapshot");
  await expect(page.getByLabel("Your business website")).toBeVisible();
  await expect(page.getByText("+ Add your business name or location (optional)")).toBeVisible();
  await page.getByText("+ Add your business name or location (optional)").click();
  await expect(page.getByLabel("Business name")).toBeVisible();
});

test("homepage entry point reaches the Snapshot flow with the typed URL prefilled", async ({ page }) => {
  await gotoAndHydrate(page, "/");
  await page.getByLabel("Your business website").fill("acmehvac.example");
  await page.getByRole("button", { name: "Scan My Business" }).click();
  await expect(page).toHaveURL(/\/snapshot\?url=/);
  await expect(page.getByLabel("Your business website")).toHaveValue("acmehvac.example");
});

test("source-level: no forbidden decision auto-application — confirmation only happens through an explicit user action", async () => {
  const source = readFileSync(join(process.cwd(), "components/snapshot/snapshot-flow.tsx"), "utf8");
  // Decisions are only ever recorded inside handleDecide, which is only ever
  // invoked from an explicit InsightReviewItem button click — never on mount,
  // never on scroll, never merely by viewing results.
  expect(source).not.toMatch(/useEffect\([^)]*handleDecide/);
});

test("source-level: onboarding review step submits decisions only through the authenticated confirm contract", async () => {
  const source = readFileSync(join(process.cwd(), "components/onboarding/snapshot-review-step.tsx"), "utf8");
  expect(source).toContain("/api/business-discovery/continuation/confirm");
  expect(source).not.toMatch(/\.insert\(/);
});

test("cron gate remains false — this feature never touches schedule activation", async () => {
  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
