import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { runPublicBusinessDiscovery } from "../lib/business-discovery/public/service.ts";
import type { PinnedResponse } from "../lib/business-discovery/public/pinnedRequest.ts";

/**
 * Regression coverage for a release-blocking investigation
 * (docs/BUSINESS_DISCOVERY_SNAPSHOT_TROUBLESHOOTING.md): confirms the
 * Snapshot flow's intended degraded-result experience actually works end to
 * end — a missing/unavailable AI provider must never crash or hang the
 * request, only mark the result honestly as degraded and still return a
 * fully usable result. This exercises the real orchestrator
 * (runPublicBusinessDiscovery), not just the presentation layer's `degraded`
 * flag threading (already covered by business-discovery-public-map-result.test.ts).
 */

const publicResolver = async () => ["93.184.216.34"];

function htmlResponse(html: string): PinnedResponse {
  return { statusCode: 200, headers: { "content-type": "text/html" }, body: Readable.from([html]) as PinnedResponse["body"] };
}

function withoutOpenAiKey<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  return fn().finally(() => {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  });
}

test("a website scan with no OpenAI key configured still returns 200-equivalent, usable, honestly-degraded result", async () => {
  const requestImpl = async () =>
    htmlResponse(
      "<html><head><title>Acme HVAC</title></head><body><h1>Acme HVAC</h1><h2>Furnace Repair</h2><p>We serve homeowners with heating and cooling repair.</p></body></html>"
    );

  const result = await withoutOpenAiKey(() =>
    runPublicBusinessDiscovery(
      { contractVersion: "v1", websiteUrl: "https://acme-hvac.example/" },
      { resolver: publicResolver, requestImpl }
    )
  );

  // Never crashes, never hangs — a full, well-formed result comes back.
  assert.ok(result.snapshotReference);
  assert.equal(result.degraded, true);
  assert.ok(result.businessSummary.value, "business summary must still be populated from the deterministic fallback");
  assert.ok(result.primaryServices.value && result.primaryServices.value.length > 0);
  assert.equal(result.overallConfidence.tier, "assumed");

  // The degraded flag must be honest, not hidden behind a generic success shape.
  assert.notEqual(result.overallConfidence.explanation.length, 0);
});

test("a second, different business scan also completes cleanly with no OpenAI key -- not a fluke of one specific input", async () => {
  const requestImpl = async () =>
    htmlResponse("<html><body><h1>Bright Smile Dental</h1><p>We offer teeth cleaning and general dentistry.</p></body></html>");

  // Deliberately unset here too -- this suite must never make a real,
  // billed OpenAI call. See withoutOpenAiKey above.
  const result = await withoutOpenAiKey(() =>
    runPublicBusinessDiscovery(
      { contractVersion: "v1", websiteUrl: "https://bright-smile.example/" },
      { resolver: publicResolver, requestImpl }
    )
  );

  assert.ok(result.snapshotReference);
  assert.equal(result.degraded, true);
  assert.ok(result.businessSummary.value);
});
