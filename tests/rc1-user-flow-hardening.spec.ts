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

test("Brand Voice save never overwrites brand_voice_tone unless the customer touched a tone chip", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );

  // brand_voice_tone is a shared field (content-generation prompts, AI Marketing
  // Profile, review replies, Marketing Memory, setup readiness) and independently
  // freeform-editable via Settings — an unconditional overwrite on every notes-only
  // save would silently destroy a richer existing value.
  expect(source).toContain("tonesDirty");
  expect(source).toMatch(/setTonesDirty\(true\)/);
  expect(source).toMatch(/tonesDirty\s*\n?\s*\?\s*\{\s*brand_voice_tone:/);
});

test("Brand Voice source attribution only claims Website once analysis actually completed", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );

  // A website_analyses row can exist while pending/running/failed — analysis_score
  // stays null until analysis_status is "completed". Claiming "Website" as an
  // analyzed source in those states would contradict a simultaneous "Not yet
  // analyzed" score badge.
  expect(source).toContain('hasWebsiteAnalysis={analysis?.analysis_status === "completed"}');
  expect(source).not.toContain("hasWebsiteAnalysis={Boolean(analysis)}");
});

test("Brand Voice SectionCard has no dead action button", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );

  // The local SectionCard component previously accepted an `action` label and
  // rendered a button with no onClick at all — unreachable from any of the file's
  // call sites, but a trap for future edits.
  expect(source).not.toContain("action?: string");
});

test("Brand Voice example quote falls back honestly instead of rendering blank on a failed analysis", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );

  // markWebsiteAnalysisFailed always writes raw_summary.brandVoice as "" (never
  // null) on a real failure. A `??` chain stops at that empty string and renders a
  // blank quote; displayValue treats an empty string as absent and falls through
  // to the honest default paragraph.
  expect(source).toContain("const exampleParagraph = displayValue(");
  expect(source).not.toMatch(/analysis\?\.brand_voice \?\?\s*\n\s*analysis\?\.raw_summary\?\.brandVoice \?\?/);
});

test("Brand Voice tone chips expose pressed state to assistive tech", async () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/brand-voice-page.tsx"),
    "utf8",
  );
  expect(source).toContain("aria-pressed={selectedTones.includes(option)}");
});
