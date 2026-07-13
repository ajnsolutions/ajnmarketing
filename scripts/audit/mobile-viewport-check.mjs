/**
 * Release-candidate audit: mobile-viewport horizontal-overflow check on key dashboard
 * pages, against the real test account via the same safe cookie-injection approach as
 * browser-walkthrough.mjs (no tokens ever logged).
 *
 * Run with: node --env-file=.env.local scripts/audit/mobile-viewport-check.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BASE = "http://localhost:3000";

const PAGES = [
  "/dashboard", "/dashboard/marketing-recommendations", "/dashboard/approvals",
  "/dashboard/publishing", "/dashboard/google-business-profile", "/dashboard/market-context",
  "/dashboard/analytics", "/dashboard/brand-voice",
];

async function main() {
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: users } = await admin.auth.admin.listUsers();
  const email = users.users[0].email;
  const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: otpData } = await anon.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });

  const capturedCookies = [];
  const ssrClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => [], setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        capturedCookies.push({ name, value, domain: "localhost", path: options?.path ?? "/", httpOnly: true, secure: false, sameSite: "Lax" });
      }
    }},
  });
  await ssrClient.auth.setSession({ access_token: otpData.session.access_token, refresh_token: otpData.session.refresh_token });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addCookies(capturedCookies);
  const page = await context.newPage();

  const results = [];
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => console.error(`nav error ${path}:`, e.message));
    await page.waitForTimeout(300);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
    ).catch(() => "eval-failed");
    results.push({ path, hasHorizontalOverflow });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error("crashed:", err.message);
  process.exit(1);
});
