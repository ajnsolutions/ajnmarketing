import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
  SupabaseServiceRoleError,
} from "../lib/supabase/service.ts";

const SERVICE_MODULE_PATH = new URL("../lib/supabase/service.ts", import.meta.url);

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  }
}

test("lib/supabase/service.ts declares itself server-only (guards against accidental client-bundle import)", () => {
  const source = readFileSync(SERVICE_MODULE_PATH, "utf8");
  const firstStatement = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  assert.equal(firstStatement, 'import "server-only";');
});

test("isSupabaseServiceRoleConfigured reflects whether SUPABASE_SECRET_KEY is set", () => {
  withEnv({ SUPABASE_SECRET_KEY: undefined }, () => {
    assert.equal(isSupabaseServiceRoleConfigured(), false);
  });

  withEnv({ SUPABASE_SECRET_KEY: "sb_secret_test_value" }, () => {
    assert.equal(isSupabaseServiceRoleConfigured(), true);
  });
});

test("createServiceRoleClient throws a clear SupabaseServiceRoleError when SUPABASE_SECRET_KEY is missing", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: undefined,
    },
    () => {
      assert.throws(
        () => createServiceRoleClient(),
        (error) => {
          assert.ok(error instanceof SupabaseServiceRoleError);
          assert.match(error.message, /SUPABASE_SECRET_KEY is not configured/);
          return true;
        }
      );
    }
  );
});

test("createServiceRoleClient throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    },
    () => {
      assert.throws(
        () => createServiceRoleClient(),
        (error) => {
          assert.ok(error instanceof SupabaseServiceRoleError);
          assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL is not configured/);
          return true;
        }
      );
    }
  );
});

test("createServiceRoleClient does NOT fall back to a NEXT_PUBLIC_*-prefixed secret variable", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: undefined,
      // Simulates someone mistakenly exposing the secret as a public var — this must
      // never be read by the privileged client.
      NEXT_PUBLIC_SUPABASE_SECRET_KEY: "sb_secret_should_never_be_read",
    },
    () => {
      assert.throws(() => createServiceRoleClient(), SupabaseServiceRoleError);
    }
  );
});

test("createServiceRoleClient succeeds (no network call) given both required env vars, for both legacy JWT and sb_secret_* formats", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_fake_key_for_unit_test",
    },
    () => {
      const client = createServiceRoleClient();
      assert.ok(client);
      assert.equal(typeof client.from, "function");
    }
  );

  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fake-signature-for-test-only",
    },
    () => {
      const client = createServiceRoleClient();
      assert.ok(client);
      assert.equal(typeof client.from, "function");
    }
  );
});
