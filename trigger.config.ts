import { defineConfig } from "@trigger.dev/sdk";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import type { Plugin } from "esbuild";

/**
 * Stub "server-only" / "next/headers" for Trigger.dev's esbuild bundle. Inlined in this
 * config (rather than a sibling module under ./trigger) so the native/remote build
 * server can load trigger.config.ts without resolving an extra relative import that was
 * missing from the deployment workspace.
 */
function nextRuntimeStubPlugin(): Plugin {
  return {
    name: "next-runtime-stub",
    setup(build) {
      build.onResolve({ filter: /^server-only$/ }, () => ({
        path: "server-only",
        namespace: "next-runtime-stub-server-only",
      }));
      build.onLoad({ filter: /.*/, namespace: "next-runtime-stub-server-only" }, () => ({
        contents: "export {};",
        loader: "js",
      }));

      build.onResolve({ filter: /^next\/headers$/ }, () => ({
        path: "next/headers",
        namespace: "next-runtime-stub-next-headers",
      }));
      build.onLoad({ filter: /.*/, namespace: "next-runtime-stub-next-headers" }, () => ({
        contents: [
          "export function cookies() {",
          '  throw new Error("[trigger-stub] next/headers.cookies() called outside a Next.js request context — pass an explicit Supabase client instead of relying on the request-scoped default.");',
          "}",
          "export function headers() {",
          '  throw new Error("[trigger-stub] next/headers.headers() called outside a Next.js request context.");',
          "}",
        ].join("\n"),
        loader: "js",
      }));
    },
  };
}

/**
 * Prefer TRIGGER_PROJECT_REF from the local/CI env. Fall back to the provisioned
 * project ref so Trigger.dev's native/remote image build (which re-evaluates this
 * file without .env.local) still succeeds. Override via env anytime the project moves.
 */
const DEFAULT_TRIGGER_PROJECT_REF = "proj_ojtplaiofdlhedbjckfm";
const projectRef = process.env.TRIGGER_PROJECT_REF?.trim() || DEFAULT_TRIGGER_PROJECT_REF;

export default defineConfig({
  project: projectRef,
  dirs: ["./trigger"],
  // Project default. Per-task overrides apply where needed (e.g. recommendation pipeline
  // sets maxDuration: 600 for multi-stage OpenAI work).
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
    // Without this plugin, `trigger.dev deploy` fails to bundle any task that
    // transitively imports injectable lib/ modules that start with "server-only".
    extensions: [esbuildPlugin(nextRuntimeStubPlugin(), { placement: "first" })],
  },
});
