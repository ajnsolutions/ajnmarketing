// Node's test runner loads project files directly (no Next.js bundler), so three things
// Next.js normally handles for us are missing:
//   1. The build-time-only "server-only" package, which isn't a real installed module.
//   2. The "@/*" -> "./*" path alias from tsconfig.json.
//   3. "next/headers" — outside Next's own runtime this fails to resolve at all
//      (ERR_MODULE_NOT_FOUND), because it depends on Next's server-only export
//      conditions. Real Next.js only throws when cookies()/headers() are *called*
//      outside a request context, not on import — this stub mirrors that: import
//      succeeds, invocation throws a clear, distinctive error. This lets tests prove
//      that a code path avoiding these calls (an injected Supabase client) works with
//      no request context at all, while a code path that still relies on them fails
//      exactly as it would in production outside a request.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = new URL("../../", import.meta.url);
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "server-only:noop", shortCircuit: true };
  }

  if (specifier === "next/headers") {
    return { url: "next-headers:noop", shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), PROJECT_ROOT).href;

    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = `${base}${suffix}`;
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context);
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === "server-only:noop") {
    return { format: "module", source: "export {};", shortCircuit: true };
  }

  if (url === "next-headers:noop") {
    const source = [
      "export function cookies() {",
      '  throw new Error("[test-stub] next/headers.cookies() called outside a Next.js request context");',
      "}",
      "export function headers() {",
      '  throw new Error("[test-stub] next/headers.headers() called outside a Next.js request context");',
      "}",
    ].join("\n");
    return { format: "module", source, shortCircuit: true };
  }

  return nextLoad(url, context);
}
