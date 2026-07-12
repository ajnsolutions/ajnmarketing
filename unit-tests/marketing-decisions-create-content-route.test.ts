import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/marketing-recommendations/create-content/route.ts";

// This codebase has no precedent for unit-testing a Route Handler directly (every other
// API route is only exercised indirectly, through its injectable *ForUser core function).
// It's viable here because Next.js Route Handlers are plain async functions over the
// standard Request/Response Web APIs -- unit-tests/support/server-only-stub-hook.mjs stubs
// "next/server" so NextResponse.json() resolves outside Next's own runtime (see that file
// for why). The validation paths below (malformed JSON, missing id, malformed UUID) return
// before any call to generateContentDraftForRecommendationForCurrentUser, so they exercise
// real route code with no mocking needed. generateContentDraftForRecommendationForCurrentUser
// itself always calls the real createClient(), which depends on next/headers' cookies() --
// unavailable here, so it throws (the same "next/headers" stub used throughout this test
// suite) -- which is exactly what lets the "valid UUID, no request context" tests below
// prove the route's top-level catch (added in this PR) safely converts ANY uncaught
// exception into the fixed generic message, rather than leaking it.

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/marketing-recommendations/create-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("route: rejects malformed JSON body with a clean 400, not an uncaught exception", async () => {
  const res = await POST(jsonRequest("not json"));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "Request body must be valid JSON");
});

test("route: rejects a missing recommendation_id with a clean 400", async () => {
  const res = await POST(jsonRequest({}));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "recommendation_id is required");
});

test("route: rejects a malformed recommendation_id with a clean 400 before any database access", async () => {
  const res = await POST(jsonRequest({ recommendation_id: "not-a-uuid" }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "recommendation_id must be a valid id");
});

test("route: rejects recommendation_id values close to a UUID but wrong shape", async () => {
  const almostUuid = "11111111-1111-1111-1111-11111111111"; // one hex digit short
  const res = await POST(jsonRequest({ recommendation_id: almostUuid }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "recommendation_id must be a valid id");
});

test("route: trims whitespace before validating recommendation_id", async () => {
  const res = await POST(jsonRequest({ recommendation_id: "   " }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "recommendation_id is required");
});

test("route: top-level catch converts an unexpected failure into the fixed generic message, never a raw internal error", async () => {
  // A well-formed UUID passes validation and reaches
  // generateContentDraftForRecommendationForCurrentUser, which calls the real
  // createClient() -> cookies() -> throws "[test-stub] next/headers.cookies() called
  // outside a Next.js request context" (see server-only-stub-hook.mjs). That raw message
  // must never reach the response body -- only the route's fixed fallback string may.
  const res = await POST(jsonRequest({ recommendation_id: "11111111-1111-1111-1111-111111111111" }));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, "Unable to create a draft from this recommendation. Please try again.");
  assert.equal(body.error.includes("next/headers"), false);
  assert.equal(body.error.includes("cookies"), false);
  assert.equal(JSON.stringify(body).includes("test-stub"), false);
});
