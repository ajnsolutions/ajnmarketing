import test from "node:test";
import assert from "node:assert/strict";
import { buildOnboardingPrefillFromSnapshot, mergeOnboardingPrefill } from "../lib/business-discovery/continuation/onboardingPrefill.ts";
import { initialOnboardingData } from "../lib/onboarding-storage.ts";
import type { PublicBusinessDiscoveryResultV1 } from "../lib/business-discovery/public/types.ts";

function fakeSnapshot(overrides: Partial<PublicBusinessDiscoveryResultV1> = {}): PublicBusinessDiscoveryResultV1 {
  return {
    contractVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    snapshotReference: "ref",
    websiteUrl: "https://acmehvac.example/",
    businessName: "Acme HVAC",
    city: "Springfield",
    stateOrRegion: "IL",
    ...overrides,
  } as unknown as PublicBusinessDiscoveryResultV1;
}

test("buildOnboardingPrefillFromSnapshot maps only visitor-supplied fields, never AI insights", () => {
  const prefill = buildOnboardingPrefillFromSnapshot(fakeSnapshot());
  assert.deepEqual(prefill, {
    businessName: "Acme HVAC",
    websiteUrl: "https://acmehvac.example/",
    city: "Springfield",
    state: "IL",
  });
});

test("mergeOnboardingPrefill fills every blank field on fresh onboarding data", () => {
  const prefill = buildOnboardingPrefillFromSnapshot(fakeSnapshot());
  const merged = mergeOnboardingPrefill(initialOnboardingData, prefill);
  assert.equal(merged.businessName, "Acme HVAC");
  assert.equal(merged.websiteUrl, "https://acmehvac.example/");
  assert.equal(merged.city, "Springfield");
  assert.equal(merged.state, "IL");
});

test("mergeOnboardingPrefill never overwrites data the user (or a saved profile) already has", () => {
  const prefill = buildOnboardingPrefillFromSnapshot(fakeSnapshot());
  const existing = { ...initialOnboardingData, businessName: "My Real Business Name", city: "Chicago" };
  const merged = mergeOnboardingPrefill(existing, prefill);
  assert.equal(merged.businessName, "My Real Business Name");
  assert.equal(merged.city, "Chicago");
  // Fields the user hadn't already filled still get prefilled.
  assert.equal(merged.websiteUrl, "https://acmehvac.example/");
  assert.equal(merged.state, "IL");
});

test("a null prefill is a complete no-op — normal onboarding continues unchanged", () => {
  const merged = mergeOnboardingPrefill(initialOnboardingData, null);
  assert.deepEqual(merged, initialOnboardingData);
});

test("a prefill with missing visitor-supplied fields leaves those onboarding fields blank, not fabricated", () => {
  const prefill = buildOnboardingPrefillFromSnapshot(fakeSnapshot({ city: null, stateOrRegion: null }));
  const merged = mergeOnboardingPrefill(initialOnboardingData, prefill);
  assert.equal(merged.city, "");
  assert.equal(merged.state, "");
});
