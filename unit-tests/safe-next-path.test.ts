import test from "node:test";
import assert from "node:assert/strict";
import { safeInternalNextPath } from "../lib/auth/safeNextPath.ts";

test("safeInternalNextPath allows relative app paths", () => {
  assert.equal(safeInternalNextPath("/dashboard/admin/ops"), "/dashboard/admin/ops");
  assert.equal(
    safeInternalNextPath("/api/weekly-approval-package/open?token=abc"),
    "/api/weekly-approval-package/open?token=abc"
  );
});

test("safeInternalNextPath blocks open redirects", () => {
  assert.equal(safeInternalNextPath("//evil.com"), "/dashboard");
  assert.equal(safeInternalNextPath("https://evil.com"), "/dashboard");
  assert.equal(safeInternalNextPath("/\\evil.com"), "/dashboard");
  assert.equal(safeInternalNextPath("/@evil.com"), "/dashboard");
  assert.equal(safeInternalNextPath("/\tevil.com"), "/dashboard");
  assert.equal(safeInternalNextPath("/\nevil.com"), "/dashboard");
  assert.equal(safeInternalNextPath(null), "/dashboard");
});
