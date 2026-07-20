/**
 * Request parsing for Experiment Proposal APIs.
 *
 * [Claude review, follow-up] The prior parseProposeExperimentRequestBody accepted
 * experimentType/hypothesis/marketingDirectorDecisionKey/createdFromRecommendationId
 * directly from the client — the whole point of the proposal chain is that none of
 * those fields are ever client-authoritative anymore. The only thing a client may now
 * submit is which already-persisted, server-authored proposal it wants to approve.
 */

export function parseApproveProposalRequestBody(
  body: unknown,
): { ok: true; value: { proposalId: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;
  const proposalId = record.proposalId;

  if (typeof proposalId !== "string" || !proposalId.trim()) {
    return { ok: false, error: "proposalId is required" };
  }

  return { ok: true, value: { proposalId: proposalId.trim() } };
}
