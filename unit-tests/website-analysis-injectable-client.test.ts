import test from "node:test";
import assert from "node:assert/strict";
import { runWebsiteAnalysisForUser } from "../lib/website-analysis/service.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal fake Supabase client — only implements the one call chain
 * (`.from("business_profiles").select().eq().maybeSingle()`) that
 * runWebsiteAnalysisForUser needs before it reaches its first branch point. No real
 * network/database is touched.
 */
function createFakeClient(profileResult: { data: unknown; error: unknown }) {
  const fromCalls: string[] = [];

  const client = {
    from(table: string) {
      fromCalls.push(table);
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => profileResult,
              };
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, fromCalls };
}

test("runWebsiteAnalysisForUser runs to completion using an injected client, with no cookies and no request context", async () => {
  const { client, fromCalls } = createFakeClient({ data: null, error: null });

  // No website configured (or no profile at all) short-circuits to null before any
  // further table access -- this test runs under plain `node --test` with no Next.js
  // server, so if this still depended on cookies() internally it would throw the
  // test-stub's distinctive error (see the next test) instead of returning cleanly.
  const result = await runWebsiteAnalysisForUser("00000000-0000-0000-0000-000000000001", client);

  assert.equal(result, null);
  assert.deepEqual(fromCalls, ["business_profiles"]);
});

test("runWebsiteAnalysisForUser still defaults to the request-scoped client when no client is injected", async () => {
  // Proves the injectable-client change is additive: existing callers that pass no
  // client (the website-analysis API route, the background-job worker) still get
  // exactly the old behavior -- a real attempt to read the request's cookies.
  await assert.rejects(
    () => runWebsiteAnalysisForUser("00000000-0000-0000-0000-000000000001"),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});
