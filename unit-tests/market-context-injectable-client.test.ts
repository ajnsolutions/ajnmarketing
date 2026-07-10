import test from "node:test";
import assert from "node:assert/strict";
import { generateWeeklyMarketContextBrief } from "../lib/market-context/marketContextService.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal fake Supabase client — only implements the one call chain
 * (`.from("business_profiles").select().eq().maybeSingle()`) that
 * generateWeeklyMarketContextBrief needs before it reaches its first branch point.
 * No real network/database is touched, and no cross-tenant data is read or mutated.
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

test("generateWeeklyMarketContextBrief runs to completion using an injected client, with no cookies and no request context", async () => {
  const { client, fromCalls } = createFakeClient({ data: null, error: null });

  // This test runs under plain `node --test` — there is no Next.js server, no HTTP
  // request, and no browser session anywhere in this process. If this function still
  // depended on cookies()/next-headers internally, it would throw the test-stub's
  // distinctive error (see the next test) instead of returning a normal result.
  const result = await generateWeeklyMarketContextBrief({
    userId: "00000000-0000-0000-0000-000000000001",
    businessProfileId: "00000000-0000-0000-0000-000000000002",
    supabaseClient: client,
  });

  assert.deepEqual(result, {
    briefWithItems: null,
    error: "Business profile not found. Complete onboarding first.",
  });
  assert.deepEqual(fromCalls, ["business_profiles"]);
});

test("generateWeeklyMarketContextBrief still defaults to the request-scoped client when no client is injected", async () => {
  // Proves the injectable-client change is additive: existing callers that pass no
  // client (the current-user API route, refreshMarketContextBriefForCurrentUser) still
  // get exactly the old behavior — a real attempt to read the request's cookies. Outside
  // a real request (as here), that now fails with our test stub's distinctive error
  // instead of silently succeeding some other way.
  await assert.rejects(
    () =>
      generateWeeklyMarketContextBrief({
        userId: "00000000-0000-0000-0000-000000000001",
        businessProfileId: "00000000-0000-0000-0000-000000000002",
      }),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});
