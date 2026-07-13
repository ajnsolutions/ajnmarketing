import test from "node:test";
import assert from "node:assert/strict";
import { getDueScheduledPublishingJobs } from "../lib/publishing/publishingHistory.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

/**
 * GET /api/publishing must never execute due jobs. Assert the route module no longer
 * references the due-job processor, and that due selection remains scheduled/retrying only.
 */

test("publishing route GET path does not import the due-job processor", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(
    new URL("../app/api/publishing/route.ts", import.meta.url),
    "utf8"
  );

  assert.equal(/import\s*\{[^}]*processDueScheduledPublishingJobs/.test(source), false);
  assert.equal(/await\s+processDueScheduledPublishingJobs/.test(source), false);
  assert.equal(/import\s*\{[^}]*executePublishingJobById/.test(source), false);
  assert.equal(/await\s+executePublishingJobById/.test(source), false);
  assert.match(source, /read-only/i);
  assert.match(source, /getPublishingDashboardJobsForUser/);
});

test("getDueScheduledPublishingJobs only selects scheduled/retrying statuses", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(
    new URL("../lib/publishing/publishingHistory.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /in\("status", \["scheduled", "retrying"\]\)/);
  assert.match(source, /lte\("scheduled_for"/);

  const { client, calls } = createFakeSupabaseClient({
    publishing_jobs: { data: [], error: null },
  });
  const jobs = await getDueScheduledPublishingJobs(client);
  assert.deepEqual(jobs, []);
  assert.ok(calls.some((c) => c.op === "from" && c.table === "publishing_jobs"));
});

test("publishing-due Trigger task is the documented autonomous execution path", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(
    new URL("../trigger/publishingDue.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /publishing-due-sweep/);
  assert.match(source, /executePublishingJobById/);
  assert.match(source, /createServiceRoleClient/);
  assert.match(source, /getDueScheduledPublishingJobs/);
});
