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
    marketing_memory_learnings: { data: { id: "learn-1" }, error: null },
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

test("recordOverrideForBusiness: rejects a relatedLearningId that does not belong to this business (cross-tenant reference)", async () => {
  const { client, calls } = createFakeSupabaseClient({
    // No matching learning row for this user/business -> learningBelongsToBusiness
    // returns false, matching the fake client's default {data: null} for any table
    // without a configured fixture.
    marketing_memory_learnings: { data: null, error: null },
  });

  const result = await recordOverrideForBusiness(
    USER,
    BIZ,
    {
      overrideType: "marked_learning_incorrect",
      relatedLearningId: "someone-elses-learning",
      notes: "Not true for us",
    },
    { supabaseClient: client }
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
  // Never reaches the insert -- the ownership check runs before insertOverride.
  assert.equal(calls.some((call) => call.table === "marketing_memory_overrides" && call.op === "insert"), false);
});

test("recordOverrideForBusiness: the ownership check for relatedLearningId is scoped to this user and business", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_learnings: { data: { id: "learn-1" }, error: null },
    marketing_memory_overrides: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      return {
        data: {
          id: "ovr-3",
          user_id: USER,
          business_profile_id: BIZ,
          decision_link_id: null,
          override_type: "marked_learning_incorrect",
          related_learning_id: "learn-1",
          factor_type: null,
          factor_value: null,
          is_permanent: false,
          promoted_to_preference_id: null,
          notes: null,
          created_by: USER,
          idempotency_key: "ovr:key3",
          created_at: "2026-07-18T00:00:00Z",
        },
        error: null,
      };
    },
    marketing_memory_evidence_links: { data: null, error: null },
  });

  await recordOverrideForBusiness(
    USER,
    BIZ,
    { overrideType: "marked_learning_incorrect", relatedLearningId: "learn-1" },
    { supabaseClient: client }
  );

  const learningLookup = calls.find((call) => call.table === "marketing_memory_learnings" && call.op === "eq" && call.args[0] === "business_profile_id");
  assert.ok(learningLookup, "expected the learning ownership check to filter by business_profile_id");
  assert.ok(userIdsQueried(calls).every((id) => id === USER));
});

test("recordOverrideForBusiness: a promotion-link failure never invents a false link, and the preference is still returned", async () => {
  const overrideRow = {
    id: "ovr-4",
    user_id: USER,
    business_profile_id: BIZ,
    decision_link_id: null,
    override_type: "disabled_context_factor",
    related_learning_id: null,
    factor_type: "sports_entertainment",
    factor_value: "disable",
    is_permanent: true,
    promoted_to_preference_id: null,
    notes: null,
    created_by: USER,
    idempotency_key: "ovr:key4",
    created_at: "2026-07-18T00:00:00Z",
  };

  const preferenceRow = {
    id: "pref-4",
    user_id: USER,
    business_profile_id: BIZ,
    preference_type: "context_category_toggle",
    factor_type: "sports_entertainment",
    factor_value: "disable",
    instruction_text: "Don't use sports_entertainment events as marketing context.",
    is_active: true,
    active_until: null,
    source: "promoted_override",
    promoted_from_override_id: "ovr-4",
    supersedes_preference_id: null,
    created_by: USER,
    updated_by: USER,
    schema_version: 1,
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
  };

  const { client } = createFakeSupabaseClient({
    marketing_memory_overrides: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      if (op === "single") return { data: overrideRow, error: null };
      // The promotion-link UPDATE resolves via the thenable ("then") path, not
      // single/maybeSingle -- force it to fail so the fallback path is exercised.
      return { data: null, error: { message: "update denied" } };
    },
    marketing_memory_preferences: (op) => {
      if (op === "maybeSingle") return { data: null, error: null };
      return { data: preferenceRow, error: null };
    },
  });

  const result = await recordOverrideForBusiness(
    USER,
    BIZ,
    { overrideType: "disabled_context_factor", factorType: "sports_entertainment", isPermanent: true },
    { supabaseClient: client }
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    // Honest reporting: the preference was created, but the override's own forward
    // link genuinely was not written -- the response must not claim otherwise.
    assert.equal(result.value.preference?.id, "pref-4");
    assert.equal(result.value.override.promoted_to_preference_id, null);
  }
});
