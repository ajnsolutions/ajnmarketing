import test from "node:test";
import assert from "node:assert/strict";
import { GET as publicHealthGet } from "../app/api/health/route.ts";
import { GET as adminOpsGet } from "../app/api/admin/ops/route.ts";

test("public health endpoint returns schedule gate closed and no secrets", async () => {
  const res = await publicHealthGet();
  assert.ok(res.status === 200 || res.status === 503);
  const body = await res.json();
  assert.ok(["healthy", "warning", "critical"].includes(body.status));
  assert.equal(body.scheduleGateOpen, false);
  assert.ok(Array.isArray(body.categories));
  const blob = JSON.stringify(body);
  assert.equal(blob.includes("SUPABASE_SECRET_KEY"), false);
  assert.equal(blob.toLowerCase().includes("bearer"), false);
});

test("admin ops endpoint requires authentication", async () => {
  // createClient -> cookies stub throws or returns no user depending on harness.
  // Either unauthorized JSON or a thrown stub is acceptable as long as we never 200.
  try {
    const res = await adminOpsGet(new Request("http://localhost/api/admin/ops"));
    assert.ok(res.status === 401 || res.status === 403 || res.status >= 500);
    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = await res.json();
      assert.equal(JSON.stringify(body).includes("sk-"), false);
    }
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(error.message.toLowerCase().includes("service_role"), false);
  }
});
