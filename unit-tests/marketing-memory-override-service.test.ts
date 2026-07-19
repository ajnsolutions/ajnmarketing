import test from "node:test";
import assert from "node:assert/strict";
import { recordOverrideForBusiness } from "../lib/marketing-memory/overrideService.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

test("recordOverrideForBusiness: rejects invalid body", async () => {
  const { client } = createFakeSupabaseClient({});
  const result = await recordOverrideForBusiness(USER, BIZ, { overrideType: "nope" }, {
    supabaseClient: client,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("recordOverrideForBusiness: permanent disabled_context_factor promotes a preference", async () => {
  const overrideRow = {
    id: "ovr-1",
    user_id: USER,
    business_profile_id: BIZ,
    decision_link_id: null,
    override_type: "disabled_context_factor",
    related_learning_id: null,
    factor_type: "political_civic",
    factor_value: "disable",
    is_permanent: true,
    promoted_to_preference_id: null,
    notes: null,
    created_by: USER,
    idempotency_key: "ovr:key",
    created_at: "2026-07-18T00:00:00Z",
  };

  const preferenceRow = {
    id: "pref-1",
    user_id: USER,
    business_profile_id: BIZ,
    preference_type: "context_category_toggle",
    factor_type: "political_civic",
    factor_value: "disable",
    instruction_text: "Don't use political_civic events as marketing context.",
    is_active: true,
    active_until: null,
    source: "promoted_override",
    promoted_from_override_id: "ovr-1",
    supersedes_preference_id: null,
    created_by: USER,
    updated_by: USER,
    schema_version: 1,
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
  };

  let preferenceLookups = 0;
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_overrides: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: overrideRow, error: null };
      // promotion link update
      if (op === "maybeSingle" || op === "single") return { data: { ...overrideRow, promoted_to_preference_id: "pref-1" }, error: null };
      return { data: { ...overrideRow, promoted_to_preference_id: "pref-1" }, error: null };
    },
    marketing_memory_preferences: (op) => {
      if (op === "maybeSingle") {
        preferenceLookups += 1;
        return { data: null, error: null };
      }
      if (op === "single") return { data: preferenceRow, error: null };
      return { data: preferenceRow, error: null };
    },
  });

  const result = await recordOverrideForBusiness(
    USER,
    BIZ,
    {
      overrideType: "disabled_context_factor",
      factorType: "political_civic",
      isPermanent: true,
      clientRequestId: "gesture-1",
    },
    { supabaseClient: client, actorUserId: USER }
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.override.id, "ovr-1");
    assert.equal(result.value.preference?.id, "pref-1");
    assert.equal(result.value.preference?.source, "promoted_override");
  }
  assert.ok(userIdsQueried(calls).every((id) => id === USER));
  assert.ok(preferenceLookups >= 1);
  assert.ok(calls.some((call) => call.table === "marketing_memory_overrides" && call.op === "insert"));
  assert.ok(calls.some((call) => call.table === "marketing_memory_preferences" && call.op === "insert"));
});

test("recordOverrideForBusiness: marked_learning_incorrect writes contradicting evidence link", async () => {
  const overrideRow = {
    id: "ovr-2",
    user_id: USER,
    business_profile_id: BIZ,
    decision_link_id: null,
    override_type: "marked_learning_incorrect",
    related_learning_id: "learn-1",
    factor_type: null,
    factor_value: null,
    is_permanent: false,
    promoted_to_preference_id: null,
    notes: "Not true for us",
    created_by: USER,
    idempotency_key: "ovr:key2",
    created_at: "2026-07-18T00:00:00Z",
  };

  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_overrides: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      return { data: overrideRow, error: null };
    },
    marketing_memory_evidence_links: { data: null, error: null },
  });

  const result = await recordOverrideForBusiness(
    USER,
    BIZ,
    {
      overrideType: "marked_learning_incorrect",
      relatedLearningId: "learn-1",
      notes: "Not true for us",
      clientRequestId: "gesture-2",
    },
    { supabaseClient: client }
  );

  assert.equal(result.ok, true);
  assert.ok(
    calls.some(
      (call) =>
        call.table === "marketing_memory_evidence_links" &&
        call.op === "upsert" &&
        (call.args[0] as { contribution: string }).contribution === "contradicting"
    )
  );
});
