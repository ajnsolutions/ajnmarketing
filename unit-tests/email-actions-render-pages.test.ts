import test from "node:test";
import assert from "node:assert/strict";
import {
  renderConfirmApprovePage,
  renderExecutionResultPage,
  renderRejectReasonPage,
  renderResultPage,
} from "../lib/email-actions/renderPages.ts";

test("renderConfirmApprovePage: approve_all shows item count and posts to the execute endpoint with the token", () => {
  const html = renderConfirmApprovePage({
    action: "approve_all",
    itemCount: 3,
    businessName: "Acme Co",
    token: "the-token-value",
    executeUrl: "/api/email-actions/execute",
    approvalCenterUrl: "/dashboard/approvals",
  });

  assert.match(html, /Approve all pending items/i);
  assert.match(html, /method="POST"/);
  assert.match(html, /action="\/api\/email-actions\/execute"/);
  assert.match(html, /value="the-token-value"/);
  assert.match(html, />\s*Approve All\s*</);
  // Never leaks anything secret-looking beyond the token itself, which is expected to
  // be embedded as the hidden form field the user's own click will submit.
  assert.equal(html.includes("<script"), false);
});

test("renderConfirmApprovePage: single approve does not claim a plural item count", () => {
  const html = renderConfirmApprovePage({
    action: "approve",
    businessName: "Acme Co",
    token: "tok",
    executeUrl: "/api/email-actions/execute",
    approvalCenterUrl: "/dashboard/approvals",
  });

  assert.match(html, /Approve this recommendation/i);
  assert.match(html, />\s*Approve\s*</);
});

test("renderRejectReasonPage: includes every canonical rejection reason code and posts the token", () => {
  const html = renderRejectReasonPage({
    businessName: "Acme Co",
    token: "tok",
    executeUrl: "/api/email-actions/execute",
    approvalCenterUrl: "/dashboard/approvals",
  });

  for (const code of [
    "too_promotional",
    "wrong_tone",
    "incorrect_information",
    "off_brand_topic",
    "poor_timing",
    "duplicate_content",
    "other",
  ]) {
    assert.match(html, new RegExp(`value="${code}"`));
  }
  assert.match(html, /name="reasonCode"/);
  assert.match(html, /name="comment"/);
  assert.match(html, /value="tok"/);
});

test("renderResultPage: escapes untrusted-looking content and never renders a script tag", () => {
  const html = renderResultPage({
    title: "<script>alert(1)</script>",
    message: "Some message with <b>markup</b> & an ampersand",
    tone: "error",
  });

  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.match(html, /&lt;script&gt;/);
});

test("renderExecutionResultPage: all approved reports full success", () => {
  const html = renderExecutionResultPage({
    result: {
      action: "approve_all",
      items: [
        { contentApprovalId: "ca-1", outcome: "done" },
        { contentApprovalId: "ca-2", outcome: "done" },
      ],
    },
    approvalCenterUrl: "/dashboard/approvals",
  });

  assert.match(html, />Approved</);
  assert.match(html, /2 recommendations approved/);
});

test("renderExecutionResultPage: already approved (idempotent replay) reports 'Already approved', not 'Approved'", () => {
  const html = renderExecutionResultPage({
    result: {
      action: "approve_all",
      items: [
        { contentApprovalId: "ca-1", outcome: "already_done" },
        { contentApprovalId: "ca-2", outcome: "already_done" },
      ],
    },
    approvalCenterUrl: "/dashboard/approvals",
  });

  assert.match(html, /Already approved/);
  assert.match(html, /Nothing else to do/);
});

test("renderExecutionResultPage: partial success reports counts, doesn't claim full success", () => {
  const html = renderExecutionResultPage({
    result: {
      action: "approve_all",
      items: [
        { contentApprovalId: "ca-1", outcome: "done" },
        { contentApprovalId: "ca-2", outcome: "not_pending" },
        { contentApprovalId: "ca-3", outcome: "not_found" },
      ],
    },
    approvalCenterUrl: "/dashboard/approvals",
  });

  assert.match(html, /Partially approved/);
  assert.match(html, /1 of 3/);
});
