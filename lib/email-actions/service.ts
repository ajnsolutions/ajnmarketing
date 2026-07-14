import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getContentApprovalById } from "@/lib/content-approval/persistence";
import { patchContentApprovalForUser } from "@/lib/content-approval/service";
import type { ContentApproval } from "@/lib/content-approval/types";
import { isRejectionReasonCode } from "@/lib/recommendation-outcomes/types";
import type {
  EmailActionExecutionResult,
  EmailActionItemOutcome,
  EmailActionType,
} from "@/lib/email-actions/types";
import { EmailActionTypes } from "@/lib/email-actions/types";

/** Structured, secret-free server log -- never logs the token, HMAC secret, or full draft content. */
function logEmailAction(input: {
  action: EmailActionType;
  userId: string;
  businessProfileId: string;
  contentApprovalId: string;
  outcome: EmailActionItemOutcome;
  nonce?: string;
}): void {
  console.info("[EmailActions]", {
    scope: "email-actions",
    action: input.action,
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    contentApprovalId: input.contentApprovalId,
    outcome: input.outcome,
    nonce: input.nonce,
  });
}

/**
 * Loads a content approval, verifying it belongs to BOTH this userId (already enforced
 * by getContentApprovalById's own query) AND this businessProfileId -- defense in depth
 * beyond the userId check alone, since a forged/mismatched businessProfileId in a token
 * must never be trusted over what the row itself actually belongs to.
 */
async function loadTenantScopedApproval(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  contentApprovalId: string
): Promise<ContentApproval | null> {
  const approval = await getContentApprovalById(supabase, userId, contentApprovalId);
  if (!approval || approval.business_profile_id !== businessProfileId) return null;
  return approval;
}

/**
 * Executes (or safely no-ops) a single approve action via the SAME authoritative
 * mutation every other approval path in this codebase uses
 * (patchContentApprovalForUser) -- this function adds no parallel business logic, only
 * tenant/status pre-checks so a replayed or already-actioned request never re-executes
 * the mutation or reports a false "approved again".
 */
export async function executeApproveForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  contentApprovalId: string,
  nonce?: string
): Promise<EmailActionItemOutcome> {
  const approval = await loadTenantScopedApproval(supabase, userId, businessProfileId, contentApprovalId);

  if (!approval) {
    logEmailAction({ action: EmailActionTypes.APPROVE, userId, businessProfileId, contentApprovalId, outcome: "not_found", nonce });
    return "not_found";
  }

  if (approval.status === "approved" || approval.status === "published") {
    logEmailAction({ action: EmailActionTypes.APPROVE, userId, businessProfileId, contentApprovalId, outcome: "already_done", nonce });
    return "already_done";
  }

  if (approval.status !== "pending") {
    logEmailAction({ action: EmailActionTypes.APPROVE, userId, businessProfileId, contentApprovalId, outcome: "not_pending", nonce });
    return "not_pending";
  }

  const updated = await patchContentApprovalForUser(userId, { id: contentApprovalId, action: "approve" }, supabase);
  const outcome: EmailActionItemOutcome = updated ? "done" : "failed";
  logEmailAction({ action: EmailActionTypes.APPROVE, userId, businessProfileId, contentApprovalId, outcome, nonce });
  return outcome;
}

/**
 * Approve All: iterates ONLY the immutable snapshot of content_approval_ids captured in
 * the signed token at generation time -- never re-queries "all currently pending
 * approvals", so a draft created after the email was sent is never swept in. One
 * item's failure never aborts the rest (Phase 4's explicit "continue safely, report
 * partial results" requirement) -- there is no cross-row transaction wrapping these
 * updates in the existing architecture to preserve, so none is introduced here.
 */
export async function executeApproveAllForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  contentApprovalIds: string[],
  nonce?: string
): Promise<EmailActionExecutionResult> {
  const items = [];
  for (const contentApprovalId of contentApprovalIds) {
    const outcome = await executeApproveForUser(supabase, userId, businessProfileId, contentApprovalId, nonce);
    items.push({ contentApprovalId, outcome });
  }

  return { action: EmailActionTypes.APPROVE_ALL, items };
}

export async function executeRejectForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  contentApprovalId: string,
  reasonCode: string | undefined,
  comment: string | undefined,
  nonce?: string
): Promise<EmailActionItemOutcome> {
  const approval = await loadTenantScopedApproval(supabase, userId, businessProfileId, contentApprovalId);

  if (!approval) {
    logEmailAction({ action: EmailActionTypes.REJECT, userId, businessProfileId, contentApprovalId, outcome: "not_found", nonce });
    return "not_found";
  }

  if (approval.status === "rejected") {
    logEmailAction({ action: EmailActionTypes.REJECT, userId, businessProfileId, contentApprovalId, outcome: "already_done", nonce });
    return "already_done";
  }

  if (approval.status !== "pending") {
    logEmailAction({ action: EmailActionTypes.REJECT, userId, businessProfileId, contentApprovalId, outcome: "not_pending", nonce });
    return "not_pending";
  }

  if (!isRejectionReasonCode(reasonCode)) {
    logEmailAction({ action: EmailActionTypes.REJECT, userId, businessProfileId, contentApprovalId, outcome: "invalid_reason", nonce });
    return "invalid_reason";
  }

  const updated = await patchContentApprovalForUser(
    userId,
    {
      id: contentApprovalId,
      action: "reject",
      rejection_reason_code: reasonCode,
      rejected_reason: comment,
    },
    supabase
  );
  const outcome: EmailActionItemOutcome = updated ? "done" : "failed";
  logEmailAction({ action: EmailActionTypes.REJECT, userId, businessProfileId, contentApprovalId, outcome, nonce });
  return outcome;
}
