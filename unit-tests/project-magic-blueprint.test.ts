import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const docsDir = join(dirname(fileURLToPath(import.meta.url)), "../docs");

const requiredDocs = [
  "PROJECT_MAGIC_MANIFESTO.md",
  "MAGIC_BLUEPRINT.md",
  "CUSTOMER_JOURNEYS.md",
  "MARKETING_HEALTH.md",
  "TRUST_MODEL.md",
  "VOICE_AND_PERSONALITY.md",
  "NAVIGATION_PHILOSOPHY.md",
  "DASHBOARD_PHILOSOPHY.md",
  "IMPLEMENTATION_ROADMAP.md",
] as const;

describe("project magic blueprint", () => {
  it("ships the full design constitution set", () => {
    for (const name of requiredDocs) {
      assert.equal(existsSync(join(docsDir, name)), true, `missing ${name}`);
    }
  });

  it("manifesto anchors the Head of Marketing mission", () => {
    const manifesto = readFileSync(
      join(docsDir, "PROJECT_MAGIC_MANIFESTO.md"),
      "utf8",
    );
    assert.match(manifesto, /Head of Marketing/i);
    assert.match(manifesto, /Outcomes over features/i);
    assert.match(manifesto, /Invisible AI/i);
  });

  it("trust model defines stages and management styles", () => {
    const trust = readFileSync(join(docsDir, "TRUST_MODEL.md"), "utf8");
    assert.match(trust, /Hands-On Owner/);
    assert.match(trust, /Weekly Manager/);
    assert.match(trust, /Monthly Executive/);
    assert.match(trust, /Trusted Head of Marketing/);
    assert.match(trust, /Assistant/);
    assert.match(trust, /Coordinator/);
  });

  it("marketing health uses calm states without letter-grade hero metrics", () => {
    const health = readFileSync(join(docsDir, "MARKETING_HEALTH.md"), "utf8");
    assert.match(health, /Excellent/);
    assert.match(health, /Healthy/);
    assert.match(health, /Needs Attention/);
    assert.match(health, /At Risk/);
    assert.match(health, /Never lead with letter grades/i);
  });

  it("roadmap keeps cron gate and no silent publish constraints", () => {
    const roadmap = readFileSync(
      join(docsDir, "IMPLEMENTATION_ROADMAP.md"),
      "utf8",
    );
    assert.match(roadmap, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
    assert.match(roadmap, /No silent auto-publish/i);
  });

  it("does not activate production crons in code", () => {
    const gate = readFileSync(
      join(docsDir, "../lib/trigger/scheduleActivation.ts"),
      "utf8",
    );
    assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);
  });
});
