/**
 * Release-candidate audit: live RLS / tenant-isolation harness.
 *
 * Creates two throwaway auth users (never the real account), gives each a minimal
 * business_profiles row, then uses each user's own signed-in Supabase client (real
 * anon-key + JWT, no service-role bypass) to prove two things per table:
 *   1. the intended same-tenant action succeeds
 *   2. a cross-tenant read/write against the other tenant's row is blocked by RLS
 *
 * This is a standalone, one-off audit script -- not part of the app or the committed
 * test suite. Requires SUPABASE_SECRET_KEY (for user provisioning/cleanup only; all
 * actual assertions run against RLS-scoped clients, never the service-role client).
 *
 * Run with: node --experimental-strip-types scripts/audit/rls-tenant-isolation.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!URL || !ANON_KEY || !SECRET_KEY) {
  console.error("Missing required env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY)");
  process.exit(1);
}

const admin = createClient(URL, SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];
function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  -- ${detail}`);
}

async function createTestUser(label: string) {
  const email = `rc-audit-${label}-${randomUUID()}@ajnmarketing-audit.invalid`;
  const password = randomUUID() + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);

  const client = createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}) failed: ${signInError.message}`);

  return { userId: data.user.id, email, client };
}

async function main() {
  console.log("Provisioning two throwaway test tenants...");
  const A = await createTestUser("a");
  const B = await createTestUser("b");
  console.log(`Tenant A: ${A.userId}`);
  console.log(`Tenant B: ${B.userId}`);

  // --- business_profiles: same-tenant insert succeeds, is scoped by auth.uid() ---
  const { data: profileA, error: insA } = await A.client
    .from("business_profiles")
    .insert({ user_id: A.userId, business_name: "RC Audit Tenant A", onboarding_completed: true })
    .select("id")
    .single();
  record(
    "business_profiles: same-tenant insert succeeds",
    !insA && !!profileA,
    insA ? insA.message : `created ${profileA!.id}`
  );

  const { data: profileB, error: insB } = await B.client
    .from("business_profiles")
    .insert({ user_id: B.userId, business_name: "RC Audit Tenant B", onboarding_completed: true })
    .select("id")
    .single();
  record(
    "business_profiles: same-tenant insert succeeds (tenant B)",
    !insB && !!profileB,
    insB ? insB.message : `created ${profileB!.id}`
  );

  if (!profileA || !profileB) {
    console.error("Cannot continue without both profiles; aborting.");
    process.exit(1);
  }

  // --- business_profiles: cross-tenant read is blocked ---
  const { data: crossReadProfile } = await B.client
    .from("business_profiles")
    .select("id")
    .eq("id", profileA.id);
  record(
    "business_profiles: tenant B cannot read tenant A's profile",
    (crossReadProfile ?? []).length === 0,
    `rows returned: ${(crossReadProfile ?? []).length}`
  );

  // --- business_profiles: cross-tenant update is blocked (no rows affected) ---
  const { data: crossUpdateProfile } = await B.client
    .from("business_profiles")
    .update({ business_name: "hijacked" })
    .eq("id", profileA.id)
    .select("id");
  record(
    "business_profiles: tenant B cannot update tenant A's profile",
    (crossUpdateProfile ?? []).length === 0,
    `rows affected: ${(crossUpdateProfile ?? []).length}`
  );

  // --- marketing_opportunities: seed one for A via admin, then test B's read ---
  const { data: oppA, error: oppInsErr } = await admin
    .from("marketing_opportunities")
    .insert({
      user_id: A.userId,
      business_profile_id: profileA.id,
      category: "missing_business_info",
      severity: "medium",
      confidence: 80,
      title: "RC audit seed opportunity",
      description: "seeded by rls-tenant-isolation.ts",
      recommended_action: "n/a",
      evidence: {},
      dedupe_key: "current",
      status: "open",
    })
    .select("id")
    .single();
  if (oppInsErr || !oppA) {
    record("marketing_opportunities: seed for tenant A", false, oppInsErr?.message ?? "no row returned");
  } else {
    const { data: crossOpp } = await B.client.from("marketing_opportunities").select("id").eq("id", oppA.id);
    record(
      "marketing_opportunities: tenant B cannot read tenant A's opportunity",
      (crossOpp ?? []).length === 0,
      `rows returned: ${(crossOpp ?? []).length}`
    );
    const { data: ownOpp } = await A.client.from("marketing_opportunities").select("id").eq("id", oppA.id);
    record(
      "marketing_opportunities: tenant A can read own opportunity",
      (ownOpp ?? []).length === 1,
      `rows returned: ${(ownOpp ?? []).length}`
    );
  }

  // --- marketing_recommendations: seed one for A, test B's read + draft-generation ownership ---
  const { data: recA, error: recInsErr } = await admin
    .from("marketing_recommendations")
    .insert({
      user_id: A.userId,
      business_profile_id: profileA.id,
      recommended_action_type: "create_timely_content",
      priority_score: 80,
      urgency: "high",
      business_impact: "medium",
      estimated_effort: "medium",
      confidence: 80,
      reasoning: "seeded by rls-tenant-isolation.ts",
      related_opportunity_ids: oppA ? [oppA.id] : [],
      dedupe_key: "rc-audit-seed",
      status: "open",
    })
    .select("id")
    .single();
  if (recInsErr || !recA) {
    record("marketing_recommendations: seed for tenant A", false, recInsErr?.message ?? "no row returned");
  } else {
    const { data: crossRec } = await B.client.from("marketing_recommendations").select("id").eq("id", recA.id);
    record(
      "marketing_recommendations: tenant B cannot read tenant A's recommendation",
      (crossRec ?? []).length === 0,
      `rows returned: ${(crossRec ?? []).length}`
    );

    // Cross-tenant draft generation attempt via the real injectable core function.
    const { generateContentDraftForRecommendation } = await import(
      "../../lib/marketing-decisions/create-content.ts"
    );
    const draftResult = await generateContentDraftForRecommendation(
      B.userId,
      recA.id,
      B.client as unknown as SupabaseClient
    );
    record(
      "create-content: tenant B cannot generate a draft from tenant A's recommendation",
      draftResult.result === null && typeof draftResult.error === "string",
      `result=${JSON.stringify(draftResult.result)} error=${draftResult.error}`
    );
  }

  // --- content_approvals: seed one for A, test B's read ---
  const { data: caA, error: caInsErr } = await admin
    .from("content_approvals")
    .insert({
      user_id: A.userId,
      business_profile_id: profileA.id,
      content_type: "Community Post",
      title: "RC audit seed draft",
      content: "seeded by rls-tenant-isolation.ts",
      status: "pending",
      source: "marketing_recommendation",
      version: 1,
    })
    .select("id")
    .single();
  if (caInsErr || !caA) {
    record("content_approvals: seed for tenant A", false, caInsErr?.message ?? "no row returned");
  } else {
    const { data: crossCa } = await B.client.from("content_approvals").select("id").eq("id", caA.id);
    record(
      "content_approvals: tenant B cannot read tenant A's approval",
      (crossCa ?? []).length === 0,
      `rows returned: ${(crossCa ?? []).length}`
    );

    // --- publishing_queue: seed one for A off that approval, test B's read ---
    const { data: pqA, error: pqInsErr } = await admin
      .from("publishing_queue")
      .insert({
        user_id: A.userId,
        business_profile_id: profileA.id,
        content_approval_id: caA.id,
        platform: "google_business_profile",
        title: "RC audit seed queue item",
        content: "seeded by rls-tenant-isolation.ts",
        status: "ready",
      })
      .select("id")
      .single();
    if (pqInsErr || !pqA) {
      record("publishing_queue: seed for tenant A", false, pqInsErr?.message ?? "no row returned");
    } else {
      const { data: crossPq } = await B.client.from("publishing_queue").select("id").eq("id", pqA.id);
      record(
        "publishing_queue: tenant B cannot read tenant A's queue item",
        (crossPq ?? []).length === 0,
        `rows returned: ${(crossPq ?? []).length}`
      );
    }
  }

  // --- unauthenticated (anon, no session) access check ---
  const anon = createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: anonRead } = await anon.from("business_profiles").select("id").eq("id", profileA.id);
  record(
    "business_profiles: unauthenticated client cannot read any profile",
    (anonRead ?? []).length === 0,
    `rows returned: ${(anonRead ?? []).length}`
  );

  // --- cleanup: delete everything created by this script ---
  console.log("\nCleaning up seeded rows and throwaway users...");
  await admin.from("publishing_queue").delete().eq("user_id", A.userId);
  await admin.from("content_approvals").delete().eq("user_id", A.userId);
  await admin.from("marketing_recommendations").delete().eq("user_id", A.userId);
  await admin.from("marketing_opportunities").delete().eq("user_id", A.userId);
  await admin.from("business_profiles").delete().eq("user_id", A.userId);
  await admin.from("business_profiles").delete().eq("user_id", B.userId);
  await admin.auth.admin.deleteUser(A.userId);
  await admin.auth.admin.deleteUser(B.userId);
  console.log("Cleanup complete.");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
