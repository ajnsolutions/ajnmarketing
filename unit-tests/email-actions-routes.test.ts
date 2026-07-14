import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/email-actions/open/route.ts";
import { POST } from "../app/api/email-actions/execute/route.ts";
import { createEmailActionToken } from "../lib/email-actions/tokens.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
}

const SIGNING_ENV = { EMAIL_ACTION_TOKEN_SECRET: "3".repeat(64) };

/**
 * These routes call createClient() (next/headers cookies()) only *after* verifying the
 * token, which requires real Next.js request scope this unit-test environment doesn't
 * provide. So route-level tests here cover exactly what happens before that point --
 * token validation always fails closed without ever reaching auth/mutation code. The
 * post-auth tenant/session/mutation behavior is covered directly against
 * lib/email-actions/service.ts (see email-actions-service.test.ts), which every route
 * delegates to.
 */

test("GET /api/email-actions/open: missing token returns 400 without executing anything", async () => {
  const res = await GET(new Request("http://localhost/api/email-actions/open"));
  assert.equal(res.status, 400);
});

test("GET /api/email-actions/open: forged token returns a 'link not valid' page, never executes", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const res = await GET(new Request("http://localhost/api/email-actions/open?token=not-a-real-token"));
    assert.equal(res.status, 400);
    const html = await res.text();
    assert.match(html, /not valid/i);
    assert.equal(html.toLowerCase().includes("approved"), false);
  });
});

test("GET /api/email-actions/open: expired token returns a 410 'link expired' page, never executes", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const token = createEmailActionToken({
      action: "approve",
      userId: "user-1",
      businessProfileId: "biz-1",
      emailRecipient: "owner@example.com",
      contentApprovalId: "ca-1",
      ttlSeconds: 1,
      now: new Date("2026-07-01T00:00:00.000Z"),
    });

    const res = await GET(new Request(`http://localhost/api/email-actions/open?token=${encodeURIComponent(token)}`));
    assert.equal(res.status, 410);
    const html = await res.text();
    assert.match(html, /expired/i);
  });
});

test("POST /api/email-actions/execute: missing token returns 400 without executing anything", async () => {
  const form = new FormData();
  const res = await POST(new Request("http://localhost/api/email-actions/execute", { method: "POST", body: form }));
  assert.equal(res.status, 400);
});

test("POST /api/email-actions/execute: forged token is rejected before any mutation runs", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const form = new FormData();
    form.set("token", "not-a-real-token");
    const res = await POST(new Request("http://localhost/api/email-actions/execute", { method: "POST", body: form }));
    assert.equal(res.status, 400);
    const html = await res.text();
    assert.match(html, /not valid/i);
  });
});

test("POST /api/email-actions/execute: expired token returns 410, never executes", async () => {
  await withEnv(SIGNING_ENV, async () => {
    const token = createEmailActionToken({
      action: "approve_all",
      userId: "user-1",
      businessProfileId: "biz-1",
      emailRecipient: "owner@example.com",
      contentApprovalIds: ["ca-1", "ca-2"],
      ttlSeconds: 1,
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    const form = new FormData();
    form.set("token", token);

    const res = await POST(new Request("http://localhost/api/email-actions/execute", { method: "POST", body: form }));
    assert.equal(res.status, 410);
    const html = await res.text();
    assert.match(html, /expired/i);
  });
});
