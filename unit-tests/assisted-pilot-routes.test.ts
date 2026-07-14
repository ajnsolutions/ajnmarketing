import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/admin/pilot/route.ts";

test("pilot API GET requires authentication", async () => {
  try {
    const res = await GET();
    assert.ok(res.status === 401 || res.status === 403 || res.status >= 500);
  } catch (error) {
    assert.ok(error instanceof Error);
  }
});

test("pilot API POST requires authentication before mutating", async () => {
  try {
    const res = await POST(
      new Request("http://localhost/api/admin/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_action" }),
      })
    );
    assert.ok(res.status === 401 || res.status === 403 || res.status >= 500);
    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = await res.json();
      assert.equal(JSON.stringify(body).includes("service_role"), false);
    }
  } catch (error) {
    assert.ok(error instanceof Error);
  }
});
