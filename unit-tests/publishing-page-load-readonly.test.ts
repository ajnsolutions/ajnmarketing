import test from "node:test";
import assert from "node:assert/strict";

/**
 * Page loads and GET must never execute publishing jobs. Assert source contracts so
 * regressions (re-introducing processDue on loaders/GET) fail loudly in CI.
 */

test("GET /api/publishing is read-only and never calls due-job processors or execute", async () => {
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
  assert.match(source, /export async function POST/);
});

test("getPublishingDashboardData (page loader) never executes due jobs", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(
    new URL("../lib/publishing-server.ts", import.meta.url),
    "utf8"
  );

  assert.equal(/import\s*\{[^}]*processDueScheduledPublishingJobs/.test(source), false);
  assert.equal(/await\s+processDueScheduledPublishingJobs/.test(source), false);
  assert.equal(/import\s*\{[^}]*executePublishingJobById/.test(source), false);
  assert.equal(/await\s+executePublishingJobById/.test(source), false);
  assert.match(source, /Read-only/);
  assert.match(source, /getPublishingDashboardJobsForUser/);
});

test("dashboard publishing page uses the read-only loader only", async () => {
  const fs = await import("node:fs/promises");
  const page = await fs.readFile(
    new URL("../app/dashboard/publishing/page.tsx", import.meta.url),
    "utf8"
  );
  const libraryPage = await fs.readFile(
    new URL("../app/dashboard/library/page.tsx", import.meta.url),
    "utf8"
  );
  const contentRedirect = await fs.readFile(
    new URL("../app/dashboard/content/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(page, /getPublishingDashboardData/);
  assert.equal(/await\s+processDueScheduledPublishingJobs/.test(page), false);
  assert.equal(/await\s+executePublishingJobById/.test(page), false);
  assert.match(libraryPage, /getPublishingDashboardData/);
  assert.equal(/await\s+processDueScheduledPublishingJobs/.test(libraryPage), false);
  assert.match(contentRedirect, /redirect\("\/dashboard\/library"\)/);
});

test("shared execution path: worker and scheduler both call executePublishingJobById", async () => {
  const fs = await import("node:fs/promises");
  const worker = await fs.readFile(
    new URL("../lib/background-jobs/worker.ts", import.meta.url),
    "utf8"
  );
  const scheduler = await fs.readFile(
    new URL("../lib/publishing/publishingScheduler.ts", import.meta.url),
    "utf8"
  );
  const engine = await fs.readFile(
    new URL("../lib/publishing/publishingEngine.ts", import.meta.url),
    "utf8"
  );

  assert.match(worker, /executePublishingJobById/);
  assert.match(scheduler, /executePublishingJobById/);
  assert.match(engine, /claimPublishingJobForExecution/);
  assert.match(engine, /canAttemptPublishingClaim/);
  assert.match(scheduler, /Must NOT be called from page loaders/);
});

test("no remaining page-load callers of processDueScheduledPublishingJobsForUser", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    "app/api/publishing/route.ts",
    "lib/publishing-server.ts",
    "app/dashboard/publishing/page.tsx",
    "app/dashboard/library/page.tsx",
    "app/dashboard/content/page.tsx",
    "lib/command-center/context.ts",
    "lib/publishing-queue-server.ts",
  ];

  for (const rel of candidates) {
    const source = await fs.readFile(path.join(root, rel), "utf8");
    assert.equal(
      /import\s*\{[^}]*processDueScheduledPublishingJobs/.test(source),
      false,
      `${rel} must not import processDueScheduledPublishingJobs*`
    );
    assert.equal(
      /await\s+processDueScheduledPublishingJobs/.test(source),
      false,
      `${rel} must not await processDueScheduledPublishingJobs*`
    );
  }
});
