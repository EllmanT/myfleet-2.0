# myFleet runbook (when something breaks)

Written 2026-11-08. Pair with `docs/DEPLOYMENT.md` (setup, rollback table, restore commands) and `docs/compliance/BREACH_RESPONSE_PLAN.md` (data incidents: the 24-hour regulator and 72-hour individual clocks start when you learn of it). Fill the contact block before launch.

## Contacts (fill in)
| Role | Name | Phone | Backup |
|---|---|---|---|
| Incident lead | | | |
| Deputy (needs access to Vercel, Atlas, Clerk, DNS, mail) | | | |
| Lawyer | | | |
| Hosting/vendor support | Vercel, Atlas, Clerk dashboards | | |

## First five minutes (any incident)
1. Write down the time you learned of it.
2. Check: uptime monitor, Vercel deployments (did something just ship?), Vercel function logs, Atlas metrics, Clerk status page, Vercel status page, Atlas status page.
3. If the last deploy is the likely cause: Vercel, app project, Deployments, previous Production deployment, Promote. Do this first, investigate after.
4. Tell customers if it lasts more than 15 minutes (WhatsApp broadcast / status page).

## Symptom guide
| Symptom | Likely cause | Action |
|---|---|---|
| Every `/api` call returns `503 Database unavailable` | `DB_URL` wrong/missing, Atlas paused, network access list, bad DB password after rotation | Check Atlas cluster state and Network Access; confirm `DB_URL` in the right Vercel scope; redeploy |
| `Origin not allowed` (403) on writes | `ALLOWED_ORIGINS` lacks the app origin | Fix variable, redeploy |
| Users bounce to login / "Finish setting up your account" loop | Clerk keys mismatch between front and back (`pk_`/`sk_` from different instances), bootstrap failing | Compare `REACT_APP_CLERK_PUBLISHABLE_KEY` (build time!) with `CLERK_*` server keys; check `POST /api/v2/auth/bootstrap` in logs |
| "Sign-in service is not configured" (503) | `CLERK_SECRET_KEY` or publishable key missing in that environment | Set, redeploy |
| Company sees empty lists after a release | `TENANT_GUARD=enforce` with unstamped data | Set `TENANT_GUARD=off`, redeploy, run `verifyTenantStamps`, backfill |
| One company sees another's data | Isolation bug: **breach incident** | Follow BREACH_RESPONSE_PLAN; set `enforce`; disable the route; preserve logs |
| Uploaded document disappears | Blob not connected (`BLOB_STORE_ID` missing) so files went to ephemeral disk | Connect store, redeploy; affected uploads must be re-requested |
| Reminder emails not arriving | `SMPT_*` missing/wrong, provider limit, spam; or `CRON_SECRET` missing (cron 404) | Call `billing-notices` with the bearer; read `results`; check provider dashboard |
| Cron shows 401 | `CRON_SECRET` differs from what Vercel sends (rotated without redeploy) | Redeploy so Cron picks up the value |
| Cron shows 404 | `CRON_SECRET` unset in Production | Set and redeploy |
| Function timeouts (504) on stats/export/purge | 30 s limit | Retry later; run heavy work off-hours; file a bug (G16/G17) |
| Many 429s for an office | Shared IP hit the limiter | Check Firewall/limiter; raise limit via code if legitimate |
| AI import errors or cost spike | key missing/invalid, quota reached, model changed | Check Anthropic console; set `AI_IMPORT_MODEL`; lower `AI_IMPORT_PAGES_PER_MONTH` |
| Customer says they were locked out (read-only) | Billing state: trial ended or payment overdue | Admin console, Manage: check state/dates; mark paid or extend |
| Customer asks to delete/export | Rights request | Export from Modules page (or platform admin export); deletion via admin (30-day wait) |
| Domain/HTTPS error | DNS or certificate | Vercel Domains page; revert the DNS change |

## Routine procedures
- **Mark a payment**: admin console, company, Manage, mark paid (+30 days). Log the EcoCash reference. Audit row is written automatically.
- **Extend a trial / change plan / suspend / restore**: same Manage window.
- **Promote a platform admin**: DEPLOYMENT section 10.
- **Rotate a secret**: DEPLOYMENT section 21.
- **Release**: `docs/plan/RELEASE_CHECKLIST.md`.
- **Backup before risky work**: Atlas snapshot + `mongodump` (DEPLOYMENT 15.1).
- **Atlas restore**: restore to a *new* cluster, verify counts, then repoint `DB_URL`; never over live.
- **Kill switch for a module**: disable in `backend/config/modules.js` for the tenant, or take the route down (code change + deploy).
- **Attack mode**: Vercel Firewall, enable Attack Challenge Mode; tighten rate rules.

## Weekly
Review: Atlas Performance Advisor, error tracker top issues, bounce/complaint report, Anthropic spend, cron last-runs, number of trials ending and payments due, `npm audit`.

## Quarterly
Restore drill (DEPLOYMENT 15.2), secrets rotation review, access review (remove leavers from every account), breach-plan drill, dependency updates.

## Drill log
| Date | Drill | Who | Result (time taken, counts matched, issues) |
|---|---|---|---|
| | Restore from backup | | |
| | Breach tabletop | | |
| | Rollback of a deployment | | |
