# Navigation Philosophy

**Companion to:** [`DASHBOARD_PHILOSOPHY.md`](./DASHBOARD_PHILOSOPHY.md) · [`MAGIC_BLUEPRINT.md`](./MAGIC_BLUEPRINT.md)

---

## 1. Two experiences, never mixed

| Experience | Audience | Purpose |
|---|---|---|
| **Customer product** | Business owners | Feel like a Head of Marketing is working for them |
| **Admin operating console** | AJN staff / allowlisted operators | Run the business of AJN Marketing |

Customers must never stumble into internal ops. Admins must never be forced to use customer IA for operations.

---

## 2. Future customer navigation

Keep the customer shell small. Progressive disclosure over feature lists.

Suggested primary destinations:

| Nav item | Job to be done |
|---|---|
| **Dashboard** | How am I doing? What needs me? What did you do? |
| **Marketing** | Approvals, drafts, weekly package — the work |
| **Results** | Marketing Health + plain-English outcomes |
| **Business** | Profile, GBP connection, brand basics, management style |
| *(Account)* | Login identity, billing *(when real)*, notifications prefs |

### Rules
- No 17-item flat sidebar of internal modules.  
- Placeholders never sit as equal peers to real features without “Coming soon” honesty.  
- Deep tools (website analysis internals, market context raw, agent task queues) fold under Marketing/Business as advanced — or stay admin-only.  
- Label with outcomes (“Marketing”), not engines (“Decision Engine”).

---

## 3. Why separate admin

Admin needs density, diagnostics, pilot metrics, job health, trust progression, revenue, support tooling.

That cognitive model **increases** anxiety if shown to owners.

Admin entry:
- Allowlisted users only  
- Not in customer `navLinks`  
- Optional subtle Account → Admin for allowlisted users  
- Server-side gate always  

Suggested admin areas (operating console):

| Area | Purpose |
|---|---|
| Customer health | Account state, onboarding, engagement |
| Trust progression | Stage/style adherence |
| Marketing health | Aggregate tenant health |
| AI health | Provider failures, cost, quality flags |
| Revenue | Billing/pilot economics *(when exists)* |
| Pilot | Assisted pilot checklist/metrics |
| Operations | Jobs, publishes, queues |
| Support | Lookup, safe interventions |
| Opportunities | Product gaps from real usage |
| Roadmap | Internal planning — never customer |

Today’s `/dashboard/admin/ops` is the seed — expand toward this console without polluting customer nav.

---

## 4. Public site navigation (related)

Public nav sells confidence: Home, Features/How it works, Pricing, About, Contact, Get Started (demo).

It should **preview** the Head-of-Marketing story, not mirror the authenticated feature catalog.

---

## 5. Migration stance from current IA

**Shipped (One Head of Marketing):** Primary customer nav is now small — Your Head of Marketing, This Week, Google Profile, Business Settings — with former “what next?” peers (Plan, Tasks, Recommendations, Command Center, Analytics, …) under progressive disclosure (“More tools”). Routes remain; nothing is deleted. Details: [`ONE_HEAD_OF_MARKETING.md`](./ONE_HEAD_OF_MARKETING.md).

**Still ahead:** fuller grouping into Marketing / Results / Business shells, and removing any remaining placeholder peers from advanced lists when they are not real.
