import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  CURRENT_EMAIL_ACTION_TOKEN_VERSION,
  EmailActionTypes,
  type EmailActionTokenPayload,
  type EmailActionType,
} from "@/lib/email-actions/types";

/**
 * Domain separation: mixed into every signature so an email-action token can never be
 * mistaken for (or replayed as) a weekly-approval-package "open" token, even if both
 * systems end up configured with the same underlying secret material. This is what
 * makes these two token families genuinely single-purpose rather than just
 * differently-shaped payloads sharing one signing key.
 */
const SIGNING_DOMAIN = "ajn-email-action-token-v1";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days -- matches the weekly cadence

export type EmailActionTokenErrorReason =
  | "invalid"
  | "expired"
  | "tampered"
  | "unsupported_version"
  | "not_configured";

export class EmailActionTokenError extends Error {
  reason: EmailActionTokenErrorReason;

  constructor(message: string, reason: EmailActionTokenErrorReason = "invalid") {
    super(message);
    this.name = "EmailActionTokenError";
    this.reason = reason;
  }
}

function resolveSigningSecret(): string {
  const dedicated = process.env.EMAIL_ACTION_TOKEN_SECRET?.trim();
  if (dedicated) return dedicated;

  // Falls back to the same chain the weekly-package "open" tokens use, so a fresh
  // deployment doesn't need a brand-new secret provisioned on day one -- but the
  // SIGNING_DOMAIN prefix above still keeps the two token families cryptographically
  // distinct even when they share this fallback secret.
  const weeklyPackageSecret = process.env.WEEKLY_APPROVAL_LINK_SECRET?.trim();
  if (weeklyPackageSecret) return weeklyPackageSecret;

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (encryptionKey) return encryptionKey;

  throw new EmailActionTokenError(
    "Email action token signing is not configured. Set EMAIL_ACTION_TOKEN_SECRET.",
    "not_configured"
  );
}

function toBase64Url(value: Buffer | string): string {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function signPayload(encodedPayload: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(`${SIGNING_DOMAIN}.${encodedPayload}`).digest());
}

export type CreateEmailActionTokenInput = {
  action: EmailActionType;
  userId: string;
  businessProfileId: string;
  emailRecipient: string;
  contentApprovalId?: string;
  contentApprovalIds?: string[];
  recommendationId?: string | null;
  ttlSeconds?: number;
  now?: Date;
};

/**
 * Mints a signed, time-limited, single-purpose action token. Never called with
 * client-supplied fields -- every input here originates server-side, at weekly-package
 * generation time, from data already validated to belong to this tenant.
 */
export function createEmailActionToken(input: CreateEmailActionTokenInput): string {
  if (!input.userId.trim() || !input.businessProfileId.trim()) {
    throw new EmailActionTokenError("userId and businessProfileId are required.");
  }
  if (!input.emailRecipient.trim()) {
    throw new EmailActionTokenError("emailRecipient is required.");
  }
  if (input.action === EmailActionTypes.APPROVE_ALL && !input.contentApprovalIds?.length) {
    throw new EmailActionTokenError("approve_all requires a non-empty contentApprovalIds snapshot.");
  }
  if (
    (input.action === EmailActionTypes.APPROVE || input.action === EmailActionTypes.REJECT) &&
    !input.contentApprovalId
  ) {
    throw new EmailActionTokenError(`${input.action} requires a contentApprovalId.`);
  }

  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const payload: EmailActionTokenPayload = {
    tokenVersion: CURRENT_EMAIL_ACTION_TOKEN_VERSION,
    action: input.action,
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    emailRecipient: input.emailRecipient,
    issuedAt,
    expiresAt: issuedAt + ttl,
    nonce: toBase64Url(randomBytes(16)),
    ...(input.contentApprovalId ? { contentApprovalId: input.contentApprovalId } : {}),
    ...(input.contentApprovalIds ? { contentApprovalIds: input.contentApprovalIds } : {}),
    ...(input.recommendationId !== undefined ? { recommendationId: input.recommendationId } : {}),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, resolveSigningSecret());
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies signature, version, and expiry. Does NOT check tenant/session -- callers
 * (the /open and /execute routes) still must confirm the authenticated user matches
 * payload.userId/businessProfileId/emailRecipient before treating this as authorization
 * to act. A token is necessary but never sufficient on its own.
 */
export function verifyEmailActionToken(
  token: string,
  now: Date = new Date()
): EmailActionTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new EmailActionTokenError("Invalid approval action link.", "invalid");
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload, resolveSigningSecret());

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new EmailActionTokenError("This approval link failed verification.", "tampered");
  }

  let payload: EmailActionTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as EmailActionTokenPayload;
  } catch {
    throw new EmailActionTokenError("This approval link is invalid.", "invalid");
  }

  if (payload.tokenVersion !== CURRENT_EMAIL_ACTION_TOKEN_VERSION) {
    throw new EmailActionTokenError("This approval link uses an unsupported format.", "unsupported_version");
  }

  const allowedActions: EmailActionType[] = [
    EmailActionTypes.APPROVE,
    EmailActionTypes.APPROVE_ALL,
    EmailActionTypes.REJECT,
  ];
  if (
    !payload.userId ||
    !payload.businessProfileId ||
    !payload.emailRecipient ||
    !payload.nonce ||
    !allowedActions.includes(payload.action)
  ) {
    throw new EmailActionTokenError("This approval link is invalid.", "invalid");
  }

  if (payload.action === EmailActionTypes.APPROVE_ALL && !payload.contentApprovalIds?.length) {
    throw new EmailActionTokenError("This approval link is invalid.", "invalid");
  }
  if (
    (payload.action === EmailActionTypes.APPROVE || payload.action === EmailActionTypes.REJECT) &&
    !payload.contentApprovalId
  ) {
    throw new EmailActionTokenError("This approval link is invalid.", "invalid");
  }

  if (typeof payload.expiresAt !== "number" || payload.expiresAt * 1000 < now.getTime()) {
    throw new EmailActionTokenError("This approval link has expired.", "expired");
  }

  return payload;
}

export function buildEmailActionOpenPath(token: string): string {
  return `/api/email-actions/open?token=${encodeURIComponent(token)}`;
}

export function buildEmailActionAbsoluteUrl(baseUrl: string, token: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  return `${origin}${buildEmailActionOpenPath(token)}`;
}
