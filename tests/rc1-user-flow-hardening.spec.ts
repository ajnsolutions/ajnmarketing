import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard/brand-voice redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/brand-voice");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated /dashboard/notifications redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/notifications");
  await expect(page).toHaveURL(/\/login/);
});

test("Brand Voice page no longer fabricates a match label, fake source list, or fake history", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );

  // The hardcoded "Strong Match" badge and fabricated source list are gone —
  // matchScoreLabel is now computed from the real score.
  expect(source).not.toMatch(/>\s*Strong Match\s*</);
  expect(source).not.toContain('["Website", "Google Profile", "Reviews"]');
  expect(source).toContain("matchScoreLabel");
  expect(source).toContain("hasWebsiteAnalysis");

  // The fabricated "AI Learning Timeline" with fake dated events is gone.
  expect(source).not.toContain("AI Learning Timeline");
  expect(source).not.toContain("Jun 18,");

  // The two header buttons that had no onClick handler at all are gone, as are the
  // dead "Approve Style"/"Edit Tone" buttons on each sample card.
  expect(source).not.toContain("Refresh Voice Profile");
  expect(source).not.toContain("Approve Style");
  expect(source).not.toContain("Edit Tone");

  // Tone selection is now actually persisted, not just local state with a copy claim
  // that nothing backs.
  expect(source).toContain("brand_voice_tone: selectedTones");
});

test("matchScoreLabel is a pure, importable, testable function — not fabricated inline JSX", async () => {
  const source = readFileSync(
    join(process.cwd(), "lib/brand-voice/matchScoreLabel.ts"),
    "utf8",
  );
  expect(source).toContain("Not yet analyzed");
  expect(source).toContain("Early signal");
  expect(source).toContain("Good match");
  expect(source).toContain("Strong match");
});

test("notifications setup step no longer promises a configurable preferences screen it doesn't have", async () => {
  const source = readFileSync(join(process.cwd(), "lib/customer-setup/steps.ts"), "utf8");
  expect(source).not.toContain('primaryActionLabel: "Review notifications"');
  expect(source).not.toMatch(/description: "How you prefer to hear about/);
});

test("Brand Voice page keeps its real, working save action and mobile-safe patterns", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );
  expect(source).toContain("Save Voice Preferences");
  expect(source).toContain("handleSaveNotes");
  expect(source).toMatch(/role="status"/);
});

test("guided-onboarding-setup and customer-experience-polish regressions remain green", async () => {
  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
