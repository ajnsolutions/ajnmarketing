import "server-only";

/**
 * Minimal admin allowlist for internal debugging tools (e.g. the manual Trigger.dev
 * capture endpoint). This is NOT a general-purpose role system — there is no `role` or
 * `is_admin` column anywhere in this schema today, and this file deliberately doesn't
 * invent one. It exists only to gate a small number of privileged, developer-facing
 * routes behind an explicit, env-configured list of user ids.
 */

function parseAdminUserIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/**
 * True if the given Supabase auth user id is in the ADMIN_USER_IDS allowlist.
 * Accepts an optional raw override (comma-separated ids) for testing; defaults to
 * reading process.env.ADMIN_USER_IDS.
 */
export function isAdminUserId(userId: string, rawAllowlist = process.env.ADMIN_USER_IDS): boolean {
  if (!userId) return false;
  return parseAdminUserIds(rawAllowlist).has(userId);
}
