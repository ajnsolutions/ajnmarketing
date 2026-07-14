# Weekly Approval Package

- **Status:** Implemented (generator + signed links + preview; **no email send / no schedule**)
- **Date:** 2026-07-14
- **Branch intent:** `build-weekly-approval-package`
- **Schedule gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` — this work does **not** activate Trigger.dev schedules, auto-approve, or auto-publish.

---

## 1. Purpose

Clients should not need to hunt through the Approval Center to discover what AJN prepared. Once a week, AJN Marketing assembles one **Weekly Approval Package** email that:

1. Lists pending recommendation-generated drafts
2. Includes pending AI review replies (`reply_status = draft`)
3. Includes pending Google Business Profile content drafts awaiting approval
4. Groups items by platform (and keeps recommendation explainability from PR #29)
5. Offers a prominent **Approve All** action that opens the **existing** Approval Center
6. Links each item into the Approval Center via **signed, time-limited, tenant-scoped** URLs

This milestone builds the **server-side generator, HTML/text templates, signed-link security, and preview API**. It does **not** wire a mail provider or a recurring schedule.

---

## 2. Architecture

```
content_approvals (pending, recommendation-linked and/or GBP)
google_business_reviews (draft AI replies)
        |
        v
lib/weekly-approval-package/collect.ts
        |
        +--> lib/recommendation-presentation (PR #29 packages: whyNow, expectedBenefit, …)
        |
        v
group.ts (platform order + recommendation adjacency)
        |
        +--> signedLinks.ts (HMAC tokens)
        +--> renderHtml.ts / renderText.ts
        |
        v
WeeklyApprovalPackage { html, text, approveAllUrl, … }
        |
        +--> GET /api/weekly-approval-package/preview  (dev/operator preview only)
        +--> GET /api/weekly-approval-package/open     (verify token → Approval Center)
```

No second approval workflow is introduced. Approving still happens exclusively through:

- `PATCH /api/content-approval`
- existing Approval Center UI (`/dashboard/approvals`)

---

## 3. Email rendering flow

1. `generateWeeklyApprovalPackageForUser({ userId, businessProfileId, … })`
2. Load profile (must match `userId`) — tenant check
3. Collect pending approvals + draft review replies (both filtered by `user_id` **and** `business_profile_id`)
4. Batch-load `ClientRecommendationDecisionPackage` via `getRecommendationDecisionPackagesForApprovals`
5. Map to `WeeklyPackageItem[]`, group/sort, build executive summary
6. Mint signed links (`approve_all`, `approval_center`, per-item `review_item`)
7. Render HTML (table/inline CSS, mobile-friendly) + plain text

Brand colors reuse the product tokens from `app/globals.css` (`navy-900`, `deep-navy`, `brand-600`, `surface`).

---

## 4. Signed-link security model

| Property | Behavior |
|----------|----------|
| Algorithm | HMAC-SHA256 over base64url(JSON payload) |
| Secret | `WEEKLY_APPROVAL_LINK_SECRET` or fallback `TOKEN_ENCRYPTION_KEY` |
| Payload | `{ v:1, purpose, userId, businessProfileId, itemId?, exp }` |
| Expiry | Default **7 days** |
| Integrity | Timing-safe signature compare; forged/modified tokens fail closed |
| Session | `/open` still requires the signed-in user to match `payload.userId` (or redirects to `/login?next=…`) |
| Effect | **Redirect only** — never approves, rejects, queues, or publishes |

### Purposes

- `approve_all` → `/dashboard/approvals?view=pending`
- `review_item` with `approval:<id>` → `/dashboard/approvals?focus=<id>&view=pending`
- `review_item` with `review:<id>` → `/dashboard/reviews?focus=<id>`
- `approval_center` → `/dashboard/approvals`

Kind prefixes are stripped before redirect so the Approval Center / Reviews UI can match raw row ids.

**Future one-click email approval** would add a new purpose (e.g. `approve_item`) that calls the existing `patchContentApprovalForUser` **after** the same HMAC + session/tenant checks — not a parallel workflow.

---

## 5. Approval workflow (unchanged)

```
Email / preview
  → signed /open link
  → login if needed
  → Approval Center (content drafts) or Reviews (AI reply drafts)
  → existing approve / reject / edit / more_like_this (or mark review responded)
  → publishing queue only after explicit approve (existing path)
```

---

## 6. Preview / development

```http
GET /api/weekly-approval-package/preview
GET /api/weekly-approval-package/preview?format=html
GET /api/weekly-approval-package/preview?format=text
```

Authenticated for the current user. Returns JSON envelope (`toWeeklyApprovalPackagePreview`) or raw HTML/text. **Never sends mail.**

---

## 7. Future integration (not in this PR)

1. Mail provider (Resend/SendGrid/etc.)
2. Trigger.dev weekly task (only after schedule-activation approval; gate stays false until then)
3. Optional one-click approve via additional signed purpose + existing content-approval service
4. SMS companion summary (already mocked in delivery UI)

---

## 8. Known limitations

- No outbound email delivery yet — previews only
- Review-reply item links open `/dashboard/reviews` (where draft replies are acted on); content drafts open the Approval Center
- Hand-authored non-GBP pending drafts without a recommendation link are excluded from the package (by design: package focuses on AI-prepared / GBP updates)
- Signed links prove integrity + tenant binding + expiry; they are **not** a substitute for authentication
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains false; no schedules activated by this work
- Prefer a dedicated `WEEKLY_APPROVAL_LINK_SECRET` before enabling live email send (falls back to `TOKEN_ENCRYPTION_KEY` today)
