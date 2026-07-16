import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  applyCustomerOriginToGoals,
  buildDeferredConnectionsNote,
  customerOriginFromGoals,
  learningProgressMessages,
  parseDeferredConnections,
} from "../lib/onboarding-storage.ts";
import {
  onboardingDataToProfileRow,
  profileRowToOnboardingData,
} from "../lib/business-profile.ts";
import { initialOnboardingData } from "../lib/onboarding-storage.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Meet Your HoM", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("customer origin encodes into marketing_goals without schema change", () => {
  const goals = applyCustomerOriginToGoals(["More phone calls"], "regional");
  assert.ok(goals.includes("Customers: Regional"));
  assert.equal(customerOriginFromGoals(goals), "regional");
});

test("deferred connections include LinkedIn", () => {
  const note = buildDeferredConnectionsNote("Tone.", true, false, true);
  assert.match(note, /Facebook/);
  assert.match(note, /LinkedIn/);
  assert.equal(/Instagram/.test(note), false);
  const parsed = parseDeferredConnections(note);
  assert.equal(parsed.linkedinSkipped, true);
  assert.equal(parsed.facebookSkipped, true);
  assert.equal(parsed.instagramSkipped, false);
});

test("learning progress messages avoid technical verbs and tailor by audience", () => {
  const local = learningProgressMessages("local");
  const online = learningProgressMessages("online");
  assert.ok(local.some((line) => /community/i.test(line)));
  assert.ok(online.some((line) => /discover/i.test(line)));
  for (const line of [...local, ...online]) {
    assert.equal(/Initializing|Analyzing|Generating|Loading/i.test(line), false);
  }
});

test("onboarding round-trip preserves origin and LinkedIn skip", () => {
  const data = {
    ...initialOnboardingData,
    businessName: "Summit Advisors",
    websiteUrl: "https://summit.example",
    businessAudience: "online" as const,
    customerOrigin: "national" as const,
    facebookSkipped: false,
    instagramSkipped: true,
    linkedinSkipped: true,
    gbpAnswer: "yes" as const,
    gbpSkipped: false,
    competitorsSkipped: true,
    exampleMessage: "Clear guidance for growing teams.",
  };

  const row = onboardingDataToProfileRow("user-1", data, true);
  assert.ok(row.marketing_goals?.includes("Audience: Online business"));
  assert.ok(row.marketing_goals?.includes("Customers: National"));
  assert.match(row.voice_notes ?? "", /Instagram/);
  assert.match(row.voice_notes ?? "", /LinkedIn/);

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

  assert.equal(roundTrip.customerOrigin, "national");
  assert.equal(roundTrip.linkedinSkipped, true);
  assert.equal(roundTrip.instagramSkipped, true);
});

test("Meet Your HoM wizard and docs ship conversation philosophy", () => {
  const wizard = readFileSync(
    join(root, "components/onboarding/onboarding-wizard.tsx"),
    "utf8",
  );
  assert.match(wizard, /Before I can help grow your business/);
  assert.match(wizard, /Where do your customers come from/);
  assert.match(wizard, /Meet Your Head of Marketing/);
  assert.match(wizard, /give me more responsibility/);
  assert.match(wizard, /already started learning about your business/);
  assert.equal(wizard.includes("Fill out"), false);
  assert.equal(wizard.includes("Initializing"), false);

  const doc = readFileSync(join(root, "docs/MEET_YOUR_HEAD_OF_MARKETING.md"), "utf8");
  assert.match(doc, /Conversation philosophy/);
  assert.match(doc, /Progressive setup/);
  assert.match(doc, /Trust introduction/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
});
