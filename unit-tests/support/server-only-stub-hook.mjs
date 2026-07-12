// Node's test runner loads project files directly (no Next.js bundler), so four things
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
//   4. "next/server" — same resolution problem as next/headers (its package.json export
//      map only resolves under Next's own bundler conditions). Route handlers only need
//      NextResponse.json() out of it, which is a thin, well-defined wrapper around the
//      standard Response constructor, so it's stubbed with an equivalent implementation
//      rather than skipped -- this lets a route handler's POST/GET function be imported
//      and invoked directly against a real Request in a plain node:test file.
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

  if (specifier === "next/server") {
    return { url: "next-server:noop", shortCircuit: true };
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

  if (url === "next-server:noop") {
    const source = [
      "export class NextResponse extends Response {",
      "  static json(body, init) {",
      "    const headers = new Headers(init?.headers);",
      '    if (!headers.has("content-type")) headers.set("content-type", "application/json");',
      "    return new NextResponse(JSON.stringify(body), { ...init, headers });",
      "  }",
      "}",
    ].join("\n");
    return { format: "module", source, shortCircuit: true };
  }

  return nextLoad(url, context);
}
