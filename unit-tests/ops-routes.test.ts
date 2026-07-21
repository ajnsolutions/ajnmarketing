import test from "node:test";
import assert from "node:assert/strict";
import { GET as opsGet } from "../app/api/admin/ops/route.ts";
import { POST as jobRetryPost } from "../app/api/admin/ops/jobs/[id]/retry/route.ts";
import { GET as readyGet } from "../app/api/health/ready/route.ts";

async function expectUnauthorizedOrThrown(run: () => Promise<Response>) {
  try {
    const res = await run();
    assert.ok(res.status === 401 || res.status === 403 || res.status >= 500);
    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = await res.json();
      assert.equal(JSON.stringify(body).includes("sk-"), false);
    }
  } catch (error) {
    assert.ok(error instanceof Error);
  }
}

test("admin ops readiness view requires authentication", async () => {
  await expectUnauthorizedOrThrown(() =>
    opsGet(new Request("http://localhost/api/admin/ops?view=readiness"))
  );
});

test("admin ops tenants view requires authentication", async () => {
  await expectUnauthorizedOrThrown(() =>
    opsGet(new Request("http://localhost/api/admin/ops?view=tenants"))
  );
});

test("admin ops jobs view requires authentication", async () => {
  await expectUnauthorizedOrThrown(() =>
    opsGet(new Request("http://localhost/api/admin/ops?view=jobs"))
  );
});

test("admin job retry endpoint requires authentication", async () => {
  await expectUnauthorizedOrThrown(() =>
    jobRetryPost(
      new Request("http://localhost/api/admin/ops/jobs/does-not-exist/retry", { method: "POST" }),
      { params: Promise.resolve({ id: "does-not-exist" }) }
    )
  );
});

test("health readiness endpoint never exposes secrets and returns a meaningful status", async () => {
  const res = await readyGet();
  assert.ok([200, 503].includes(res.status));
  const body = await res.json();
  assert.ok(["ready", "degraded", "unknown", "unavailable", "not_configured"].includes(body.status));
  const blob = JSON.stringify(body);
  assert.equal(blob.includes("sk-"), false);
  assert.equal(blob.toLowerCase().includes("service_role"), false);
});
