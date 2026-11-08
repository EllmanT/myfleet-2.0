# myFleet production checklist (mass-market launch)

Written 2026-11-08 from the code on `development` (HEAD `c0b961a`). Companion to `docs/DEPLOYMENT.md` (how) and `docs/RUNBOOK.md` (when it breaks). Existing related lists: `docs/plan/RELEASE_CHECKLIST.md` (the `development` to `main` release), `docs/plan/STATUS.md`, `docs/compliance/LEGAL_CHECKLIST.md`.

How to read this: every line is a gate. Tick it only when the "How to verify" evidence exists. Owner codes: **F** founder/owner, **D** developer, **L** lawyer, **A** accountant, **O** whoever runs operations/support. "BLOCKER" = do not open public sign-up until it is done. "SHOULD" = do within the first two weeks. "LATER" = scale item.

---

## 0. Gaps found in the code (read this first)

These were found by reading the repository, not by running anything. Each has an ID used in the gates below.

### Launch-blocking (BLOCKER)

| ID | Gap | Evidence in repo | Fix |
|---|---|---|---|
| G1 | **Legacy password system is still live on the public API**, although production is meant to be Clerk-only. `POST /api/v2/user/create-user` is public and answers "User exists" (email enumeration), sends activation mail; `login-user`, `forgot-password`, `reset-password`, `activation` all work; `isAuthenticated` still accepts a cookie JWT. No `LEGACY_LOGIN` flag exists (proposed in `REMAINING_WORK_PLAN.md`). | `backend/controller/user.js`, `backend/middleware/auth.js` (`authenticateWithCookie`), `backend/utils/jwtToken.js` | Add a flag defaulting to off in production, return 404 for the routes, remove cookie fallback (or restrict to the legacy first customer until migrated). Remove the activation-token password handling. Test that every route needs Clerk. |
| G2 | **No health endpoint.** The only probe is `/test` ("Hello world!"), which Vercel never routes to the function (only `/api/*` is rewritten). Uptime monitoring has nothing honest to hit. | `backend/app.js` | Add `GET /api/health` (no auth, no secrets, DB ping, build id). |
| G3 | **No error tracking, request IDs or structured logs.** 99 `console.*` calls; 500s are logged to Vercel's short-retention logs only. No Sentry-class tool in any `package.json`. | `backend/package.json`, `backend/middleware/error.js` | Add error tracking (backend + frontend), request id middleware, log drain. |
| G4 | **Rate limits are per serverless instance** (default in-memory store), so they reset on cold starts and are not shared across concurrent instances: login throttling (20 / 15 min) is not a real guarantee. `/auth/bootstrap`, uploads, exports and `rebuild-stats` are not covered by the strict limiter. | `backend/middleware/security.js`, `backend/app.js` | Shared store (Redis/Upstash) and/or Vercel Firewall rate rules; add a limiter for bootstrap and uploads. |
| G5 | **Missing indexes for the tenant-scoped query pattern.** With `TENANT_GUARD=enforce` every query on guarded models filters by owner; `jobs` has only single-field `tenantId` plus `orderDate`-led compounds; `users.companyId`, `vehicleexpenses`, `employeeexpenses`, `rates`, `contractorstats(delivererId)` have no owner index. `users.email` has **no unique index** (race in signup; Clerk linking assumes one user per email). | `backend/model/*.js`, `backend/services/tenantGuard.js` (`GUARDED`) | Declare the indexes in the schemas; build them in staging then production (`DEPLOYMENT.md` 4.6). |
| G6 | **Real customer data is committed and part of it is publicly served.** `all jobs 2025 to 2026/` (49 job spreadsheets and PDFs) is tracked in git. `frontend/public/sample-log-sheets-images/` (WhatsApp logbook photos and a workbook) and `frontend/public/logos-clients/` are copied into the public build and are downloadable at `app.yourdomain.com/sample-log-sheets-images/...`. | `git ls-files` | Remove from `public/` and from git (then purge history with `git filter-repo` / BFG if the repo is shared, and rotate anything inside). Keep samples only if synthetic. Confirm nobody pictured in them is identifiable. |
| G7 | **Placeholder domains in code.** `marketing` falls back to `https://app.example.com` and `https://myfleet.example.com` if `PUBLIC_APP_URL` / `PUBLIC_SITE_URL` are unset, so a mis-set variable ships broken sign-up links and canonical URLs. Docs use `yourdomain.com`. `FRONTEND_URL` unset puts `http://localhost:3000` into customer emails. | `marketing/src/lib/links.ts`, `marketing/astro.config.mjs`, `marketing/.env.example`, `backend/controller/user.js` | Set the variables; make the marketing build fail when they are missing in production; make the backend refuse to start emails with a localhost base in production. |
| G8 | **No staging environment exists**, and Vercel Preview builds run with `NODE_ENV=production`, so `Database.js` uses `DB_URL`: if Preview ever receives the production `DB_URL`, previews write to live data (RELEASE_CHECKLIST already warns). | `backend/db/Database.js`, `docs/plan/RELEASE_CHECKLIST.md` | Build staging per `DEPLOYMENT.md` section 2a; separate scoped variables; consider a guard that refuses Preview when `DB_URL` host equals the production host. |
| G9 | **Legal/compliance not finished** (not code, but it gates launch): Terms and Privacy are drafts (`noindex`, "pending legal review" banner), POTRAZ filing not done, vendor DPAs not filed, breach-plan blanks, no stored AI-consent record (H2), `TODO(owner)` / `TODO(lawyer)` markers in the marketing copy. | `docs/compliance/LEGAL_CHECKLIST.md`, `marketing/src/content/site.ts` | Section 6 below. |
| G10 | **`TENANT_GUARD` defaults to `off`.** Isolation in production depends on a variable someone must remember to set to `enforce`. Not set yet in production (STATUS.md item 5). | `backend/services/tenantGuard.js` line `process.env.TENANT_GUARD || "off"` | Set `enforce` in Production (after the stamp gate); consider defaulting to `enforce` when `NODE_ENV=production`. |

### Should fix soon (SHOULD)

| ID | Gap | Evidence | Fix |
|---|---|---|---|
| G11 | CORS allows every origin if both `ALLOWED_ORIGINS` and `FRONTEND_URL` are empty in production (`cors` receives no origin option). Because auth is by Bearer token, the practical risk is modest, but it is a silent fail-open. | `backend/app.js` | Fail closed in production; require the variable. |
| G12 | No security headers on the static sites (app and marketing): no HSTS, nosniff, frame-ancestors/X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP. The API sets Helmet but with CSP off. The app's `robots.txt` allows indexing of everything; `<title>myfleet</title>` and generic meta. | `vercel.json`, `marketing/vercel.json`, `frontend/public/robots.txt`, `frontend/public/index.html` | Add `headers` blocks; app `noindex`; real title/description. |
| G13 | **No Clerk webhook / deprovisioning sync.** Removing a user or organization in Clerk does not update local `User` or `Deliverer`. Local rows and company access are only cleaned by the admin console or the deletion job. | no webhook route in `backend/` | Add a signed webhook (`CLERK_WEBHOOK_SECRET`) or document the manual process. |
| G14 | **AI default model is the most expensive** (`claude-opus-5-5` hard-coded as default) and the only global cap is a monthly page count (default 100) plus per-band quotas. No spend alert. | `backend/services/aiImport/localLog.js`, `backend/controller/aiImport.js` | Choose the model after the 30 to 50 page bake-off the plan describes; set `AI_IMPORT_MODEL`; set Anthropic budget alerts. |
| G15 | Mail: variable names are misspelled `SMPT_*` (works, easy to mis-set), plain-text only, single mailbox as sender, new transporter per mail, no bounce handling, failures only visible in logs; cron "billing-notices" returns 200 even if individual sends fail (check `results`). | `backend/utils/sendMail.js`, `backend/services/billingEmails.js` | Dedicated provider on your domain, SPF/DKIM/DMARC, alert when `results` contains failures. |
| G16 | Cron/purge limits: 30 s `maxDuration`; a purge of a large company (many files, many documents) or a long billing run can time out; no alert if a cron fails or never runs (missing `CRON_SECRET` = silent 404). | `vercel.json`, `backend/controller/tenant.js`, `services/companyDeletion.js` | Make the purge resumable and batch-limited; alert on cron failures; monitor "last run". |
| G17 | `rebuild-stats` is a heavy endpoint (flagged in `REMAINING_WORK_PLAN.md`); scoped per company now but still can hit 30 s for big tenants. | `backend/controller/overallStats.js` | Move to background/queue or chunk it. |
| G18 | Function region not set (`vercel.json` has no `regions`), so latency to Atlas and to Zimbabwe is whatever the default gives. | `vercel.json` | Choose region deliberately together with the Atlas region. |
| G19 | Backups/restore are a process gap, not code: Cloud Backup only on dedicated tiers; Blob objects have no backup; the restore drill was never run (`REMAINING_WORK_PLAN.md` E5). | n/a | `DEPLOYMENT.md` sections 4.7 and 15. |
| G20 | Several `NODE_ENV` conventions coexist (`production`, `PRODUCTION`, `test`, unset), and dotenv path `config/.env` is relative to the process cwd. Works on Vercel today, fragile for new contributors or a different host. | `backend/app.js`, `backend/server.js`, `backend/db/Database.js` | Normalise to one check. |

### Later (LATER)

| ID | Gap | Fix |
|---|---|---|
| G21 | Billing is manual: customers pay by EcoCash/bank and you press "mark paid" in the admin console. No payment webhook, no receipt email, no reconciliation. Fine for tens of customers, a support burden at hundreds. | Paynow/EcoCash integration later. |
| G22 | Mongoose connection pool 10 per instance can exhaust Atlas connections under load. | Load test; tune `maxPoolSize`. |
| G23 | No per-user data export/erasure beyond company-level export and deletion; the Privacy Policy must describe how an individual (driver, customer contact) exercises rights through the company. | Legal wording + support process. |
| G24 | Express still carries `body-parser`, `nodemon` in dependencies (production deps), `multer@1`, `mongoose@7`, `xlsx` from a CDN tarball. | Dependency audit (`npm audit`), pin and update. |
| G25 | CI runs backend tests and a frontend build but not `npm audit`, lint, the marketing build, secret scanning or an e2e smoke. | Extend `.github/workflows/ci.yml`. |

---

## 1. Security

| # | Gate | Owner | How to verify |
|---|---|---|---|
| S1 | **BLOCKER** G1 closed: legacy signup, login, reset, activation routes disabled in production; cookie auth path removed or limited | D | `curl -i -X POST https://<APP>/api/v2/user/login-user -d '{}'` returns 404/410; no `create-user`; `grep -n authenticateWithCookie` shows it unused; auth tests pass |
| S2 | `TENANT_GUARD=enforce` in Production (G10), stamp gate green first | F, D | `node backend/scripts/verifyTenantStamps.js --target=live` exits 0; Vercel env shows `enforce`; second-company test cannot see company 1 data (DEPLOYMENT 13 #10) |
| S3 | Per-route isolation tests pass (`tenantIsolation.test.js`, `tenantIsolationEnforced.test.js`, `customerIsolation.test.js`) in CI on the commit being released | D | green CI on `main` |
| S4 | No dev settings in production: `RESET_PASSWORD_DEV_LINK` unset, `OFFLINE_DB_URL` unset, `JWT_SECRET_KEY` and `ACTIVATION_SECRET` are random (not `change-me...`), `PORT` unset | F | `vercel env ls production`; no `devResetUrl` field in forgot-password responses |
| S5 | Secrets are scoped: Preview has none of Production's secrets; `MONGO_URI_LIVE` exists only on a trusted machine | F | `vercel env ls preview` vs `production`; compare values' prefixes |
| S6 | Security headers on both static sites (G12) | D | `curl -sI https://<APP>/ \| grep -iE "strict-transport|x-content-type|frame|referrer"`; securityheaders.com grade A or B |
| S7 | CORS fails closed (G11); `ALLOWED_ORIGINS` is exactly `https://app.yourdomain.com` | D, F | `curl -i -H "Origin: https://evil.example" https://<APP>/api/v2/tenant/me` returns 403 |
| S8 | Rate limiting is effective across instances (G4) | D | send 40 login attempts from one IP in a minute, count 429s from at least two different instances; Vercel Firewall rules visible |
| S9 | Uploads: only JPEG/PNG/WebP/PDF by signature, 4 MB, private, owner-checked (already built: `services/fileStorage.js`, `controller/files.js`) | D | `fileStorage.test.js` green; manual: as company B, request company A's file key returns 404/403 |
| S10 | Repo has no secrets or customer data (G6): scan with gitleaks/trufflehog; remove `all jobs 2025 to 2026/` and public sample images | D | scanner reports clean; `git ls-files \| grep -iE "xlsx\|jpeg\|\.env"` shows only intended assets; `curl -I https://<APP>/sample-log-sheets-images/...` returns 404 |
| S11 | Any credential that ever appeared in git history is rotated (Phase 0 of SAAS_PLAN said rotate) | F | list of rotated items with dates in the password manager |
| S12 | MFA enforced on: Vercel, GitHub, Atlas, Clerk dashboard, Anthropic, registrar, DNS, mail provider; at least two owners each | F | screenshots/notes of each account's 2FA status |
| S13 | Platform-admin accounts: at most two named people, MFA on in Clerk, `users.role` audited | F | `db.users.find({role:{$in:["Super Admin","Site Admin"]}},{email:1})` shows only expected addresses |
| S14 | Dependency audit: `npm audit --omit=dev` in backend, frontend, marketing has no high/critical without a recorded decision (G24) | D | audit output saved in the release notes |
| S15 | Clerk attack protection on: bot protection, lockout, breached-password check, email verification required | F | Clerk dashboard screenshots |
| S16 | Penetration test or at least a structured self-review of: auth bypass, IDOR across tenants, file access, admin routes, import endpoints | D, third party | written report, findings closed |
| S17 | Public error responses leak nothing (5xx message is "Something went wrong on our side" in production) | D | force an error (bad ObjectId on a 500 path) and read the body; confirmed by `middleware/error.js` |

## 2. Data

| # | Gate | Owner | How to verify |
|---|---|---|---|
| D1 | Customer spreadsheets removed from git and history (G6) | D | `git log --all -- "all jobs 2025 to 2026"` empty after rewrite; force-push coordinated with collaborators |
| D2 | Public sample images removed or replaced with synthetic ones (G6) | D | no personal data visible; static assets list reviewed |
| D3 | Atlas production cluster is dedicated tier with Cloud Backup + PITR on; backup window recorded in the legal checklist | F | Atlas Backup page; value written in `docs/compliance/LEGAL_CHECKLIST.md` |
| D4 | Restore drill done once, timed, counts matched (DEPLOYMENT 15.2) | F, D | dated entry in `docs/RUNBOOK.md` drill log |
| D5 | Independent weekly `mongodump` in a different provider/account, encrypted | F | latest dump file date, restore tested |
| D6 | Indexes created and verified (G5), including `users.email` unique after duplicate check | D | `getIndexes()` output saved; no COLLSCAN on the top 10 endpoints in Atlas Performance Advisor |
| D7 | Tenant stamping complete; `verifyTenantStamps --target=live` exits 0 immediately before each release | D | command output |
| D8 | Blob store is **Private**, region recorded, test upload/view/delete passed on staging and production | F, D | Vercel Storage page; DEPLOYMENT 7 steps |
| D9 | Company export ZIP opens in Excel and contains every module's data; deletion (30-day wait, cancel, purge) tested on staging with `DELETION_GRACE_DAYS=0` | D | tests `dataExport.test.js`, `companyDeletion.test.js` green plus manual run |
| D10 | Retention statements match behaviour: logbook photos never stored; backups age out; auto-delete 30 + 30 days; tombstone note only | D, L | read Privacy/Terms against `docs/plan/DATA_EXPORT_AND_DELETION.md` |
| D11 | Legacy first-customer company stays `legacy` (always writable, never emailed, never auto-deleted) | D | `/api/v2/tenant/me` shows `billing.state: "legacy"` |
| D12 | Staging data is scrubbed or synthetic (DEPLOYMENT 15.3) | D | sample of 20 users: emails not real |

## 3. Authentication and accounts

| # | Gate | Owner | How to verify |
|---|---|---|---|
| A1 | Clerk **production** instance live on `app.yourdomain.com`, DNS records verified, `pk_live_`/`sk_live_` in Production only | F | Clerk dashboard shows "Production, domain verified"; `REACT_APP_CLERK_PUBLISHABLE_KEY` starts `pk_live_` in the built bundle |
| A2 | Organizations enabled; org member limit >= 25; roles `org:admin` / `org:member` | F | create org, invite a member, role shows in the app |
| A3 | Email verification required; sign-up restricted until go-live day; invitations used for beta | F | try signing up with an unlisted email: blocked |
| A4 | Bootstrap tested for: brand-new user + new org; existing legacy user (linked by verified email); user without org; org switch | D | `clerkAuth.test.js` green; manual on staging |
| A5 | First customer's legacy admin signs in via Clerk and their company is adopted as tenant #1 with data intact | F | owner sees the same job counts; `Deliverer.clerkOrgId` set |
| A6 | Platform admin(s) bootstrapped (DEPLOYMENT 10) | F | admin console loads; normal admin gets 403 |
| A7 | Password reset/verification mails from Clerk arrive and are not in spam | F | test with Gmail and Outlook |
| A8 | Session behaviour: sign-out clears; expired token returns the app to login without a loop (the `loadUser` loop bug, see memory) | D | Network tab shows no repeating calls |
| A9 | Clerk-side removal process documented (G13) | O | RUNBOOK entry |

## 4. Billing and plans

| # | Gate | Owner | How to verify |
|---|---|---|---|
| B1 | Prices/bands in `backend/config/plans.js` match the website pricing and Terms | F, D | read both; `billing.test.js` green |
| B2 | A new company starts in `trial` with the right days per band (30/60/90); trial end date visible to the owner | D | smoke test #5 |
| B3 | States behave: trial, active (+7 days grace), read-only (view and download still work), suspended, cancelled | D | manual walk using admin console date changes on staging |
| B4 | Limits enforced: trucks (band moves up, stop above 25), users, AI pages per month | D | create 3rd truck on starter: band moves; 26th truck refused |
| B5 | Admin console: mark paid +30 days, extend trial, suspend/restore, audit trail rows | O | perform each on a staging tenant; check "recent changes" |
| B6 | EcoCash number in reminders is the business number (`PAYMENT_ECOCASH_NUMBER` or default) and the reference instruction (company name) is clear | F | read a real reminder email on staging |
| B7 | Payment collection process written: who checks EcoCash, how often, how it maps to a company, how receipts are sent | F, O | one-page process + a named person |
| B8 | VAT/levy position confirmed (not VAT registered: nothing shown) | A | accountant's written yes/no |
| B9 | Auto read-only then deletion rule (30 + 30 days) is in the Terms and email wording, and tested: read-only company gets the notice, scheduled date set, paying cancels | D | `companyDeletion.test.js`, `billingEmails.test.js`; staging run |
| B10 | Refund and cancellation wording in Terms matches what you will really do | L, F | lawyer sign-off |

## 5. Email

| # | Gate | Owner | How to verify |
|---|---|---|---|
| E1 | Sender domain authenticated: SPF, DKIM, DMARC (start `p=none`, move to `quarantine` then `reject`) | F | mail-tester score >= 9/10; headers show PASS x3 |
| E2 | `SMPT_HOST/PORT/MAIL/PASSWORD` set in Production; port 465 TLS works | F | manual `billing-notices` run on a throwaway company |
| E3 | The four reminder emails read correctly with real data: trial ends in 7 days, trial ended, payment due in 3 days, payment overdue | F | send each to your own inbox |
| E4 | Once-per-date idempotency holds (call the cron twice, one email) | D | `billingEmails.test.js`; manual |
| E5 | Cron failure alerting (G16): you learn within a day if reminders did not send | D | induce a failure, see alert |
| E6 | Bounce/complaint handling process (provider dashboard checked weekly) | O | calendar entry |
| E7 | Clerk's own emails branded and sent from your domain | F | trigger a verification email |
| E8 | Support mailbox exists and is monitored (`support@yourdomain.com` or the WhatsApp line) | O | send a test message and answer it |

## 6. Legal and compliance (Zimbabwe)

Legal facts and questions are in `docs/compliance/LEGAL_CHECKLIST.md`; this table is the launch gate view. Nothing below is legal advice; items marked "UNVERIFIED" in the research notes still need the lawyer.

| # | Gate | Owner | How to verify |
|---|---|---|---|
| L1 | **BLOCKER** Privacy Policy and Terms of Service reviewed by a lawyer and published in final form (no "Draft" banner, indexed, linked from footer and sign-up) | L, F | final text in `marketing/src/content/site.ts`; lawyer's email approval saved |
| L2 | **BLOCKER** POTRAZ registration/licence as data controller (Cyber and Data Protection Act; Form DP1) filed and the outcome recorded; ask whether a processor registration is also needed | F, L | licence number or lawyer's written opinion filed in `docs/compliance/` |
| L3 | **BLOCKER** Cross-border transfer position: data sits with Vercel, Atlas, Clerk, Anthropic (USA/EU); lawyer confirms notification/wording | L | written answer to question 2 in the legal checklist |
| L4 | Vendor DPAs accepted and filed with date: Anthropic, Clerk, Vercel (covers Blob), MongoDB Atlas, mail provider, error-tracking provider | F | PDFs in `docs/compliance/dpas/` (kept out of git if confidential) |
| L5 | Public sub-processor list matches reality (add the error tracker, log drain, uptime tool, analytics) | F | privacy page vs the vendor list |
| L6 | Breach response plan: blanks filled (deputy, lawyer, POTRAZ route), 24-hour regulator / 72-hour individuals confirmed, drill done once | F, L | filled `BREACH_RESPONSE_PLAN.md`; drill note |
| L7 | AI notice and consent (H2): logbook photos go to Anthropic; consent recorded or lawyer says Terms suffice; data-retention terms with Anthropic checked | L, D | stored acceptance, or lawyer's note |
| L8 | Data subject rights process: export (built), deletion (built), contact route (WhatsApp/email) answered within a stated time | O | written procedure; test request |
| L9 | Terms state controller/processor roles for company data (company = controller of its customers' and drivers' data; myFleet = processor) and include a data processing clause | L | clause present |
| L10 | Records of retention: six-year ZIMRA record duty rests on the customer; export is how they keep it; wording says so | L | Terms text |
| L11 | "Not a fiscalised tax invoice" statement on every invoice/quotation PDF and in Terms/FAQ (built) | D | open an invoice PDF |
| L12 | Company/legal entity registered; Terms name the right entity; liability cap wording approved | F, L | registration certificate; lawyer sign-off |
| L13 | Cookie/analytics position: Plausible is cookieless; Clerk sets necessary cookies; no tracking before consent needed | L | policy wording |
| L14 | Liability for fuel/finance figures shown in the app (disclaimer that numbers are the customer's data) | L | Terms |

## 7. Performance

| # | Gate | Owner | How to verify |
|---|---|---|---|
| P1 | Load test: 50 concurrent mixed requests, no 5xx, Atlas connections under half of tier limit | D | k6/Artillery report; Atlas connections chart |
| P2 | Heaviest endpoints timed with a realistic tenant (8k jobs like the first customer): dashboard, jobs list, stats, export, rebuild-stats, invoice PDF | D | table of times; all under 10 s typical, under 20 s worst |
| P3 | Purge/billing crons complete inside 30 s with 50 tenants of test data, or are batched (G16) | D | staging run with seeded demo tenants |
| P4 | Lighthouse (mobile throttled) for marketing: performance >= 90; app login page >= 70 | D | reports saved |
| P5 | Frontend bundle size reviewed; `GENERATE_SOURCEMAP=false` retained | D | build output |
| P6 | Function region and Atlas region chosen together (G18) | F | `vercel.json` / Atlas region matches the decision |
| P7 | Mobile checks on a mid-range Android on 3G/slow 4G: sign-up, add job, upload photo, view invoice | O | video or checklist |

## 8. Observability

| # | Gate | Owner | How to verify |
|---|---|---|---|
| O1 | Health endpoint exists (G2) and uptime monitor checks it every minute with SMS/WhatsApp alert to two people | D, F | pause the function and see the alert |
| O2 | Error tracking on backend and frontend with release tags (G3); alerts on new error types | D | throw a test error on staging |
| O3 | Log drain with at least 30 days of retention; searchable by company id (no PII in logs) | D | find a request by id |
| O4 | Atlas alerts (connections, CPU, disk, failed backup) route to two people | F | Alerts page |
| O5 | Vercel deployment-failed and usage alerts on | F | Notifications page |
| O6 | Cron jobs show last-run success in Vercel; failures alert (G16) | D | Cron Jobs tab |
| O7 | Anthropic spend limit and alert set (G14) | F | console |
| O8 | A daily/weekly business digest (new sign-ups, trials ending, payments due, AI spend) | D | email received |
| O9 | Status/communication channel for outages decided (WhatsApp broadcast or status page) | O | draft message ready |

## 9. Support and operations

| # | Gate | Owner | How to verify |
|---|---|---|---|
| U1 | Support channel, hours and response promises match the website (`TODO(owner)` support hours in `site.ts`) | F | page text matches reality |
| U2 | `docs/RUNBOOK.md` read by everyone on call; contact list filled; escalation path | F | sign-off |
| U3 | Break-glass access: second person can reach Vercel, Atlas, Clerk, DNS, mail | F | they log in during a test |
| U4 | Help content: FAQ, "getting started" checklist (built), how to import a logbook, how to pay by EcoCash | O | links work |
| U5 | Admin-console procedures written: mark paid, extend trial, suspend, restore, export a company's data for them, schedule/cancel deletion | O | steps in RUNBOOK; rehearsed on staging |
| U6 | Customer-onboarding offer actually deliverable: free setup/import within the promised time (marketing copy) | F | do one real trial import end to end |

## 10. Marketing readiness

| # | Gate | Owner | How to verify |
|---|---|---|---|
| M1 | `PUBLIC_APP_URL`, `PUBLIC_SITE_URL` set; no `example.com`/`yourdomain.com` anywhere in the built site (G7) | D | `grep -r "example\.com\|yourdomain" marketing/dist` returns nothing |
| M2 | Every promise on the page exists in the product (playbook section 0.1): trial length, free setup, "first invoice in 24 hours", data export, founding price lock | F, D | line-by-line check against `site.ts` and the product |
| M3 | Real screenshots are of the demo company only (no real clients/plates) | D | review `public/img/shots` |
| M4 | `robots.txt`, `sitemap.xml`, canonical URLs, Open Graph image correct on the final domain | D | `curl https://yourdomain.com/sitemap.xml`; share preview in WhatsApp |
| M5 | "Start free" and "Sign in" reach the app; sign-up works on mobile | D | click-through on a phone |
| M6 | WhatsApp number and prefilled messages work; someone answers | O | send each |
| M7 | Analytics (cookieless Plausible) on or consciously off | F | script present/absent |
| M8 | Social profiles, Facebook/WhatsApp group posting plan, disclosure that you built the tool | F | per `SAAS_PLAN.md` go-to-market |
| M9 | App `noindex`; marketing indexable; Privacy/Terms indexable only when final | D | meta tags |
| M10 | Accessibility/contrast check passes (`npm run check:contrast`) | D | script output |

## 11. Go-live day

Do not go live on a day you cannot watch it for two hours. Pick a weekday morning, not Friday.

| # | Step | Owner | How to verify |
|---|---|---|---|
| T1 | All BLOCKER gates above are ticked; a go/no-go note is written with the date | F | this file |
| T2 | Fresh backup: Atlas snapshot + `mongodump`; counts written down | D | files exist |
| T3 | Last-minute env check: production values (not staging) for `DB_URL`, Clerk keys, `ALLOWED_ORIGINS`, `CRON_SECRET`, `TENANT_GUARD`, SMTP, Blob, Anthropic | F | `vercel env ls production` read aloud by a second person |
| T4 | Merge `development` into `main` by merge commit; wait for both Vercel projects "Ready" (RELEASE_CHECKLIST section 3) | D | deployment list |
| T5 | Smoke test (DEPLOYMENT 13) against production | D, F | table all green |
| T6 | Owner check: legacy company shows `legacy`, `writable: true`; one edit saves and is reverted | F | RELEASE_CHECKLIST 3.3 |
| T7 | Crons listed and test-called with the bearer secret | D | Cron Jobs tab; 200 responses |
| T8 | Clerk: sign-up restriction lifted (or first invitations sent) | F | create a real account |
| T9 | Uptime, error tracking and log drain are green | D | dashboards |
| T10 | Announce (WhatsApp/Facebook) only after T5 to T9 pass | F | |
| T11 | Rollback owner and procedure confirmed (Vercel Promote previous deployment; `TENANT_GUARD=off`) | D | DEPLOYMENT 14 |

## 12. First 72 hours

| # | When | Check | Owner | How to verify |
|---|---|---|---|---|
| H1 | Hour 0 to 2 | Watch Vercel logs live, error tracker, Atlas connections, uptime; stay available | D | no unexplained 5xx |
| H2 | Hour 2 | First external sign-up completes end to end (verification mail, org creation, trial banner, getting started) | F | watch the first one live |
| H3 | Every 4 hours (day 1) | New tenants appear in the admin console with `trial` state and correct end date | O | console |
| H4 | Day 1 | Read all `[tenant-guard]` lines (if still `log`) and any cross-tenant warnings; zero tolerance for data leaks | D | log search |
| H5 | Day 1 | Support inbox/WhatsApp answered within the promised time; log every question (it becomes the FAQ) | O | message log |
| H6 | Day 1 | Anthropic spend vs expectation; per-company AI page counters | F | console |
| H7 | Day 2 | Confirm the 02:00 purge cron and the 06:00 billing-notices cron ran (200, no errors) | D | Cron Jobs tab, logs |
| H8 | Day 2 | Mail deliverability: bounce/spam complaints, DMARC aggregate reports | O | provider dashboard |
| H9 | Day 3 | Performance review: slowest endpoints, Atlas Performance Advisor suggestions, connection peak | D | dashboards |
| H10 | Day 3 | Take a backup, confirm Atlas snapshot ran, note growth in data size | D | Atlas Backup |
| H11 | Day 3 | Retro: incidents, fixes, what changes before widening the audience | F, D | notes in RUNBOOK |
| H12 | Throughout | Keep the rollback path warm: previous deployment still promotable; do not ship unrelated changes during the first 72 hours except hotfixes | D | |

---

## 13. Summary of what blocks "mass-market"

Code: G1 legacy auth live, G2 no health endpoint, G3 no error tracking, G4 ineffective rate limits, G5 missing indexes, G6 customer data in git and publicly served, G7 placeholder-domain fallbacks, G8 no staging, G10 guard defaults off.
Non-code: lawyer-approved Terms and Privacy, POTRAZ, vendor DPAs, breach-plan blanks, restore drill, payment-collection process, second person with access.
