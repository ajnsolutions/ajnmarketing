# Launch Checklist

Use this before any pilot or production cutover. This checklist does **not** activate Trigger.dev schedules.

## 0. Preconditions

- [ ] `ATTACH_DECLARATIVE_PRODUCTION_CRONS` is `false` in the deployed build
- [ ] No auto-publishing / auto-approval feature flags enabled
- [ ] Service-role key rotation confirmed (or risk accepted in writing)
- [ ] Operators listed in `ADMIN_USER_IDS`

## 1. Environment variables

### Required
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SECRET_KEY` (server only — never `NEXT_PUBLIC_*`)
- [ ] `OPENAI_API_KEY`
- [ ] `TOKEN_ENCRYPTION_KEY` (or dedicated signing secrets below)
- [ ] `ADMIN_USER_IDS` (comma-separated auth user ids)

### Strongly recommended before email actions at scale
- [ ] `EMAIL_ACTION_TOKEN_SECRET`
- [ ] `WEEKLY_APPROVAL_LINK_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL`

### Google Business Profile
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_REDIRECT_URI` (exact match with Google Cloud console)

### Trigger.dev (optional until schedule activation)
- [ ] `TRIGGER_SECRET_KEY`
- [ ] Trigger.dev project linked (`npx trigger.dev@latest`)

### Must remain unset / false for this launch
- [ ] `FAILURE_INJECTION_ENABLED` not set (or not `true`) in production
- [ ] Do not set `ATTACH_DECLARATIVE_PRODUCTION_CRONS=true` via env override patterns

## 2. OAuth setup

- [ ] Google Cloud OAuth client created
- [ ] Redirect URI matches env
- [ ] GBP API / My Business scopes enabled as required by the app
- [ ] Test connect → sync → disconnect/reconnect on a non-pilot account first

## 3. Supabase

- [ ] All migrations applied through latest
- [ ] RLS policies present on tenant tables
- [ ] Service role key stored only in server env / secret manager
- [ ] Backup / point-in-time recovery understood for the project

## 4. Trigger.dev

- [ ] Project exists (if using admin task triggers)
- [ ] Tasks deployable without attaching production crons
- [ ] Confirm schedules list shows **no** active declarative production crons

## 5. Email provider

- [ ] Outbound provider **not required** for this milestone (preview only)
- [ ] When wiring send later: provider API key, from-domain DNS, bounce handling

## 6. OpenAI

- [ ] Key valid with model access used by content + agents
- [ ] Budget alerts configured in OpenAI dashboard

## 7. Google Business

- [ ] Pilot location(s) identified
- [ ] Publishing tested only with explicit operator action
- [ ] Reconnect runbook reviewed (`RUNBOOKS.md`)

## 8. Database migrations

- [ ] `supabase migration list` / dashboard shows expected versions
- [ ] No pending destructive migrations

## 9. Smoke tests

- [ ] `GET /api/health` returns non-critical overall (or understood warnings)
- [ ] Login + dashboard load
- [ ] `/dashboard/admin/ops` loads for allowlisted admin
- [ ] Non-admin cannot access ops (redirect/403)
- [ ] Approval Center approve/reject
- [ ] Publishing queue add + publish now (or safe failure without GBP)
- [ ] Weekly package preview HTML
- [ ] One-click email action open → confirm → execute on a pending draft
- [ ] Unit + Playwright suites green in CI

## 10. Monitoring

- [ ] Ops dashboard bookmarked
- [ ] Alert panel reviewed (empty or understood)
- [ ] Workflow validation shows PASS on ops page

## 11. Rollback

- [ ] Previous Vercel deployment identified
- [ ] Env var rollback plan documented
- [ ] Feature disable: keep cron gate false; disable admin triggers if needed

## 12. Verification / launch order

1. Deploy app with cron gate false
2. Health + ops dashboard
3. Pilot validation (`PILOT_VALIDATION.md`)
4. Assisted recommendation runs via admin APIs
5. Explicit publish only
6. Schedule activation deferred to a separate approved PR

## 13. Sign-off

- [ ] Engineering
- [ ] Operator / founder
- [ ] Date / deployment URL
