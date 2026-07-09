// Node's test runner loads project files directly (no Next.js bundler), so two things
// Next.js normally handles for us are missing:
//   1. The build-time-only "server-only" package, which isn't a real installed module.
//   2. The "@/*" -> "./*" path alias from tsconfig.json.
// This loader hook stubs the former and resolves the latter against the project root.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = new URL("../../", import.meta.url);
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "server-only:noop", shortCircuit: true };
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
  return nextLoad(url, context);
}
