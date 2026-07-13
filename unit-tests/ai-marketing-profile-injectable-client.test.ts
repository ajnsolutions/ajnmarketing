import test from "node:test";
import assert from "node:assert/strict";
import { generateAiMarketingProfileForUser } from "../lib/ai-marketing-profile/service.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal fake Supabase client — only implements the one call chain
 * (`.from("business_profiles").select().eq().maybeSingle()`) that
 * generateAiMarketingProfileForUser needs before it reaches its first branch point. No
 * real network/database is touched.
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

test("generateAiMarketingProfileForUser runs to completion using an injected client, with no cookies and no request context", async () => {
  const { client, fromCalls } = createFakeClient({ data: null, error: null });

  // No business profile short-circuits before any further table access -- this test
  // runs under plain `node --test` with no Next.js server, so if this still depended on
  // cookies() internally it would throw the test-stub's distinctive error (see the next
  // test) instead of returning cleanly.
  const result = await generateAiMarketingProfileForUser("00000000-0000-0000-0000-000000000001", client);

  assert.deepEqual(result, { profile: null, error: "Business profile not found." });
  assert.deepEqual(fromCalls, ["business_profiles"]);
});

test("generateAiMarketingProfileForUser still defaults to the request-scoped client when no client is injected", async () => {
  // Proves the injectable-client change is additive: the existing caller
  // (the AI marketing profile API route) still gets exactly the old behavior -- a real
  // attempt to read the request's cookies.
  await assert.rejects(
    () => generateAiMarketingProfileForUser("00000000-0000-0000-0000-000000000001"),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});
