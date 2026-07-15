import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const footer = readFileSync(
  new URL("../components/site-footer.tsx", import.meta.url),
  "utf8",
);
const trustBar = readFileSync(
  new URL("../components/home/hero-trust-bar.tsx", import.meta.url),
  "utf8",
);
const stats = readFileSync(
  new URL("../components/home/stats-strip.tsx", import.meta.url),
  "utf8",
);
const notFound = readFileSync(
  new URL("../app/not-found.tsx", import.meta.url),
  "utf8",
);

describe("public website UX audit limited fixes", () => {
  it("footer does not use placeholder hash company or social links", () => {
    assert.equal(footer.includes('href="#"'), false);
    assert.match(footer, /for-agencies/);
    assert.match(footer, /coming soon/i);
  });

  it("homepage trust signals avoid unverifiable scale claims", () => {
    assert.equal(trustBar.includes("250+"), false);
    assert.equal(trustBar.includes("4.9"), false);
    assert.equal(stats.includes("10,000+"), false);
    assert.equal(stats.includes("128+"), false);
    assert.match(stats, /90-day/i);
    assert.match(stats, /Approval/i);
  });

  it("custom not-found page offers recovery CTAs", () => {
    assert.match(notFound, /Page not found/);
    assert.match(notFound, /href="\/"/);
    assert.match(notFound, /\/demo/);
  });
});
