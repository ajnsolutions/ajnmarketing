/**
 * Release-candidate audit: smoke-checks the public auth pages (signup/login/forgot-password)
 * render correctly with expected form fields and no console errors. Does not submit any
 * form (account creation for RLS purposes is already covered by rls-tenant-isolation.ts).
 *
 * Run with: node scripts/audit/auth-pages-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  const results = [];
  for (const { path, expectField } of [
    { path: "/signup", expectField: /email/i },
    { path: "/login", expectField: /email/i },
    { path: "/forgot-password", expectField: /email/i },
  ]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(300);
    const hasEmailField = (await page.locator('input[type="email"], input[name="email"]').count()) > 0;
    const bodyText = await page.locator("body").innerText();
    results.push({ path, hasEmailField, bodyMentionsEmail: expectField.test(bodyText) });
  }
  console.log(JSON.stringify(results, null, 2));
  console.log("Console errors across auth pages:", consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors);
  await browser.close();
}

main().catch((err) => { console.error(err.message); process.exit(1); });
