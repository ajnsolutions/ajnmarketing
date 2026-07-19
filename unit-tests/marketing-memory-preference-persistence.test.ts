import test from "node:test";
import assert from "node:assert/strict";
import {
  findActivePreferenceByIdentity,
  listPreferencesForBusiness,
  upsertPreferenceWithSupersession,
} from "../lib/marketing-memory/preferencePersistence.ts";
import { PreferenceTypes } from "../lib/marketing-memory/preferenceTypes.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

test("listPreferencesForBusiness: always scopes by user_id", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_preferences: { data: [], error: null },
  });

  await listPreferencesForBusiness(client, USER, BIZ, { activeOnly: true });
  assert.deepEqual(userIdsQueried(calls), [USER]);
  assert.ok(calls.some((call) => call.op === "eq" && call.args[0] === "is_active" && call.args[1] === true));
});

test("findActivePreferenceByIdentity: scopes by user_id and uses is() for null factors", async () => {
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_preferences: { data: null, error: null },
  });

  await findActivePreferenceByIdentity(
    client,
    USER,
    BIZ,
    PreferenceTypes.APPROVAL_REQUIREMENT,
    null,
    null
  );

  assert.deepEqual(userIdsQueried(calls), [USER]);
  assert.ok(calls.some((call) => call.op === "is" && call.args[0] === "factor_type"));
  assert.ok(calls.some((call) => call.op === "is" && call.args[0] === "factor_value"));
});

test("upsertPreferenceWithSupersession: identical active preference is idempotent", async () => {
  const existing = {
    id: "pref-1",
    user_id: USER,
    business_profile_id: BIZ,
    preference_type: "publishing_day_restriction",
    factor_type: "day_of_week",
    factor_value: "sunday",
    instruction_text: "Avoid publishing on sundays.",
    is_active: true,
    active_until: null,
    source: "explicit_statement",
    promoted_from_override_id: null,
    supersedes_preference_id: null,
    created_by: USER,
    updated_by: USER,
    schema_version: 1,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };

  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_preferences: {
      data: existing,
      error: null,
    },
  });

  const result = await upsertPreferenceWithSupersession(client, {
    userId: USER,
    businessProfileId: BIZ,
    actorUserId: USER,
    input: {
      preferenceType: "publishing_day_restriction",
      factorType: "day_of_week",
      factorValue: "sunday",
      instructionText: "Avoid publishing on sundays.",
    },
  });

  assert.equal(result.preference?.id, "pref-1");
  assert.equal(result.supersededId, null);
  assert.ok(!calls.some((call) => call.op === "insert"));
  assert.ok(!calls.some((call) => call.op === "update"));
});

test("upsertPreferenceWithSupersession: changed instruction soft-supersedes prior row", async () => {
  const existing = {
    id: "pref-old",
    user_id: USER,
    business_profile_id: BIZ,
    preference_type: "context_category_toggle",
    factor_type: "weather",
    factor_value: "disable",
    instruction_text: "Old wording",
    is_active: true,
    active_until: null,
    source: "explicit_statement",
    promoted_from_override_id: null,
    supersedes_preference_id: null,
    created_by: USER,
    updated_by: USER,
    schema_version: 1,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };

  const created = {
    ...existing,
    id: "pref-new",
    instruction_text: "Don't use weather events as marketing context.",
    supersedes_preference_id: "pref-old",
  };

  let stage = 0;
  const { client, calls } = createFakeSupabaseClient({
    marketing_memory_preferences: (op) => {
      if (op === "maybeSingle") {
        stage += 1;
        if (stage === 1) return { data: existing, error: null };
        if (stage === 2) return { data: { ...existing, is_active: false }, error: null };
        return { data: null, error: null };
      }
      if (op === "single") return { data: created, error: null };
      return { data: null, error: null };
    },
  });

  const result = await upsertPreferenceWithSupersession(client, {
    userId: USER,
    businessProfileId: BIZ,
    actorUserId: USER,
    input: {
      preferenceType: "context_category_toggle",
      factorType: "weather",
      factorValue: "disable",
      instructionText: "Don't use weather events as marketing context.",
    },
  });

  assert.equal(result.supersededId, "pref-old");
  assert.equal(result.preference?.id, "pref-new");
  assert.ok(calls.some((call) => call.op === "update"));
  assert.ok(calls.some((call) => call.op === "insert"));
});
