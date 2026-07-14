/**
 * Secure One-Click Email Approval — types. See docs/EMAIL_ACTION_APPROVAL.md.
 *
 * This is a deliberately SEPARATE token model from
 * lib/weekly-approval-package/signedLinks.ts's "open" tokens. That model is
 * redirect-only (it never mutates state, so replay/tenant checks only need to gate a
 * page view). These tokens EXECUTE a mutation, so they carry a distinct `action`,
 * `nonce`, `tokenVersion`, and (for approve_all) an immutable snapshot of exactly which
 * drafts were pending when the weekly package was generated.
 */

export const EmailActionTypes = {
  APPROVE: "approve",
  APPROVE_ALL: "approve_all",
  REJECT: "reject",
} as const;

export type EmailActionType = (typeof EmailActionTypes)[keyof typeof EmailActionTypes];

export const CURRENT_EMAIL_ACTION_TOKEN_VERSION = 1;

/**
 * Signed payload. Every field the execute path relies on for authorization comes from
 * here, never from an unsigned query/form parameter -- see verifyEmailActionToken.
 */
export type EmailActionTokenPayload = {
  tokenVersion: typeof CURRENT_EMAIL_ACTION_TOKEN_VERSION;
  action: EmailActionType;
  userId: string;
  businessProfileId: string;
  /** Single-item actions (approve, reject). */
  contentApprovalId?: string;
  /** approve_all only -- the immutable snapshot of pending drafts at generation time. */
  contentApprovalIds?: string[];
  recommendationId?: string | null;
  /** The email address the weekly package was actually sent to -- cross-checked
   * against the authenticated session's email as defense in depth beyond userId. */
  emailRecipient: string;
  issuedAt: number;
  expiresAt: number;
  /** Random per-token identity, included in the signed bytes and in audit logs --
   * not used as a single-use revocation ledger (see docs for why). */
  nonce: string;
};

export type EmailActionItemOutcome =
  /** The mutation actually executed on this request. */
  | "done"
  /** Already in the target state -- idempotent no-op, not re-executed. */
  | "already_done"
  /** Doesn't exist, or doesn't belong to this tenant/business. */
  | "not_found"
  /** Exists, but its current status makes it ineligible for this action (e.g.
   * already rejected, already published). */
  | "not_pending"
  /** Reject only: the submitted reason code isn't in the canonical vocabulary. */
  | "invalid_reason"
  /** The underlying mutation itself failed. */
  | "failed";

export type EmailActionItemResult = {
  contentApprovalId: string;
  outcome: EmailActionItemOutcome;
};

export type EmailActionExecutionResult = {
  action: EmailActionType;
  items: EmailActionItemResult[];
};
