# Business Connections Foundation

**Status:** Shipped (architecture + customer experience)  
**Branch:** `project-magic/business-connections-foundation`  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

A unified, **provider-agnostic** framework so the Business Brain can see what information is available and which additional signals would improve recommendations.

> Do **not** implement every integration here. Build the architecture and the customer experience. Seed live Google Business Profile + website understanding; everything else is a designed placeholder.

Companion: [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md) · [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`PRODUCT_DECISION_FILTER.md`](./PRODUCT_DECISION_FILTER.md)

---

## Product decision filter

| Check | How this sprint meets it |
| --- | --- |
| Strengthen the Business Brain | Readiness + contribution model expose available vs missing intelligence |
| Improve customer understanding | “What will I learn if you connect this?” in plain language |
| Remain provider-agnostic | Catalog keyed by business purpose; opaque provider ids |
| Preserve simplicity | One recommended next connection; Great Simplification primary nav untouched |
| Avoid unnecessary integrations | Placeholders only — no new OAuth/providers |

---

## Architecture

Package: `lib/business-connections/`

| Module | Role |
| --- | --- |
| `types.ts` | Connection model (status, health, capabilities, contribution, actions) |
| `catalog.ts` | Purpose-organized seed catalog |
| `resolve.ts` | Pure resolution of live signals → runtime connections |
| `readiness.ts` | Business Brain readiness items |
| `recommendNext.ts` | Exactly one highest-value next connection |
| `compose.ts` | Snapshot composer |
| `service.ts` | Server load using existing GBP + website analysis |

```
Live signals (GBP, website, …)
        ↓
  resolveBusinessConnections
        ↓
  readiness + recommendNext
        ↓
  BusinessConnectionsSnapshot
        ↓
  /dashboard/business-connections
```

Marketing Director / Growth Advisor remain decision engines. Connections only describe **inputs**.

---

## Connection model

Each connection defines:

- **Category** — business purpose (not vendor)
- **Provider** — opaque id
- **Connection status** — `not_connected` | `connected` | `needs_attention` | `coming_soon` | `unavailable`
- **Available capabilities** — what is live right now
- **Business Brain contribution** — customer-safe summary + intelligence source keys
- **Last sync**
- **Health** — `healthy` | `attention` | `unknown` | `not_applicable`
- **Recommended next actions** — connect / reconnect / coming soon

### Categories

1. Customer Feedback  
2. Website & Search  
3. Advertising  
4. Social Media  
5. Communications  
6. Scheduling & Commerce  
7. CRM & Sales  
8. Documents  

### Live today

- **Google Business Profile** — reuses existing OAuth connection status  
- **Website understanding** — reuses website analysis presence  

### Placeholders (designed, not built)

Search Console, website analytics, Meta/Google ads, Facebook/Instagram/LinkedIn, call tracking, email, booking, CRM, smart uploads.

---

## Connection lifecycle

```
Catalog entry (static)
  ↓
Resolve against live signals
  ↓
Status + health + capabilities + actions
  ↓
Customer reviews on Business Connections page
  ↓
Connect / reconnect via existing flows (GBP, website analysis)
  ↓
(Future) provider-specific sync jobs — still behind ATTACH_DECLARATIVE_PRODUCTION_CRONS
```

Revoke and auth remain owned by each live provider module (e.g. `lib/google-business-profile`). This foundation does not invent a second OAuth stack.

---

## Capability model

Capabilities are shared vocabulary (reviews, search performance, document knowledge, …). Readiness maps capabilities → available / unavailable / partial / coming_soon for onboarding and empty states.

Examples surfaced:

- Customer feedback available / unavailable  
- Search performance unavailable (coming soon)  
- Website analytics unavailable (coming soon)  
- Document knowledge unavailable (coming soon)  

---

## Customer experience

Route: `/dashboard/business-connections`  
Entry points: Settings hub · advanced nav (“More”)

Page emphasizes:

1. One **Recommended next** connection  
2. **What the Business Brain can see** (readiness)  
3. Catalog by category with “What will I learn if you connect this?”

Primary nav (Great Simplification four destinations) is unchanged.

---

## Future providers

Adding a provider should:

1. Add a catalog entry (`implementation: "live"` when ready)  
2. Extend `resolve.ts` with live signals  
3. Reuse the same status/health/capability contract  
4. Avoid redesigning the page or Growth Advisor  

Aligns with [`CONNECTOR_FRAMEWORK.md`](./CONNECTOR_FRAMEWORK.md) Auth → Sync → Health → Revoke → Customer-safe errors.

---

## Known limitations

- Most catalog entries are placeholders — no new OAuth  
- Recommendation is heuristic (category value order), not ML  
- Readiness does not yet wire into Growth Advisor empty-state copy (foundation only)  
- No dedicated connections table — status derived from existing sources  

---

## Recommended next sprint

1. Wire readiness summaries into Growth Advisor / onboarding empty states  
2. Implement the next highest-value live provider (Search Console **or** Smart Uploads) behind the same contract  
3. Optional: persist connection preference (“remind me later”) without building every integration  

---

## Tests

- `unit-tests/business-connections-foundation.test.ts`
- `tests/business-connections-foundation.spec.ts`

