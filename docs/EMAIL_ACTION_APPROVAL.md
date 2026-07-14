# Secure One-Click Email Approval

Lets an authenticated recipient of a Weekly Approval Package (see
[`WEEKLY_APPROVAL_PACKAGE.md`](./WEEKLY_APPROVAL_PACKAGE.md)) **Approve All**, **Approve** a
single draft, or **Reject** a single draft directly from the email, without opening the
dashboard first. Editing still happens only in the Approval Center. This feature never
auto-approves, never auto-publishes, and never activates a schedule.

## Why this isn't the same token as PR #30's "open" links

`lib/weekly-approval-package/signedLinks.ts` already signs links, but that model is
**redirect-only**: its payload (`{v, purpose, userId, businessProfileId, itemId?, exp}`)
carries no `action`, no `nonce`, no `tokenVersion`, and clicking one never mutates
anything — it only routes an already-authenticated user into the Approval Center.

This feature introduces a deliberately separate token family,
`lib/email-actions/tokens.ts`, because these tokens **execute a mutation**. They needed:

- an explicit `action` (`approve` | `approve_all` | `reject`)
- a `tokenVersion` so the format can evolve without breaking old, already-sent emails
- a `nonce` for signed-payload identity and audit-trail correlation
- an immutable snapshot of exactly which drafts an `approve_all` covers
- a bound `emailRecipient` to cross-check against the authenticated session's email

### Domain separation

Both token families may fall back to the same secret (`TOKEN_ENCRYPTION_KEY`) if a
dedicated one isn't configured. To guarantee they can never be confused or replayed
against each other even in that case, email-action tokens mix a constant
(`SIGNING_DOMAIN = "ajn-email-action-token-v1"`) into the HMAC input:

```
HMAC-SHA256(secret, "ajn-email-action-token-v1." + base64url(payload))
```

A weekly-package "open" token will never verify as an email-action token, and vice
versa — this is checked by an automated test.

## Token model

```ts
type EmailActionTokenPayload = {
  tokenVersion: 1;
  action: "approve" | "approve_all" | "reject";
  userId: string;
  businessProfileId: string;
  contentApprovalId?: string;       // approve / reject
  contentApprovalIds?: string[];    // approve_all — immutable snapshot
  recommendationId?: string | null;
  emailRecipient: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
```

Format: `base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)`, verified with
`crypto.timingSafeEqual` — identical construction to the existing weekly-package tokens,
just a separate signing domain and a richer payload. Default TTL is 7 days (matches the
weekly cadence). Secret resolution order: `EMAIL_ACTION_TOKEN_SECRET` →
`WEEKLY_APPROVAL_LINK_SECRET` → `TOKEN_ENCRYPTION_KEY`.

A token is **necessary but never sufficient** for authorization. `verifyEmailActionToken`
only proves the payload is authentic, unexpired, and well-formed — every route still
re-derives the acting user from the live session and cross-checks it against the
payload before executing anything.

## Why a GET click never executes a mutation

Email security scanners (Microsoft Defender Safe Links, Proofpoint, Mimecast, etc.)
automatically pre-fetch/"detonate" links found in emails via automated `GET` requests,
with no real user intent behind them. Since "security takes priority over convenience"
is explicit for this feature, the architecture treats this as a hard constraint:

- `GET /api/email-actions/open` **only** verifies the token, checks the session, and
  renders a confirmation page (approve / approve-all) or a reason-selector page
  (reject). It is safe to pre-fetch or click repeatedly — nothing is ever mutated here.
- `POST /api/email-actions/execute` is the **only** route that mutates state, and it
  only runs from a real form submission (the user clicking the rendered page's button).

This is a deliberate interpretation of "Approve executes directly" as *"no need to open
the full Approval Center app"*, not *"a bare GET auto-executes with no visible
intermediate step."*

## Authentication flow

Reuses the exact pattern already established by
`app/api/weekly-approval-package/open/route.ts`:

1. Verify the token. Fail closed (invalid/tampered/expired) before touching auth.
2. If there's no session: redirect to `/login?next=<this exact verified URL>` — reusing
   `safeInternalNextPath`'s existing open-redirect guard. After login, the user lands
   back on the same URL, which re-verifies the token and re-checks tenant match. No
   action executes purely because of the redirect.
3. If there is a session: `user.id` must equal `payload.userId`, the user's business
   profile must equal `payload.businessProfileId`, and (if both are known) `user.email`
   must match `payload.emailRecipient` — any mismatch is a 403, never a silent redirect.
4. Only then is the confirm/reject page rendered (GET) or the mutation executed (POST).

`POST /api/email-actions/execute` does not implement a "restore pending action after
login" flow of its own: an unauthenticated POST simply asks the user to reopen the
email link (a GET), which re-runs the full flow above. This avoids ever executing a
mutation from a bare redirect chain.

## Approve All semantics & package immutability

The weekly package generator (`generateWeeklyApprovalPackageForUser`) is fully
ephemeral — it re-queries pending drafts fresh every time and never persists a package
row. To still give `approve_all` an immutable membership list without a new table, the
exact `contentApprovalId[]` snapshot is embedded directly in the signed `approve_all`
token payload at generation time. Because the token is signed, that list cannot be
extended or edited after the email is sent — a draft created *after* generation is
structurally excluded, and there is no way to "sweep it in" without re-signing (which
only the server can do, from a fresh generation). `executeApproveAllForUser` iterates
**only** that snapshot; it never re-queries "all pending" at execute time.

**Scope boundary:** only content-draft/GBP-update items (which have a real
`contentApprovalId` and go through `patchContentApprovalForUser`) are eligible for
one-click email actions. Review-reply items use a different mutation path entirely and
are deliberately excluded from `approve_all`, `approve`, and `reject` — they remain
Edit-only from email.

**Partial results:** if one item in an `approve_all` batch fails (not found, no longer
pending, etc.), the rest still execute. There's no cross-row transaction in the existing
architecture to preserve, so none is introduced here — the result page reports an
explicit partial-success summary (e.g. "2 of 3 approved") rather than an all-or-nothing
verdict.

## Replay protection & idempotency

No new "used tokens" ledger table. Replay-safety comes from two existing properties
composed together:

1. Before executing, the current status of the `content_approval` row is checked. If
   it's already in the target state (`approved`/`published` for approve, `rejected` for
   reject), the mutation is **not** re-invoked — the outcome is `already_done`.
2. The underlying mutation (`recordApprovalOutcome`/`recordRejectionOutcome`, from PR
   #27) is already idempotent via its own unique `idempotency_key` constraint.

Together these mean a repeated click (or a security scanner retrying a POST) produces
"Already approved," never a duplicate outcome event, audit log, or publishing job. The
token's `nonce` is retained for signed-payload identity and audit correlation, not as a
single-use revocation mechanism — there is no server-side state to "spend" a nonce
against, by design.

## Structured rejection reasons

Rejecting from email always goes through a secure intermediate page
(`GET /api/email-actions/open` renders it, `POST /api/email-actions/execute` submits it)
rather than embedding a reason selector directly in the email body, per the explicit
requirement to reuse PR #27's structured rejection vocabulary
(`lib/recommendation-outcomes/types.ts`'s `RejectionReasonCodes` /
`isRejectionReasonCode`). An unrecognized or missing code is rejected with an explicit
`invalid_reason` outcome **before** the underlying mutation is ever called — it is not
silently normalized to `"other"` at this layer (PR #27's own outcome-event recording
still does that normalization one layer down, for defense in depth).

## Audit logging

Two new `AuditActions` (`EMAIL_ACTION_EXECUTED`, `EMAIL_ACTION_REJECTED`) are logged by
`POST /api/email-actions/execute`, in addition to (not instead of) the existing
`CONTENT_APPROVED`/`CONTENT_REJECTED` entries already written by
`patchContentApprovalForUser`. This gives a distinct, queryable record of "this
mutation happened via a one-click email link," carrying: who (`userId`), tenant/business
(`businessProfileId`), which approval id(s), the outcome per id, the email recipient the
token was bound to, the token's nonce, a timestamp, and IP/user-agent (via the existing
`getAuditRequestContext()` helper). **Never logged:** the token string itself, the HMAC
secret, or raw draft content.

## Security review checklist

| Threat | Mitigation |
| --- | --- |
| Token tampering (payload or signature) | HMAC-SHA256 + `timingSafeEqual`; any change invalidates the signature |
| Tenant mismatch | `user.id`/business profile checked against the *signed* payload, not client input; `loadTenantScopedApproval` re-checks `business_profile_id` on the row itself |
| Expired links | `expiresAt` checked on every verify; expired tokens render "Link expired," never execute |
| Replay / duplicate clicks | Status pre-check + idempotent outcome recording (see above) |
| Cross-tenant approval | Same tenant checks as above; a row belonging to a different business profile resolves as `not_found`, never approved |
| Changing approval/package ids | Ids only ever come from the signed payload; user-controlled query/form fields never carry the id used for authorization |
| Changing recipient | `emailRecipient` in the payload is cross-checked against the authenticated session's email |
| Session fixation | No custom session handling — relies entirely on existing Supabase cookie-session middleware |
| Open redirect | Reuses the existing `safeInternalNextPath` guard already used by the login flow |
| CSRF | The mutating route only accepts a `token` whose authorization is self-contained and signed; a cross-site form post would need the actual token value, which isn't guessable or available to a third-party site |
| Bare GET auto-execution (scanner detonation) | GET never mutates — see "Why a GET click never executes a mutation" above |

## Known limitations

- No outbound email delivery yet (same limitation as PR #30) — these links are only
  reachable via the package preview today.
- `approve_all`'s snapshot is embedded directly in the URL; very large weekly packages
  (tens of items) could approach practical URL length limits in some email clients. Not
  a concern at realistic weekly volumes, but worth revisiting if package sizes grow.
- No single-use token revocation ledger — see "Replay protection" above for why this is
  an intentional, documented tradeoff rather than a gap.
- `POST /api/email-actions/execute` does not implement its own login-redirect/session
  restoration; an unauthenticated POST asks the user to reopen the original email link
  instead of preserving form state through a login round-trip.

## Future: email delivery integration

When outbound delivery is added, the weekly package generator already produces
`approveAllActionUrl` and, per item, `approveActionUrl`/`rejectActionUrl` (nullable —
only populated once a recipient email is known and the item is eligible). The delivery
integration should pass a real `recipientEmail` into `generateWeeklyApprovalPackageForUser`
so these links are minted, and otherwise needs no changes to this feature.
