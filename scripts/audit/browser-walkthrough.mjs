/**
 * Release-candidate audit: authenticated browser walkthrough against the real (only)
 * test account, running against `npm start` (production build) on localhost:3000.
 *
 * Establishes a real session via a service-role-generated OTP (verifyOtp, server-side,
 * no password needed/known), serializes it into cookies using @supabase/ssr's own
 * createServerClient storage code (not a hand-reconstructed format), and injects those
 * cookies directly into a Playwright browser context. This avoids ever navigating to a
 * URL containing the session in a fragment/query string, so no token or session data is
 * ever written to stdout or captured in page.url().
 *
 * Then drives the real UI: Approval Center (approve a real pending draft), Publishing
 * Queue (add + Publish Now -- expected to fail cleanly since no GBP connection exists,
 * proving the queue/job/retry machinery without any live Google call), then walks every
 * dashboard page capturing console errors and failed network requests, plus a
 * mobile-viewport pass.
 *
 * SECURITY NOTE: never log `page.url()` after an authenticated navigation without
 * confirming first that the URL is one this script itself constructed (a plain path
 * under BASE) -- Supabase/Next auth flows can otherwise leak tokens into logged URLs.
 *
 * Run with: node --env-file=.env.local scripts/audit/browser-walkthrough.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BASE = "http://localhost:3000";
const CONTENT_APPROVAL_ID = process.argv[2];

if (!CONTENT_APPROVAL_ID) {
  console.error("Usage: browser-walkthrough.mjs <contentApprovalId>");
  process.exit(1);
}

function safePath(u) {
  // Never return more than scheme+host+pathname+search -- strips any hash fragment,
  // which is exactly where a leaked token would live.
  if (!u) return "[empty url]";
  try {
    const parsed = new URL(u);
    let search = parsed.search;
    if (search) search = search.replace(/access_token=[^&]*/gi, "access_token=[REDACTED]");
    return parsed.origin + parsed.pathname + search;
  } catch (e) {
    return `[unparseable url: ${String(u).slice(0, 40)}]`;
  }
}

async function main() {
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("Requesting an OTP session for the real test account (credentials never printed)...");
  const { data: users, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr || !users?.users?.[0]) throw new Error("Could not list users: " + listErr?.message);
  const email = users.users[0].email;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !linkData) throw new Error("generateLink failed: " + linkErr?.message);

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (otpErr || !otpData.session) throw new Error("verifyOtp failed: " + otpErr?.message);

  // Serialize the session into cookies using @supabase/ssr's own storage code, so the
  // format is guaranteed correct (not hand-reconstructed) and no token is ever logged.
  const capturedCookies = [];
  const ssrClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          capturedCookies.push({
            name,
            value,
            domain: "localhost",
            path: options?.path ?? "/",
            httpOnly: options?.httpOnly ?? true,
            secure: false, // localhost over http
            sameSite: "Lax",
            expires: options?.maxAge ? Math.floor(Date.now() / 1000) + options.maxAge : undefined,
          });
        }
      },
    },
  });
  await ssrClient.auth.setSession({
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
  });

  if (capturedCookies.length === 0) throw new Error("No auth cookies were serialized -- aborting rather than proceeding unauthenticated.");
  console.log(`Serialized ${capturedCookies.length} auth cookie(s) via @supabase/ssr's own encoder (values not printed).`);

  const browser = await chromium.launch();

  // --- Unauthenticated redirect checks first, on a fresh incognito context ---
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  const unauthResults = [];
  for (const path of ["/dashboard", "/onboarding"]) {
    const res = await anonPage.goto(BASE + path, { waitUntil: "domcontentloaded" });
    unauthResults.push({ path, finalUrl: safePath(anonPage.url()), status: res?.status() });
  }
  console.log("\n=== Unauthenticated redirect checks ===");
  console.log(JSON.stringify(unauthResults, null, 2));
  await anonContext.close();

  // --- Authenticated session via directly-injected cookies (never via a URL) ---
  const context = await browser.newContext();
  await context.addCookies(capturedCookies);
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ url: safePath(page.url()), text: msg.text() });
  });
  page.on("requestfailed", (req) => {
    // net::ERR_ABORTED here is Next.js's own link-prefetch requests being cancelled when
    // navigation moves on before they complete -- expected noise, not a real failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push({ pageUrl: safePath(page.url()), reqUrl: safePath(req.url()), failure: req.failure()?.errorText });
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("/_next/webpack-hmr")) {
      failedRequests.push({ pageUrl: safePath(page.url()), reqUrl: safePath(res.url()), status: res.status() });
    }
  });

  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  console.log("\nLanded at (path only):", safePath(page.url()));
  const isAuthenticated = !page.url().includes("/login");
  console.log("Authenticated:", isAuthenticated);
  if (!isAuthenticated) {
    console.error("Cookie injection did not authenticate the session -- aborting remaining authenticated steps.");
    await browser.close();
    process.exit(1);
  }

  // --- Approval Center: approve the real pending draft ---
  console.log("\n=== Approval Center: approve real draft ===");
  await page.goto(BASE + "/dashboard/approvals", { waitUntil: "domcontentloaded" });
  const approveButton = page.getByRole("button", { name: /^Approve$/i }).first();
  const hadApproveButton = (await approveButton.count()) > 0 && (await approveButton.isEnabled());
  if (hadApproveButton) {
    await approveButton.click();
    await page.waitForTimeout(1500);
    console.log("Clicked Approve.");
  } else {
    console.log("No enabled Approve button found (draft may already be approved) -- will verify final state via DB.");
  }

  // --- Publishing: add to queue + Publish Now (expected to fail cleanly, no GBP) ---
  console.log("\n=== Publishing: add to queue + Publish Now ===");
  if (process.env.SKIP_QUEUE === "1") {
    console.log("SKIP_QUEUE=1 set -- queue item already exists from a prior run, not re-adding.");
  } else {
    await page.goto(BASE + "/dashboard/approvals", { waitUntil: "domcontentloaded" });
    const queueButton = page.getByRole("button", { name: /Add to Publishing Queue/i }).first();
    if ((await queueButton.count()) > 0 && (await queueButton.isEnabled())) {
      await queueButton.click();
      await page.waitForTimeout(1500);
      console.log("Clicked 'Add to Publishing Queue'.");
    } else {
      console.log("No 'Add to Publishing Queue' button found.");
    }
  }

  await page.goto(BASE + "/dashboard/publishing", { waitUntil: "domcontentloaded" });
  const publishNowButton = page.getByRole("button", { name: /Publish Now/i }).first();
  if ((await publishNowButton.count()) > 0 && (await publishNowButton.isEnabled())) {
    await publishNowButton.click();
    await page.waitForTimeout(3000);
    console.log("Clicked 'Publish Now' -- expecting a clean failure (no GBP connection).");
  } else {
    console.log("No 'Publish Now' button found.");
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  const publishingPageText = await page.locator("body").innerText();
  const mentionsFailedOrError = /failed|error|connect google/i.test(publishingPageText);
  console.log("Publishing page mentions failure/error/connect-google text:", mentionsFailedOrError);

  // --- Full dashboard walkthrough (desktop) ---
  console.log("\n=== Dashboard walkthrough (desktop, 1280x800) ===");
  await page.setViewportSize({ width: 1280, height: 800 });
  const DASHBOARD_PAGES = [
    "/dashboard", "/dashboard/website-analysis", "/dashboard/brand-voice", "/dashboard/ai-profile",
    "/dashboard/market-context", "/dashboard/marketing-recommendations", "/dashboard/marketing-plan",
    "/dashboard/content", "/dashboard/content/generator", "/dashboard/approvals",
    "/dashboard/approvals/delivery", "/dashboard/publishing", "/dashboard/google-business-profile",
    "/dashboard/google-business-profile/connect", "/dashboard/reviews", "/dashboard/analytics",
    "/dashboard/command-center", "/dashboard/tasks", "/dashboard/notifications",
    "/dashboard/settings", "/dashboard/billing",
  ];
  const pageResults = [];
  for (const path of DASHBOARD_PAGES) {
    const before = consoleErrors.length;
    const beforeFail = failedRequests.length;
    let status = "ok";
    try {
      const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20000 });
      status = res ? res.status() : "no-response";
    } catch (e) {
      status = "navigation-error: " + e.message.split("\n")[0];
    }
    await page.waitForTimeout(500);
    pageResults.push({
      path,
      httpStatus: status,
      newConsoleErrors: consoleErrors.slice(before),
      newFailedRequests: failedRequests.slice(beforeFail),
    });
  }
  console.log(JSON.stringify(pageResults, null, 2));

  // --- Mobile viewport pass on key pages ---
  console.log("\n=== Mobile viewport pass (375x812) ===");
  await page.setViewportSize({ width: 375, height: 812 });
  const mobileResults = [];
  for (const path of ["/dashboard", "/dashboard/marketing-recommendations", "/dashboard/approvals", "/dashboard/publishing"]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
    );
    mobileResults.push({ path, hasHorizontalOverflow });
  }
  console.log(JSON.stringify(mobileResults, null, 2));

  await browser.close();

  console.log("\n=== SUMMARY ===");
  console.log("Total console errors across walkthrough:", consoleErrors.length);
  console.log("Total failed/4xx/5xx requests across walkthrough:", failedRequests.length);
  if (consoleErrors.length) console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));
  if (failedRequests.length) console.log("Failed requests:", JSON.stringify(failedRequests, null, 2));
}

main().catch((err) => {
  console.error("Walkthrough crashed:", err.message);
  process.exit(1);
});
