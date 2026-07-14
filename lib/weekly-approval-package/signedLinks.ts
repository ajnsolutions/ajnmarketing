import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type {
  WeeklyPackageSignedLinkPayload,
  WeeklyPackageSignedLinkPurpose,
} from "@/lib/weekly-approval-package/types";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class WeeklyPackageLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyPackageLinkError";
  }
}

function resolveSigningSecret(): string {
  const dedicated = process.env.WEEKLY_APPROVAL_LINK_SECRET?.trim();
  if (dedicated) return dedicated;

  const fallback = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (fallback) return fallback;

  throw new WeeklyPackageLinkError(
    "Weekly approval link signing is not configured. Set WEEKLY_APPROVAL_LINK_SECRET or TOKEN_ENCRYPTION_KEY."
  );
}

function toBase64Url(value: Buffer | string): string {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function signPayload(encodedPayload: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(encodedPayload).digest());
}

/**
 * Create an HMAC-signed, time-limited token scoped to a tenant. Tokens are not
 * encrypted (payload is readable) — integrity + expiry + tenant binding are the
 * security properties. Never treat the token alone as proof of session auth;
 * the open route still requires a matching signed-in user before redirecting.
 */
export function createWeeklyPackageSignedToken(input: {
  purpose: WeeklyPackageSignedLinkPurpose;
  userId: string;
  businessProfileId: string;
  itemId?: string;
  ttlSeconds?: number;
  now?: Date;
}): string {
  if (!input.userId.trim() || !input.businessProfileId.trim()) {
    throw new WeeklyPackageLinkError("userId and businessProfileId are required for signed links.");
  }

  const now = input.now ?? new Date();
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const payload: WeeklyPackageSignedLinkPayload = {
    v: 1,
    purpose: input.purpose,
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    exp: Math.floor(now.getTime() / 1000) + ttl,
  };
  if (input.itemId) payload.itemId = input.itemId;

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, resolveSigningSecret());
  return `${encodedPayload}.${signature}`;
}

export function verifyWeeklyPackageSignedToken(
  token: string,
  now: Date = new Date()
): WeeklyPackageSignedLinkPayload {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new WeeklyPackageLinkError("Invalid approval link.");
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload, resolveSigningSecret());

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new WeeklyPackageLinkError("Invalid or forged approval link.");
  }

  let payload: WeeklyPackageSignedLinkPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as WeeklyPackageSignedLinkPayload;
  } catch {
    throw new WeeklyPackageLinkError("Invalid approval link payload.");
  }

  if (payload.v !== 1 || !payload.userId || !payload.businessProfileId || !payload.purpose) {
    throw new WeeklyPackageLinkError("Invalid approval link payload.");
  }

  const allowedPurposes: WeeklyPackageSignedLinkPurpose[] = [
    "approve_all",
    "review_item",
    "approval_center",
  ];
  if (!allowedPurposes.includes(payload.purpose)) {
    throw new WeeklyPackageLinkError("Invalid approval link purpose.");
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 < now.getTime()) {
    throw new WeeklyPackageLinkError("This approval link has expired.");
  }

  return payload;
}

export function buildWeeklyPackageOpenPath(token: string): string {
  return `/api/weekly-approval-package/open?token=${encodeURIComponent(token)}`;
}

export function buildWeeklyPackageAbsoluteUrl(baseUrl: string, token: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  return `${origin}${buildWeeklyPackageOpenPath(token)}`;
}

/**
 * Map a verified signed-link payload to the existing in-app review surface.
 * Never approves or publishes — redirect only.
 *
 * Item ids use a kind prefix (`approval:<id>` / `review:<id>`); destinations
 * strip the prefix so UI focus can match raw row ids.
 */
export function resolveApprovalCenterRedirect(
  payload: WeeklyPackageSignedLinkPayload
): string {
  if (payload.purpose === "approve_all") {
    return "/dashboard/approvals?view=pending";
  }

  if (payload.purpose === "review_item" && payload.itemId) {
    const separatorIndex = payload.itemId.indexOf(":");
    const kind = separatorIndex >= 0 ? payload.itemId.slice(0, separatorIndex) : "";
    const rawId = separatorIndex >= 0 ? payload.itemId.slice(separatorIndex + 1) : "";

    if (kind === "review" && rawId) {
      return `/dashboard/reviews?focus=${encodeURIComponent(rawId)}`;
    }
    if (kind === "approval" && rawId) {
      return `/dashboard/approvals?focus=${encodeURIComponent(rawId)}&view=pending`;
    }
  }

  return "/dashboard/approvals";
}

export function resolveWeeklyPackageBaseUrl(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/+$/, "");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
