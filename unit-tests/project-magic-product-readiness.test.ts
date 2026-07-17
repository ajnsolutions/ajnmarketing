import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Product Readiness", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("shared loading and error states use Head of Marketing voice", () => {
  const states = readFileSync(
    join(root, "components/dashboard/ui/dashboard-states.tsx"),
    "utf8",
  );
  assert.match(states, /Preparing your Head of Marketing briefing|Preparing this week's briefing/);
  assert.match(states, /I couldn't complete that just now/);
  assert.match(states, /Nothing is wrong on your side/);
  assert.equal(states.includes("Loading dashboard..."), false);
});

test("primary destinations have thoughtful loading routes", () => {
  for (const rel of [
    "app/dashboard/loading.tsx",
    "app/dashboard/results/loading.tsx",
    "app/dashboard/library/loading.tsx",
    "app/dashboard/settings/loading.tsx",
    "app/dashboard/approvals/loading.tsx",
  ]) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.match(src, /DashboardLoadingSkeleton/);
    assert.match(src, /label=/);
  }
});

test("Results and Library avoid Approval Center / analytics-loop language", () => {
  const results = readFileSync(join(root, "components/dashboard/analytics-page.tsx"), "utf8");
  assert.equal(results.includes("analytics loop"), false);
  assert.equal(results.includes("command center prompts"), false);
  assert.match(results, /What stands out|What's working well/);

  const library = readFileSync(join(root, "components/dashboard/content-page.tsx"), "utf8");
  assert.match(library, /Needs your opinion|Waiting for your opinion/);
  assert.equal(library.includes("Awaiting Approval"), false);

  const publishing = readFileSync(
    join(root, "components/dashboard/publishing-queue-panel.tsx"),
    "utf8",
  );
  assert.equal(publishing.includes("Approval Center"), false);
});

test("accessibility and reduced-motion utilities ship", () => {
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.hom-focusable/);
  assert.match(css, /hom-disclose-content/);

  const journal = readFileSync(
    join(root, "components/dashboard/head-of-marketing-journal.tsx"),
    "utf8",
  );
  assert.match(journal, /hom-focusable/);

  const topbar = readFileSync(join(root, "components/dashboard/dashboard-topbar.tsx"), "utf8");
  assert.match(topbar, /aria-label=\{`Settings for/);
});

test("Product Readiness docs record walkthrough and confirmations", () => {
  const doc = readFileSync(join(root, "docs/PRODUCT_READINESS.md"), "utf8");
  assert.match(doc, /Audit checklist/);
  assert.match(doc, /Issues found/);
  assert.match(doc, /Issues fixed/);
  assert.match(doc, /Customer walkthrough/);
  assert.match(doc, /Remaining opportunities/);
  assert.match(doc, /Release readiness/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
});
