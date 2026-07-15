import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const siteContent = readFileSync(
  new URL("../lib/site-content.ts", import.meta.url),
  "utf8",
);
const homepage = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const homepageSections = readFileSync(
  new URL("../components/home/homepage-sections.tsx", import.meta.url),
  "utf8",
);
const scheduleActivation = readFileSync(
  new URL("../lib/trigger/scheduleActivation.ts", import.meta.url),
  "utf8",
);

describe("public homepage phase 1 redesign", () => {
  it("nav matches phase-1 IA", () => {
    assert.match(siteContent, /href: "\/features"/);
    assert.match(siteContent, /href: "\/about"/);
    assert.match(siteContent, /href: "\/contact"/);
    assert.match(siteContent, /getStartedHref = "\/demo"/);
  });

  it("how-it-works uses six connect-to-improve steps", () => {
    for (const title of [
      "Connect",
      "Learn",
      "Create",
      "Approve",
      "Publish",
      "Improve",
    ]) {
      assert.match(siteContent, new RegExp(`title: "${title}"`));
    }
  });

  it("homepage story includes required sections without fabricated testimonials", () => {
    assert.match(homepage, /HomeHero/);
    assert.match(homepage, /HomeProblem/);
    assert.match(homepage, /HomeWeeklyApproval/);
    assert.match(homepage, /HomeAiSearch/);
    assert.match(homepageSections, /Stop worrying about marketing/);
    assert.match(homepageSections, /marketing employee/);
    assert.equal(homepageSections.includes("★★★★★"), false);
    assert.equal(homepageSections.includes("250+"), false);
  });

  it("AI search section stays non-promissory", () => {
    assert.match(homepageSections, /do not\s+promise ranking/i);
  });

  it("does not activate production crons", () => {
    assert.match(
      scheduleActivation,
      /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/,
    );
  });
});
