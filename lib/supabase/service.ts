import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * TRUST BOUNDARY
 * ==============
 * This client authenticates with the Supabase project's privileged secret key and
 * bypasses Row Level Security entirely. It must only be used by code that is NOT acting
 * on behalf of a specific signed-in user's own request — i.e. scheduled/background
 * execution that legitimately needs to operate across tenants (a cron sweep, a
 * Trigger.dev task enumerating "all businesses due for X").
 *
 * Every normal user-facing request path (Server Components, Route Handlers reached by
 * the browser, Server Actions) must keep using `lib/supabase/server.ts`'s cookie-scoped
 * `createClient()`, which is bound to that one user's own RLS-limited session. Do not
 * use this client to answer a request initiated by a user, and do not thread its result
 * into any code path that renders a response back to that user — any code that needs to
 * distinguish "the current user's data" from "everyone's data" should use the request-
 * scoped client, not this one.
 *
 * This module is marked "server-only": importing it from a Client Component or any
 * module that ends up in the browser bundle fails the build (verified in the PR that
 * introduced this file).
 */

export class SupabaseServiceRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseServiceRoleError";
  }
}

const SUPABASE_SECRET_KEY_HELP =
  "Set SUPABASE_SECRET_KEY in your server environment only (Supabase Dashboard -> Project Settings -> API -> service_role key, or the newer sb_secret_* key). Never set this as NEXT_PUBLIC_SUPABASE_SECRET_KEY or expose it to the browser.";

export function isSupabaseServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
}

/**
 * Creates a Supabase client authenticated with the project's privileged secret key.
 * Supports both the legacy `service_role` JWT and the newer `sb_secret_*` key format —
 * both are opaque bearer credentials as far as this client is concerned; Supabase
 * determines the resulting Postgres role server-side from whichever key is presented.
 *
 * Throws `SupabaseServiceRoleError` immediately (never returns a partially-configured or
 * silently-anonymous client) if the required environment variables are missing.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) {
    throw new SupabaseServiceRoleError(
      "NEXT_PUBLIC_SUPABASE_URL is not configured. The privileged client reuses the same project URL as the public client."
    );
  }

  if (!secretKey) {
    throw new SupabaseServiceRoleError(
      `SUPABASE_SECRET_KEY is not configured. ${SUPABASE_SECRET_KEY_HELP}`
    );
  }

  return createClient(url, secretKey, {
    auth: {
      // This client never represents an end user; it has no session to persist or refresh.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
