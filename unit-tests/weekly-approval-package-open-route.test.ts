import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/weekly-approval-package/open/route.ts";

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

test("open route: missing token returns 400 without approving", async () => {
  const res = await GET(new Request("http://localhost/api/weekly-approval-package/open"));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /missing/i);
});

test("open route: forged token returns 400 without approving", async () => {
  await withEnv({ TOKEN_ENCRYPTION_KEY: "0".repeat(64) }, async () => {
    const res = await GET(
      new Request("http://localhost/api/weekly-approval-package/open?token=not-a-real-token")
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(typeof body.error === "string");
    assert.equal(JSON.stringify(body).toLowerCase().includes("approved"), false);
  });
});
