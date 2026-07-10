import type { Plugin } from "esbuild";

/**
 * Trigger.dev tasks run in a plain Node.js container built with esbuild — not inside
 * Next.js's own bundler (Turbopack/webpack). This codebase's server-side lib/ modules
 * universally start with `import "server-only"`, and a few (lib/supabase/server.ts,
 * lib/audit-log-server.ts) import `next/headers`. Neither resolves outside Next's own
 * build:
 *
 *   - "server-only" is never an installed package here — Next.js special-cases it
 *     internally and only "throws on import" when a bundler resolves it under a
 *     client-bundle condition. Plain esbuild has no knowledge of that convention at all
 *     and fails to resolve the bare specifier.
 *   - "next/headers" (the extensionless form every file in this repo uses) is not a
 *     literal file on disk and isn't in `next`'s package.json export map either — only
 *     Next's own bundler resolves it. Verified empirically: esbuild fails on both with
 *     "Could not resolve" before this plugin is added.
 *
 * This does NOT attempt to make next/headers actually work outside a request — the
 * injectable functions this task calls (captureSnapshotForUser, etc.) never invoke
 * cookies()/headers() when given an explicit client, so the stub only needs to satisfy
 * static import resolution. If a code path ever did call it, the stub throws a clear,
 * greppable error instead of doing something silently wrong — the same contract already
 * used by unit-tests/support/server-only-stub-hook.mjs for this repo's Node test runner.
 */
export function nextRuntimeStubPlugin(): Plugin {
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
