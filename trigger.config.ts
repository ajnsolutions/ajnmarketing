import { defineConfig } from "@trigger.dev/sdk";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import { nextRuntimeStubPlugin } from "./trigger/build/nextRuntimeStubPlugin";

/**
 * PROJECT REF: no Trigger.dev project has been created yet (out of scope for this
 * branch — see docs/ADR_AUTONOMOUS_SCHEDULER.md and the PR description). This is
 * intentionally left as a required env var rather than a made-up placeholder string,
 * so a missing/misconfigured project ref fails loudly at `trigger.dev dev`/`deploy`
 * time instead of silently pointing at the wrong (or a fake-looking) project.
 */
const projectRef = process.env.TRIGGER_PROJECT_REF;
if (!projectRef) {
  throw new Error(
    "TRIGGER_PROJECT_REF is not set. Create a Trigger.dev project and set this env var before running `trigger.dev dev` or `deploy` — see the PR description for what's still required."
  );
}

export default defineConfig({
  project: projectRef,
  dirs: ["./trigger"],
  // Analytics capture is a bounded read/write per tenant; 60s is generous headroom over
  // observed local execution time, well short of anything that would mask a real hang.
  maxDuration: 60,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 2_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    // See trigger/build/nextRuntimeStubPlugin.ts: this repo's lib/ modules are written
    // for Next.js's bundler and import "server-only" / "next/headers", neither of which
    // esbuild (Trigger.dev's build tool) can resolve on its own. Verified empirically —
    // without this plugin, `trigger.dev deploy` fails to bundle any task that transitively
    // imports the injectable analytics functions.
    extensions: [esbuildPlugin(nextRuntimeStubPlugin(), { placement: "first" })],
  },
});
