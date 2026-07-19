import type { SupabaseClient } from "@supabase/supabase-js";

export type FakeTableResponse = { data: unknown; error: unknown };

/**
 * A table's fixture can be a plain canned response (the common case — every terminal
 * call against that table resolves the same way), or a function of the terminal op name
 * ("maybeSingle" | "single" | "then") for tests that need a lookup call (maybeSingle) to
 * differ from a write's returned row (single) — e.g. an upsert that first SELECTs to
 * check for an existing row (found: null) and then must still return a real row from
 * the upsert itself. Real Supabase behaves this way; a single canned value per table
 * can't model it.
 */
export type FakeTableResponseFixture = FakeTableResponse | ((op: string) => FakeTableResponse);

export type RecordedCall = { table: string; op: string; args: unknown[] };

/**
 * Minimal fake Supabase client for unit tests. Records every `.from(table)` call and
 * chained query-builder operation (`.select()`, `.eq()`, `.order()`, etc.) so tests can
 * assert exactly which table was touched, with which filters (e.g. which userId), without
 * any real network or database access. Configure one canned response per table (or a
 * function for op-dependent responses — see FakeTableResponseFixture); both
 * `.maybeSingle()` and a plain `await` on the builder (array-style queries) resolve to
 * that same response by default — this fake does not model per-call-shape differences on
 * a single table beyond what a fixture function opts into.
 */
export function createFakeSupabaseClient(tableResponses: Record<string, FakeTableResponseFixture>) {
  const calls: RecordedCall[] = [];

  function response(table: string, op: string): FakeTableResponse {
    const fixture = tableResponses[table] ?? { data: null, error: null };
    return typeof fixture === "function" ? fixture(op) : fixture;
  }

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {
      select(...args: unknown[]) {
        calls.push({ table, op: "select", args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table, op: "eq", args });
        return builder;
      },
      is(...args: unknown[]) {
        calls.push({ table, op: "is", args });
        return builder;
      },
      in(...args: unknown[]) {
        calls.push({ table, op: "in", args });
        return builder;
      },
      gte(...args: unknown[]) {
        calls.push({ table, op: "gte", args });
        return builder;
      },
      lte(...args: unknown[]) {
        calls.push({ table, op: "lte", args });
        return builder;
      },
      lt(...args: unknown[]) {
        calls.push({ table, op: "lt", args });
        return builder;
      },
      order(...args: unknown[]) {
        calls.push({ table, op: "order", args });
        return builder;
      },
      limit(...args: unknown[]) {
        calls.push({ table, op: "limit", args });
        return builder;
      },
      upsert(...args: unknown[]) {
        calls.push({ table, op: "upsert", args });
        return builder;
      },
      insert(...args: unknown[]) {
        calls.push({ table, op: "insert", args });
        return builder;
      },
      update(...args: unknown[]) {
        calls.push({ table, op: "update", args });
        return builder;
      },
      maybeSingle: async () => {
        calls.push({ table, op: "maybeSingle", args: [] });
        return response(table, "maybeSingle");
      },
      single: async () => {
        calls.push({ table, op: "single", args: [] });
        return response(table, "single");
      },
      // Supabase's real query builder is "thenable" so `await query` works without an
      // explicit terminal method for array-returning queries — mirrored here.
      then(onFulfilled?: (value: FakeTableResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
        calls.push({ table, op: "then", args: [] });
        return Promise.resolve(response(table, "then")).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  const client = {
    from(table: string) {
      calls.push({ table, op: "from", args: [] });
      return makeBuilder(table);
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

/** Convenience: all userIds a fake client's `.eq("user_id", ...)` calls were made with. */
export function userIdsQueried(calls: RecordedCall[]): string[] {
  return calls
    .filter((call) => call.op === "eq" && call.args[0] === "user_id")
    .map((call) => call.args[1] as string);
}
