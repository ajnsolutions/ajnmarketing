import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyAudienceToGoals,
  audienceFromGoals,
  buildDeferredConnectionsNote,
  parseDeferredConnections,
} from "../lib/onboarding-storage.ts";
import {
  buildFirstDaysHomeModel,
  shouldUseFocusedNav,
} from "../lib/dashboard/first-days-home.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  onboardingDataToProfileRow,
  profileRowToOnboardingData,
} from "../lib/business-profile.ts";
import { initialOnboardingData } from "../lib/onboarding-storage.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for First Five Minutes", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("audience encodes into marketing_goals without schema change", () => {
  const goals = applyAudienceToGoals(["More phone calls"], "local");
  assert.ok(goals.includes("Audience: Local business"));
  assert.equal(audienceFromGoals(goals), "local");
});

test("deferred social connections encode into voice_notes", () => {
  const note = buildDeferredConnectionsNote("Friendly tone.", true, true);
  assert.match(note, /Deferred connections: Facebook, Instagram/);
  const parsed = parseDeferredConnections(note);
  assert.equal(parsed.facebookSkipped, true);
  assert.equal(parsed.instagramSkipped, true);
});

test("onboarding round-trip preserves Magic fields via existing columns", () => {
  const data = {
    ...initialOnboardingData,
    businessName: "Acme Plumbing",
    websiteUrl: "https://acme.example",
    businessAudience: "online" as const,
    facebookSkipped: true,
    instagramSkipped: false,
    gbpAnswer: "not_sure" as const,
    gbpSkipped: true,
    competitorsSkipped: true,
    exampleMessage: "We fix pipes fast.",
  };

  const row = onboardingDataToProfileRow("user-1", data, true);
  assert.ok(row.marketing_goals?.includes("Audience: Online business"));
  assert.match(row.voice_notes ?? "", /Deferred connections: Facebook/);
  assert.equal(/Instagram/.test(row.voice_notes ?? ""), false);

  const roundTrip = profileRowToOnboardingData({
    id: "biz-1",
    user_id: "user-1",
    business_name: row.business_name,
    industry: row.industry,
    website: row.website,
    phone: row.phone,
    city: row.city,
    state: row.state,
    primary_service_area: row.primary_service_area,
    nearby_cities: row.nearby_cities,
    primary_services: row.primary_services,
    emergency_services: row.emergency_services,
    seasonal_services: row.seasonal_services,
    specialty_services: row.specialty_services,
    competitors: row.competitors,
    marketing_goals: row.marketing_goals,
    brand_voice_tone: row.brand_voice_tone,
    preferred_words: row.preferred_words,
    avoid_words: row.avoid_words,
    voice_notes: row.voice_notes,
    onboarding_completed: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  assert.equal(roundTrip.businessAudience, "online");
  assert.equal(roundTrip.facebookSkipped, true);
  assert.equal(roundTrip.instagramSkipped, false);
  assert.match(roundTrip.exampleMessage, /We fix pipes fast/);
});

test("first-days home prioritizes Google connect and focused nav for early customers", () => {
  const model = buildFirstDaysHomeModel({
    userName: "Sean Carter",
    businessName: "Acme Plumbing",
    websiteUrl: "https://acme.example",
    voiceNotes: "Deferred connections: Facebook (future recommendation).",
    gbpConnected: false,
    recommendationCount: 0,
    now: new Date("2026-07-15T15:00:00"),
  });

  assert.match(model.greeting, /Sean/);
  assert.equal(model.primaryAction.kind, "connect_google");
  assert.equal(model.isEarlyCustomer, true);
  assert.equal(shouldUseFocusedNav(model), true);
});

test("first-days home can report nothing needed", () => {
  const model = buildFirstDaysHomeModel({
    userName: "Sean",
    businessName: "Acme",
    websiteUrl: "https://acme.example",
    voiceNotes: "",
    gbpConnected: true,
    recommendationCount: 0,
    now: new Date("2026-07-15T09:00:00"),
  });

  assert.equal(model.primaryAction.kind, "none");
  assert.equal(model.isEarlyCustomer, false);
});

test("onboarding wizard uses Magic Head of Marketing copy and GBP connect path", () => {
  const source = readFileSync(
    join(root, "components/onboarding/onboarding-wizard.tsx"),
    "utf8",
  );
  assert.match(source, /Head of Marketing/);
  assert.match(source, /Meet Your Head of Marketing/);
  assert.match(source, /let you know when I need you/);
  assert.match(source, /\/dashboard\/google-business-profile\/connect/);
  assert.equal(source.includes("Google connection coming soon"), false);
  assert.equal(source.includes("AJN AI is preparing"), false);
  assert.equal(source.includes("Initializing"), false);
});

test("First Five Minutes documentation exists", () => {
  const doc = readFileSync(join(root, "docs/FIRST_FIVE_MINUTES.md"), "utf8");
  assert.match(doc, /Magic Moments/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
  assert.match(doc, /Future follow-on/);
});
