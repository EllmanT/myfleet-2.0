# myFleet: remaining work before a public, multi-tenant launch

Written 2026-11-03 against branch `development` (HEAD `7b7691e`, Phases 0-6 committed, never pushed, never browser-tested). Effort figures are working days for one developer pairing with an AI assistant; they include writing tests but not waiting time (DNS, lawyer, Clerk/Anthropic support, user interviews). Items marked UNVERIFIED are things I could not confirm from the repo or from a source and must be checked before relying on them.

## 0. Honest starting position

What the code review found, beyond the gaps you already listed:

1. **Tenancy is "owner checks", not isolation.** `middleware/tenantAccess.js` guards by-id update/delete (`requireOwnership`) and forces `companyId` on creates, with a fallback to the `Deliverer.*_ids` arrays for unstamped records. Nothing stops a list/aggregate/stats query that forgets a filter from leaking another company's rows. Only 19 models carry `tenantId`; `expense`, `fuelFill`, `vehicleExpense`, `employeeExpenses` use a separate `companyId` field; `rate`, `contractorStats`, `overallStats`, `deliverer`, `user` have neither. Customers are looked up by name across all companies (`controller/customer.js` `findOne({ name })`).
2. **Uploaded files do not survive on Vercel.** `multer.js` writes driver ID/licence uploads to `/tmp` on Vercel (`uploadsDir.js`). That storage is ephemeral per instance, so those documents will silently vanish. Uploads are also no longer served publicly, so there may be no way to view them at all. Needs object storage before any tenant relies on it.
3. **Vercel request body limit.** Vercel functions reject request bodies above roughly 4.5 MB (UNVERIFIED for your plan; check current docs). Multer allows 5 MB and the AI import accepts a photo or PDF. A phone photo will often exceed 4.5 MB, and the failure happens before Express sees it. Photos must be shrunk in the browser first.
4. **Function time.** `vercel.json` sets `maxDuration: 30` for the one function. Whether 30 s is allowed depends on the Vercel plan (UNVERIFIED). A Claude vision call on a handwritten page, a multi-page PDF, import commit, `rebuild-stats` and PDF generation can each approach or exceed it. Nothing is chunked or backgrounded.
5. **Rate limiting is per serverless instance.** `express-rate-limit` uses its default in-memory store; on Vercel each instance has its own counter, so the limits in `middleware/security.js` and the AI `callLimiter` are far weaker than they look. The monthly AI page quota (`AiUsage`, in Mongo) is the only real cost control and is correct, but there is no global spend cap.
6. **Mongo pool.** `db/Database.js` caches the connection (good, commit `4179177`) with `maxPoolSize: 10`. Under concurrent serverless instances this multiplies; Atlas free/shared tiers cap connections (UNVERIFIED exact limit). Lower the pool and monitor.
7. **Clerk roles collapse to two.** `roleForOrgRole` maps `org:admin` to "Deliverer Admin" and every other member to "Deliverer Manager". There is no driver/dispatcher/finance distinction yet, though `financeAccess.js` assumes finance = admin.
8. **Public signup and trial.** `Deliverer.plan` defaults to `"free"`; nothing reads it. No trial end, no limits, no suspension, no super-admin UI. A new Clerk org immediately creates a `Deliverer` (`resolveLocalIdentity`), so anyone who can sign up can create data and (if an admin enables modules) trigger AI cost.
9. **No observability.** No Sentry or structured logging; `console.log` only. `server.js` swallows uncaught exceptions (local only). The Vercel entry (`api/index.js`) returns 503 if DB is down, which is good.
10. **SMTP exists** (`utils/sendMail.js`, env keys misspelt `SMPT_*`) but only for the legacy reset/activation flow; no deliverability setup is evidenced. Clerk sends its own auth emails.
11. **Backfill script rollback gap.** `scripts/backfillTenantId.js` is well designed (dry run default, only fills missing, reports conflicts, `--confirm-live`), but it does not record which ids it stamped, and it connects with `OFFLINE_DB_URL` (local) or `MONGO_URI_LIVE`, so a dry run against a restored copy needs that copy to be addressed through one of those variables. Rollback is therefore "restore the dump", unless item S9 below is done.

## 1. Backlog by workstream

Legend: Effort S = 0.5-1.5 days, M = 2-4 days, L = 5+ days. Risk is the risk of the item going wrong or hurting users, not the risk of skipping it (that is under "why").

Gate tags: **[GATE]** must be done before any stranger can sign up. **[BETA]** must be done before inviting a handful of friendly tenants. **[POST]** can follow public launch.

### A. Security & tenancy

**A1. Query-level tenant enforcement [GATE]** (gap a). L, 6 days.
- Why: today one forgotten filter in any list, aggregate or stats endpoint is a cross-company data leak, and with open sign-up the first leak is a reportable incident and a reputation killer.
- Depends on: R1/R2 (green tests and a browser-verified baseline), A3 (all models carry an owner field).
- Approach: a Mongoose plugin applied to every tenant model, with `AsyncLocalStorage` set in `isAuthenticated` (both Clerk and cookie paths). Pre hooks on `find*`, `count*`, `update*`, `delete*`, `aggregate` (prepend `$match`) and `save` (stamp). Super admins and named system jobs opt out explicitly. Use one field name (`tenantId`) and map the legacy `companyId` models onto it. Ship first in log-only mode on staging (log every query that ran without a tenant), fix the findings, then flip to enforce. Add the compound indexes `{tenantId, ...}` while there.
- Risk: High. Aggregations with `$lookup`, populate paths, scripts and tests that run outside a request, and ALS context surviving across `await` in serverless handlers. Wrong enforcement can hide a tenant's own data ("my jobs disappeared"). Mitigation: log-only first, explicit opt-out helper, one test per route.
- Done when: every model in `backend/model` is either plugin-protected or on a documented allow-list (user, deliverer, counters); a table-driven test iterates every router, creates data as tenant A, and proves tenant B gets 404/empty from every GET, PUT, DELETE and list/stats endpoint; log-only mode on staging shows zero un-scoped tenant queries across a full click-through.

**A2. Customers become per-tenant [GATE]** (gap b). M, 3 days.
- Why: shared customers matched by name means company B's job can attach to company A's customer record, and customer edits or deletes by one company affect another; invoices and statements hang off customers.
- Depends on: A1 plugin design (can run in parallel), backfill dry run.
- Approach: migration that clones any customer referenced by jobs, trips or invoices of more than one tenant into one record per tenant and repoints references; unique index on `{tenantId, normalizedName}`; change `controller/customer.js` and `commitImport` lookups to scope by tenant; report (do not guess) ambiguous cases.
- Risk: Medium-high. It rewrites references on live data. Rehearse on a restored copy and keep a record of old-to-new id mappings.
- Done when: no customer document is referenced by two tenants (checked by a script that exits non-zero otherwise); duplicate-name test across two tenants passes; invoices and statements still show the right names after migration.

**A3. Stamp every remaining collection; scope stats rebuild [GATE]** (gap c). M, 3 days.
- Why: `contractorStats`, `overallStats`, `rate`, `fuelFill`, `expense`, `vehicleExpense`, `employeeExpenses` are not uniformly stamped, and `rebuild-stats` is global, which is both a leak and an easy way to burn the 30 s function limit and Atlas capacity for everyone.
- Depends on: none (feeds A1).
- Done when: all stats documents carry `tenantId`; the rebuild endpoint takes the caller's tenant only, is idempotent, chunked, and returns within the time limit on a tenant with the largest data you have; extended `backfillTenantId.js` (and its test) covers the new collections; `stats` rebuilt for one tenant leaves another's stats byte-identical.

**A4. Retire the legacy cookie login and public `/create-user` signup [GATE]** (gap i, d). M, 2.5 days.
- Why: two login systems double the attack surface; `/create-user` + `/activation` still builds a JWT containing the plaintext password (gap d), and is unauthenticated by design. Leaving it live next to Clerk means a second, weaker path into the product.
- Depends on: every existing real user linked to Clerk (check `User.clerkUserId` populated), one super-admin break-glass method decided.
- Approach: feature flag `LEGACY_LOGIN=false` in prod, then remove routes and the activation token. Keep Super Admin recovery documented (Clerk dashboard plus a script), not a hidden endpoint. If any real user has not migrated, keep legacy login only for them until they have.
- Risk: Medium. Lockout of real users (the owner's staff) during the cutover. Do it after a week of Clerk use on production and with a rollback flag.
- Done when: no route issues a cookie JWT in prod; activation token code deleted; `/create-user` removed or returns 410; the password never appears in any token (grep test); all current staff have signed in via Clerk once.

**A5. Roles and permissions model [BETA]**. M, 2.5 days.
- Why: only "admin" vs "manager" exists; operators will want a driver or read-only/finance split, and finance routes assume admin.
- Done when: a documented role matrix (admin, finance, dispatcher, viewer; drivers later) is mapped from Clerk org roles; each router declares the roles it allows; tests cover a deny case per role; UI hides what the API would refuse.

**A6. Clerk webhooks: user/org deleted, membership removed [GATE]**. S-M, 2 days.
- Why: when a person is removed from an org or deletes their Clerk account the local `User` and tenant membership must follow, and account deletion (L4) needs it. Today the session check relies on token `orgId`, which is good, but local records and `admin_ids` never get cleaned.
- Depends on: Clerk production instance, webhook signing secret in env.
- Done when: signed webhook endpoint (signature verified, idempotent) handles `user.deleted`, `organizationMembership.deleted`, `organization.deleted`; tested with replayed payloads.

**A7. Private file storage for uploads [GATE]**. M, 2.5 days. (new finding 2)
- Why: Vercel `/tmp` is ephemeral; driver ID/licence photos and compliance documents will disappear.
- Approach: Vercel Blob or S3/R2 with tenant-prefixed keys and short-lived signed URLs; direct-to-storage upload from the browser avoids the 4.5 MB body limit too. Migrate any file references in existing records.
- Done when: an upload survives a redeploy; tenant B cannot fetch tenant A's object even with a guessed key; size/type enforced server-side by magic bytes.

**A8. Dependency and config hygiene [GATE]**. S, 1 day.
- Why: pre-launch audit. `npm audit`, remove unused `html2pdf.js` from the backend, pin the SheetJS tarball, confirm `ALLOWED_ORIGINS`/`FRONTEND_URL` in prod, `NODE_ENV` checks (note `app.js` loads dotenv when `NODE_ENV !== "PRODUCTION"` while `Database.js` tests `"production"`; make this consistent), rotate any credential ever committed (Phase 0 note), review `.claude/settings.local.json` is not in git.
- Done when: audit has no high/critical findings; a written list of required env vars matches Vercel.

**A9. Backfill audit trail [GATE]** (supports the push checklist). S, 1 day.
- Why: rollback precision. Make the script write a JSON manifest of every `_id` it stamped (per collection) and support `--rollback=<manifest>` that `$unset`s only those.
- Done when: round trip on a restored copy returns the database to its pre-run state (compare document hashes).

### B. Billing and trial administration

Owner decision (2026-11-03): launch prices are a test of $9 / $29 / $59 per month for three truck bands (1-2, 3-10, 11-25 trucks). First month free for solo operators (1-2 trucks); 2-3 months free for fleets (3+ trucks); no card taken; payment by manual EcoCash/bank invoice, never auto-charged. So "free tier" means a free *trial period per band*, not a permanent free plan; after the trial a tenant moves to read-only until it picks a band and is marked paid. Truck-band limits are the enforcement unit. Per-band user and AI-page allowances are still to be decided (set them from D1 cost data).

**B1. Tenant lifecycle model [GATE]** (gap j). S-M, 2 days.
- Why: `plan` exists (default `"free"`), nothing else does. Replace with an explicit plan band enum `starter` (1-2 trucks, $9), `fleet` (3-10, $29), `pro` (11-25, $59), plus `legacy` for tenant #1. Add `status` (trial, active, read_only, suspended, cancelled, pending_deletion), `trialEndsAt`, `limits` derived from the band (trucks, users, aiPagesPerMonth), `paidUntil`, `planChangedAt`, `notes`. Prices live in one config file (`config/plans.js`) because they are a test and will change; never hard-code them in UI or emails. Trial length is set at creation from the band picked at sign-up (starter 30 days; fleet default 60 days, extendable to 90 by super admin).
- Edge cases to decide and test: tenant exceeds its truck band (block adding a vehicle and prompt a band change; never delete data); upgrading mid-trial keeps the remaining trial; a solo operator who later adds a third truck moves to the fleet band without a second trial; more than 25 trucks is "contact us".
- Done when: new tenants get a band, trial end and limits at creation in `resolveLocalIdentity`; tenant #1 is set to a permanent `legacy`/`active` plan by migration so it cannot be locked out; `GET /tenant/me` exposes band, status, trial days left and limits; tests cover all three bands and the trial-length rules.

**B2. Enforcement middleware and limits [GATE]**. M, 3 days.
- Why: without enforcement the free tier is unlimited and a cost risk.
- Approach: one middleware after `isAuthenticated`: suspended tenants get 403 with a clear code; expired trial gets read-only (GET allowed, writes 402/403 with an upgrade message, data export still allowed); create-vehicle (truck-band cap), invite-user and AI endpoints check limits. Frontend shows a banner with days left.
- Risk: Medium. Mistakes lock paying or friendly customers out. Always allow data export and super-admin access; add a super-admin override flag.
- Done when: tests for each state and each limit; a locked tenant can still export; tenant #1 is demonstrably unaffected.

**B3. Super-admin console [GATE]**. M-L, 4.5 days.
- Why: you cannot operate a public product by editing Mongo. Needs: tenant list (name, owner email, created, last active, vehicle/user counts, status, plan), create/suspend/unsuspend, extend trial, set limits and modules, AI usage and estimated cost per tenant and in total, trigger export, schedule deletion. Impersonation: do not build it; use read-only "view data" only if truly needed, with an audit log.
- Depends on: B1, A6, AiUsage cost fields.
- Done when: every action writes an `AuditLog` row (who, what, tenant, time); the console is reachable only by `Super Admin` and covered by authorisation tests; you can onboard and suspend a test tenant without touching the database.

**B4. AI spend guard [GATE]**. S, 1 day.
- Why: gap in item 5. Add a global monthly page and USD cap with a kill switch env var, cost estimate from `inputTokens`/`outputTokens` using a price table you maintain, an alert when 80 percent used, and per-tenant limits from B1 replacing the single `monthlyLimit()`.
- Done when: setting the global cap to 0 disables AI for everyone within one request; the console shows month-to-date cost; the Anthropic console has a hard monthly budget set as a second line of defence.

**B5. Manual payment recording and plan changes [GATE-lite, needed before the first trial expires]**. S, 1 day. Because billing is manual and trials end within weeks, this cannot wait until after launch. Super-admin marks a tenant paid until a date, sets band, writes an audit row; a monthly "invoices to send" list for you. Automated billing (Paynow/EcoCash recurring) is a later investigation (UNVERIFIED availability).

**B6. Trial and activity emails [BETA]**. S-M, 1.5 days. Trial ending in 7 and 2 days, trial expired, welcome. Depends on R7 (email) and a Vercel cron.

### C. Onboarding and empty states

**C1. Empty-tenant smoke pass [GATE]** (gap l). M, 3 days.
- Why: the whole UI was built and tested on one populated company. A brand-new tenant (zero vehicles, jobs, rates, stats docs) is the first thing every public user sees; division by zero, `undefined.map`, empty charts and blank AG Grid are likely.
- Done when: a fresh tenant clicks through every page (all modules on) with no console errors and no blank screens; each list has a real empty state with a primary action; the dashboard renders with no data.

**C2. First-run wizard and checklist [BETA]**. M, 3 days. Company details, currency, what you haul (drives suggested modules), add first truck/driver/customer, then a "get to first invoice" checklist that persists until done. Depends on C1.

**C3. Invite teammates [BETA]**. S, 1 day. Clerk org invitations, role selection (needs A5), seat limit (B2).

**C4. Import-first onboarding [BETA]**. S, 1.5 days. Downloadable Excel template, the existing vehicle-log import explained with a sample, "send us a photo" path if AI import is enabled.

**C5. Dashboard alerts for expiring documents and overdue services [BETA]** (gap g). M, 2.5 days. API summarising items due within 30/14/7 days from `ComplianceDoc` and `ServicePlan`; dashboard card and nav badge. Email digest is [POST].
- Done when: counts match the underlying lists; respects module toggles and tenant scope; test with expired, due-soon and ok items.

**C6. In-app help and feedback [BETA]**. S, 0.5 day. WhatsApp support link, "report a problem" that captures route and user.

### D. Data and AI quality

**D1. Handwriting accuracy benchmark [BETA, gates marketing claims]** (gap f). M, 3.5 days.
- Why: the extractor is untested on real pages; the plan says no accuracy claims until measured.
- Approach: use the 12 local-log photos and the owner's reviewed Excel as ground truth; script that runs each page through candidate models, compares per field (date, odometer out/in, from, to, driver, contractor), reports exact-match rate, flagged-correctly rate (did low confidence coincide with errors), cost and latency. Decide default model and the "needs human review" threshold. Pass bar to agree beforehand, for example 90 percent of rows needing no edits is probably unrealistic for handwriting; what matters is that errors are flagged and review is faster than typing.
- Depends on: `ANTHROPIC_API_KEY`, ground truth pairing the photos to the Excel rows (some manual work, 0.5 day of it is yours).
- Risk: Medium. Result may be poor; then AI import ships as "beta, always review" and stays off by default (it already is).
- Done when: a markdown report with per-field accuracy and cost per page for at least two models is committed; the default model and thresholds are set from it; the landing page claims only what the report supports.

**D2. Image handling for real phones [GATE for AI-on, BETA otherwise]**. M, 2.5 days. Client-side resize/compress to under about 3 MB, EXIF orientation (ledger photos were sideways), progress and retry UI, one page per request to stay inside function time, clear error on timeout. Server keeps magic-byte validation.
- Done when: a 12 MB phone photo uploads and extracts end to end on a Vercel preview within the time limit.

**D3. Check Anthropic data terms and write the disclosure [BETA]**. S, 0.5 day plus reading. Confirm retention/training terms for the API in use and whether zero-data-retention is needed (UNVERIFIED, read current terms). Feeds L2.

**D4. Cross-border ledger photo reader [POST]** (gap e). L, 6 days. Needs a clear landscape photo of a ledger page (still outstanding per the spec). Schema and review UI already designed in `AI_IMPORT_AND_CROSS_BORDER_SPEC.md`. Honest note: the first target niche is cross-border, so this is attractive, but manual and Excel trip entry already exist; do not block launch on it. Offer as a labelled beta after launch for the first fleets.

**D5. Tenant aliases learned from review decisions [POST]**. M, 3 days.

**D6. Money and document correctness review [BETA]**. S-M, 2 days. Test PDFs of quotation, invoice, statement at edge cases (long names, many lines, rounding, multi-currency); have an accountant check numbering and tax fields. State clearly in the product that documents are not fiscalised tax invoices unless you verify local fiscal rules (UNVERIFIED; ZIMRA requirements for invoicing software are not established in this plan).

**D7. Fix the two failing tests [GATE]** (gap h). S, 0.5-1 day. `backend/tests/jobStatsSync.test.js`: determine whether the tests or the stats code are wrong; do not skip them. Stats drift is a correctness bug that customers will notice.

### E. Reliability and operations

**E1. Release readiness: green tests, CI, staging [GATE]**. M, 3 days (Week 1).
- Run the full `jest` suite; fix failures including D7; add a GitHub Action running backend tests and `npm run build` for the frontend on every push to `development` and `main`.
- Create staging: a separate Atlas database (or cluster), a Vercel preview environment with its own env vars, and a Clerk development instance. Production uses a separate Clerk production instance. (k) set all Vercel env vars: `DB_URL`, `JWT_SECRET_KEY` (still needed while legacy login exists), `ACTIVATION_SECRET`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`/frontend equivalent, `ALLOWED_ORIGINS`/`FRONTEND_URL`, `ANTHROPIC_API_KEY`, SMTP vars, storage token, `MONGO_URI_LIVE` only on a trusted machine, never in Vercel.
- Done when: CI is green on `development`; staging URL works with Clerk sign-in; a documented table of env vars per environment exists.

**E2. Browser verification of Phases 0-6 on staging [GATE]**. M, 3-4 days (Week 1-2).
- Why: seven phases are untested in a browser. Expect a meaningful bug list. Walk each module as a new tenant and as tenant #1 with copied data; record bugs in a list and fix by severity.
- Done when: a written checklist, one line per page and per create/edit/delete/PDF/import action, all ticked on staging; zero known data-loss or wrong-number bugs.

**E3. Serverless hardening [GATE]**. M, 3 days.
- Move rate limiting to a shared store (Mongo or Upstash Redis) or accept and document that limits are approximate and rely on Clerk's own bot protection; lower `maxPoolSize` to about 3-5 and verify connection counts under a 20-user load test; chunk or background any endpoint that can exceed the function limit (stats rebuild, import commit, export); confirm PDF generation cold start and memory for a 100-line invoice; confirm `maxDuration` is honoured on your plan (UNVERIFIED).
- Done when: a simple load test (for example 50 concurrent mixed requests) shows no 5xx and Atlas connections stay under half of the tier limit; each long endpoint has a measured worst-case time under 20 s.

**E4. Error tracking, logging, uptime [GATE]**. S, 1.5 days. Sentry (or equivalent) on frontend and backend with release tags and tenant id (not personal data) as a tag; replace `console.log` in controllers with a small logger; Vercel log drain or at least saved queries; an uptime check on `/api/v2/health` (add) and on the main page; an alert route to your phone/email.
- Done when: a deliberately thrown error shows up in Sentry within a minute with a useful stack; you receive an uptime alert when the DB is made unreachable on staging.

**E5. Backups and restore drill [GATE]**. S-M, 1.5 days.
- Why: you will hold customers' financial records. Atlas free/shared tiers may not include continuous backup (UNVERIFIED for your tier); the plan may need a paid tier or a scheduled `mongodump` to external storage.
- Done when: automated daily backups exist, retention is written down, and you have restored one into a scratch database and run the app against it (a drill, not an assumption).

**E6. Email sending [BETA]**. S, 1 day plus DNS wait. Choose a transactional provider (Resend, Brevo, Postmark; UNVERIFIED pricing), verify the sending domain with SPF/DKIM/DMARC, rename env keys from `SMPT_*` to `SMTP_*` with a fallback, send test mail to Gmail and Outlook inboxes (not spam), provide a from address such as no-reply plus reply-to support. Clerk's own emails need their sender configured on the production instance.

**E7. Indexes and performance [BETA]**. S, 1 day. Compound indexes with `tenantId` first on the hot paths (jobs by date, invoices by status, stats), `explain()` on the five slowest list endpoints with a synthetic 50,000-job tenant.

**E8. Environment-specific safety [BETA]**. S, 0.5 day. Scripts that can write (`seed`, `import*`, `migrateToAtlas`) refuse to run unless an explicit target flag is passed (the backfill script already does).

### F. Design revamp

Owner decision: the dashboard palette moves to ink and ivory with a deep green accent. Define it once as design tokens (CSS variables plus the MUI theme in `frontend/src/theme.js`), with contrast checks (ink on ivory, green on ivory and white, disabled and error states), a decision on dark mode (light only at launch unless tokens make dark cheap), and AG Grid theme alignment (a past commit fixed an AG Grid theming conflict).

Use the always-on design skills (`ui-ux-pro-max`, `impeccable`, `emil-design-eng`) per the user's standing instruction; run `impeccable` checks before calling each item finished.

**F1. Mobile-first usability pass [BETA]**. M, 3 days. Operators and drivers use phones. Make job entry, trip view, photo upload and the dashboard usable at 360 px; AG Grid views need a card or condensed fallback.

**F2. Ink/ivory/deep-green tokens and app shell [BETA for tokens, POST for full shell]**. M, 3 days. Do the token and theme swap early (about 1 day) because marketing screenshots (G2, G2b) must come from the final palette; nav regrouping and logo can follow. Consistent type scale, module-off items hidden, brand name applied.

**F3. Dashboard revamp [POST]**. L, 5 days. Replace chart-first layout with "what needs attention today": unpaid invoices, expiring documents, services due, trips this week, profit. Depends on C5.

Honest call: the revamp is the most deferrable item. Empty states (C1) and mobile (F1) are launch-relevant; the visual overhaul is not. Do F2/F3 after launch unless Week 7 has slack.

### G. Landing page and marketing

**G1. Name, domain, logo, positioning decision [BETA]**. S, 1 day of your time, lead time on the domain. "myFleet" may not be available as a trademark or domain (UNVERIFIED); check before building brand assets. Needed for legal pages, email domain and Clerk branding.

**G2. Marketing site: separate Astro project [BETA to publish, GATE for marketing]**. M, 4-5 days. Owner decision: a separate static site in `marketing/` (Astro) with its own Vercel project and domain (apex for marketing, `app.` subdomain for the product). Rationale: no coupling to the CRA bundle and the root `vercel.json` (which rewrites every path to the SPA, so the marketing site must not share that project), fast on poor mobile connections, independent deploys. Order from `SAAS_PLAN.md`: hero, proof, problem, demo, how it works, pricing, FAQ, repeated CTA. Sign-up buttons go to the app's Clerk sign-up; the second CTA is WhatsApp. Follow `docs/research/landing-page-design-direction.md`. Honest claims only: no AI accuracy figure until D1; Allea testimonial only with permission and the disclosure that it is the founder's own fleet business; screenshots labelled "Demo company".
- Risk: Clerk allowed redirect URLs and CORS across two domains; analytics consent (H6).
- Done when: Lighthouse mobile result on a throttled connection is recorded; sign-up, WhatsApp, Terms and Privacy links work in production; the app URL is configured in one place.

**G2b. Seed demo tenant script with reset [BETA]**. M, 2.5 days. New script `backend/scripts/seedDemoTenant.js` (to be built; nothing built now) creating a flagged demo company with invented but plausible data: trucks and trailers (invented plates), drivers, customers, rates, about 3 months of jobs, cross-border trips with costs, quotations, invoices in every state (paid, part-paid, overdue for the ageing view), payments, expenses, fuel fills, compliance documents (some expiring, to light up C5), service plans and tyres. Requirements: deterministic with a seed value so screenshots are reproducible; `--reset` deletes only documents carrying the demo `tenantId` and re-seeds, using A1 scoping so it cannot touch another tenant; refuses `live` without `--confirm-live` and refuses to reset any tenant not flagged `isDemo: true`; `isDemo` tenants are excluded from usage stats, billing, trial emails and counts; optional read-only demo login for sales calls. Depends on A1, C1 findings, F2 palette.
- Done when: `--reset` twice gives identical counts; the demo tenant clicks through every module without errors; marketing screenshots are generated from it; a test proves reset leaves a second tenant untouched.

**G3. Pricing page and free-tier terms [BETA]**. S, 1 day. Reflects B1 limits.

**G4. Demo video and lead magnets [POST]**. M, 3 days. Short Remotion demo; trip profit calculator; "send one logbook photo, get an invoice".

**G5. Analytics and SEO basics [BETA]**. S, 1 day. Privacy-friendly analytics (consent per L5), titles, OG image, sitemap, robots.

**G6. Operator interviews and founding-member outreach [parallel, not developer time]**. Start Week 1: 10-15 interviews (TOAZ, WhatsApp groups, your contacts), 3-5 friendly beta tenants lined up for Weeks 6-7. This is the biggest launch-risk reducer and the plan has no validated pricing yet.

### H. Legal and compliance

I am not a lawyer; the Zimbabwe data-protection law (Cyber and Data Protection Act, 2021) and any registration duty with the regulator are UNVERIFIED here. Get a short lawyer review of items H1-H3 (budget for it).

Source for this workstream: `docs/research/legal-and-compliance-notes.md` (research, not legal advice; many items UNVERIFIED there). Its Tier 1 list is the legal part of the launch gate: lawyer review, POTRAZ licence, accepted terms at sign-up, AI notice and consent, vendor DPAs, ZIMRA non-fiscal statement, breach plan, company/tax/bank readiness.

**H0. POTRAZ data controller licence (Form DP1) [GATE]**. Small effort, long lead time (research: POTRAZ has 14 days to decide; fees unknown). Start in Week 1. Needs a legal entity, a named DPO or contact (lawyer to say whether the founder may act), a declaration that data is stored offshore (Vercel, Atlas, Clerk, Anthropic) and the tier. Ask the lawyer whether myFleet also needs a licence as processor of customer data. Done when: licence granted, or a written lawyer opinion that none is needed yet, filed in the repo's compliance folder. Risk: the research reports POTRAZ enforcement from 1 September 2026 (UNVERIFIED), so an unlicensed launch is a real exposure.

**H0b. Vendor data-processing terms [GATE]**. S, 1 day plus waiting. File accepted DPAs for Anthropic, Clerk, Vercel, MongoDB Atlas, the email provider and file-storage provider; choose and record the Atlas region deliberately (changing it later is a migration). Done when: each DPA is stored with its acceptance date and the public sub-processor page (H3) matches.

**H0c. Breach response plan [GATE]**. S, 1 day. Research working standard: notify POTRAZ within 24 hours and affected individuals within 72 hours (lawyer to confirm). One page: who decides, notification template, POTRAZ contact route, evidence checklist (Sentry and Vercel logs, audit rows). Do a 30-minute tabletop drill. Done when: plan exists, contact route verified, drill done.

**H0d. Lawyer review [GATE]**. Mostly waiting. Send Terms, Privacy Policy, DPA clause, AI notice, trial/refund wording, liability cap and the invoice non-fiscal statement by end of Week 3 so comments return by Week 6. Budget for it. Also resolve the research's open questions: controller vs processor role, cross-border transfer notification, retention periods, record-only payments needing no RBZ licence, VAT on USD SaaS (with an accountant).

**H1. Terms of Service and Privacy Policy [GATE]**. S-M, 2 days plus review. Who is controller/processor, what is stored, retention, where data is hosted, sub-processors, contact, free-tier terms, liability limits, acceptable use, suspension and deletion rules. Linked in the sign-up flow with an acceptance record (timestamp and version on the `User`).

**H2. AI notice at upload and consent record [GATE for AI-on]**. S-M, 1.5 days. Use the one-line notice from the research at the upload control (photos go to Anthropic in the US to read the handwriting; you review before saving; link), a stored acceptance (user, tenant, time, notice version) at first use, and the per-company AI toggle (the `aiImport` module already is one). Say provider retention is "up to 30 days" and re-check for the model used. Add a logbook-photo retention job (research suggests deleting originals 30-90 days after import confirmation) and a "delete this upload" action. In the import UI and policy: photos are sent to a third-party AI provider, what is retained, that results must be reviewed, that the customer must have the right to upload third-party personal data (drivers' names in logs). Depends on D3.

**H3. Sub-processor list and DPA [BETA]**. S, 1 day. Clerk, Vercel, MongoDB Atlas, Anthropic, email provider, Sentry, storage.

**H4. Data export, "take your data with you" [GATE]**. M, 3 days.
- Why: it is a stated promise in the offer. Also protects you under expired-trial and cancellation flows.
- Approach: tenant-scoped export producing CSV/JSON per entity (jobs, trips, customers, vehicles, drivers, invoices, payments, expenses, documents list) in a zip; generated in chunks or per-entity downloads to respect function time; documents/files linked via signed URLs; available at any tenant status (B2).
- Done when: export of tenant #1's full data completes inside limits, re-importing a sample into a fresh tenant works for jobs and customers, and an export of tenant B never contains tenant A rows (covered by the A1 matrix).

**H5. Account and tenant deletion [GATE]**. M, 2.5 days.
- Why: privacy-law expectation and a trust signal. Soft delete with a grace period (for example 30 days), then purge of tenant data, files, Clerk org and users, AI usage rows; keep what you must for statutory reasons only (ask your accountant; invoice retention periods are UNVERIFIED).
- Depends on: A6, A7, H4 (offer export first).
- Done when: a scripted deletion of a test tenant leaves no documents with its `tenantId` in any collection (checked by a script that scans all collections) and no blobs under its prefix.

**H5b. Invoice non-fiscal statement [GATE]**. S, 0.5 day. Per the research, myFleet invoices and quotations are business documents, not ZIMRA fiscalised tax invoices. Put the statement in the Terms, on the invoice/quotation screens and in the PDF footer (D6). Done when it appears on every generated PDF.

**H5c. Minimise driver ID numbers [BETA]**. S, 1 day. Make national ID fields optional, mask in the UI, admin-only (A5).

**H6. Cookie and tracking notice [BETA]**. S, 0.5 day. Only if analytics or non-essential cookies are used.

**H7. Support contact, abuse and security contact, incident process [BETA]**. S, 0.5 day. A written one-page plan: who is told, within what time, if a leak happens.

## 2. Recommended order and reasoning

Principles: (1) find out what is broken before building on it; (2) isolation, storage and abuse controls come before any stranger can sign up; (3) things that only matter once people are paying or marketing can follow; (4) legal text and data-export are cheap relative to the harm of missing them.

**Must precede any public sign-up (the gate):** E1, E2, E3, E4, E5, D7, A1, A2, A3, A4, A6, A7, A8, A9, B1, B2, B3, B4, B5, C1, H0, H0b, H0c, H0d, H1, H2 (if AI on), H4, H5, H5b.

**Must precede inviting friendly beta tenants (private, not public):** subset of the above (A1 in log-only is acceptable only with trusted, non-competing testers; A2 and A3 should be done), plus C2, C3, C5, E6, F1.

**Can follow public launch:** B5, D4, D5, F2, F3, G4, automated billing, email digests, richer roles, payroll/advanced analytics modules, fiscal compliance work.

Reasoning on notable ordering choices:
- **Verify before extend (Week 1).** Every later item assumes Phases 0-6 work. Seven untested phases is the single biggest schedule risk.
- **A1/A2/A3 before billing and onboarding.** Tenancy changes touch every query; building the console and onboarding first would mean re-testing them after the plugin lands.
- **A7 (file storage) and E3 (serverless) before beta.** Both fail silently in production (files vanish, large photos are rejected) and would first be noticed by a customer.
- **Billing before marketing, but kept minimal.** The free tier needs limits and a kill switch, not payment automation.
- **AI is optional at launch.** `aiImport` defaults off for new tenants (`newTenantDefault: false`). If D1/D2/H2 slip, launch with AI import hidden rather than delay everything. This is the main scope valve.
- **Design revamp is the lowest-value launch item.** Do it last.
- **Legal and interviews run in parallel**, because they are mostly waiting time.

## 3. "Safe to launch" gate (minimum)

Do not open public sign-up until every line is true:

- [ ] `jest` is green (no skipped failures); CI runs on every push; frontend build passes.
- [ ] Phases 0-6 verified in a browser on staging as both a new empty tenant and tenant #1 data; signed checklist in the repo.
- [ ] Cross-tenant test matrix passes for every route; query-level scoping enforced (not log-only) in production; no customer shared between tenants.
- [ ] Backfill applied to production, post-run verification script shows zero unstamped tenant documents and zero conflicts.
- [ ] Legacy password login and public activation disabled in production; no plaintext password in any token.
- [ ] Uploads in private object storage; an upload survives redeploy; cross-tenant fetch fails.
- [ ] Tenant lifecycle enforced: trial end, limits, suspend; super-admin console works; tenant #1 cannot be locked out.
- [ ] AI import either off for all, or: spend cap and kill switch live, Anthropic hard budget set, D1 benchmark committed, photo resize works on a real phone.
- [ ] Monitoring: errors reach you, uptime alerts reach you, you have an incident contact page.
- [ ] Backups run daily and one restore has been rehearsed.
- [ ] Terms, Privacy Policy and AI disclosure published and accepted at sign-up (acceptance timestamp and version stored); data export and deletion work end to end.
- [ ] Lawyer has reviewed Terms, Privacy Policy, DPA clause, AI notice and trial/refund wording; comments incorporated.
- [ ] POTRAZ data controller licence granted (Form DP1), or a written lawyer opinion that none is needed yet.
- [ ] Accepted vendor data-processing terms filed for Anthropic, Clerk, Vercel, MongoDB Atlas, email provider and file storage; Atlas region chosen and recorded; public sub-processor list matches.
- [ ] AI notice shown at the upload control, consent recorded, per-company AI toggle works (or AI import is off for everyone).
- [ ] Breach response plan written (POTRAZ 24-hour clock, named decision maker, template) and drilled once.
- [ ] Invoices and quotations carry the "not a ZIMRA fiscalised tax invoice" statement.
- [ ] Trial and plan limits match the owner's bands ($9 / $29 / $59 for 1-2 / 3-10 / 11-25 trucks; free first month for solo, 2-3 months for fleets), shown identically on the pricing page, in the app and in the Terms; nothing is ever charged automatically.
- [ ] Company registration, tax registration and a bank/EcoCash receiving account exist; accountant has given a view on VAT and USD receipts.
- [ ] Email delivery verified to Gmail/Outlook inboxes for invites and trial notices.
- [ ] All Vercel production env vars set and documented; separate Clerk production instance; no development keys in production.
- [ ] Empty tenant experience has no blank or erroring page.
- [ ] You have personally walked through sign-up, onboarding, first job, first invoice, export, deletion on production with a throwaway account.

## 4. Checklist before pushing `development` to `main` (production deploy)

Note: pushing to `main` deploys to the live system that the owner is using today. Real data is in production. With Clerk keys unset, `clerkConfigured()` is false and the cookie login keeps working, and ownership checks fall back to the `*_ids` arrays when `tenantId` is missing, so a deploy before the backfill should be functional but is not yet tested that way; test exactly that state on staging.

Before the merge:
1. CI green; `jest` green including the two previously failing tests fixed, not skipped.
2. Staging has run the merged code against a **restored copy** of production data for at least several days with the owner's real workflows (jobs, imports, fuel, expenses, PDFs).
3. Diff review of schema changes: new required fields and unique indexes. `autoIndex` can build indexes on first connect in production; new unique indexes on existing data can fail or lock. Create indexes deliberately and in the background, and check for duplicates first.
4. Production env vars added **before** merge (see E1), but leave Clerk keys unset until the backfill is verified if you want the least-surprise first deploy; then add keys as a separate step.
5. Record the current production deployment id in Vercel (instant rollback target).
6. Announce a maintenance window to the owner; pick a low-traffic time.

Backfill dry-run and apply procedure (`backend/scripts/backfillTenantId.js`):
1. **Backup.** `mongodump` the live database to a dated folder, copy it off the machine, and also take an Atlas snapshot if the tier allows. Write down document counts per collection.
2. **Restore to a scratch database** (local `mongod` or a throwaway Atlas database) with `mongorestore`. Never run the first dry run directly on live.
3. **Dry run on the copy.** Point `OFFLINE_DB_URL` at the scratch copy and run `node scripts/backfillTenantId.js --target=local`. Read the report: `wouldStamp` per collection, `conflicts`, `orphans`.
4. **Resolve conflicts and orphans by hand** (records claimed by two companies; records no company claims). Decide for each; do not let the script guess. Re-run until conflicts are zero or consciously accepted.
5. **Apply on the copy** (`--apply`), then run it a second time and confirm it changes nothing (idempotence), and confirm counts of documents are identical to step 1 (nothing deleted). Run the app test suite and a browser click-through against the copy; run the A1 log-only mode and the cross-tenant matrix.
6. **Dry run on live** (`--target=live`, no `--apply`) using `MONGO_URI_LIVE`; the report should match the copy's report. If it differs materially, stop and investigate (data changed since the dump).
7. **Apply on live**: `--target=live --apply --confirm-live`, ideally with A9 (manifest of stamped ids) in place. Re-run to confirm zero changes. Compare per-collection counts to step 1.
8. **Verify**: script checking zero documents without `tenantId` in tenant collections, and a spot check of three jobs, three customers, and one stats document in the app.

Rollback:
- Code: Vercel "Promote previous deployment" to the recorded deployment id (seconds). The backfill only **adds** `tenantId`, which old code ignores, so code rollback does not need a data rollback.
- Data (backfill): with the A9 manifest, `$unset` `tenantId` on exactly the ids it stamped. Without A9, the only exact rollback is restoring the pre-backfill dump, which also loses anything written since. Once public sign-ups exist, never "unset all tenantIds"; that would orphan new tenants' data. This is why the backfill must run before launch, not after.
- A2 (customer split) is the one migration that rewrites references; rehearse it on the copy, keep its old-to-new id map, and restore from the dump if verification fails.
- Clerk: if linking goes wrong, unset the Clerk keys in Vercel to fall back to cookie login (valid only until A4 retires it; do A4 only after a stable period).

## 5. Timeline: 8 weeks, 2026-11-03 to 2026-12-28

Capacity assumption: about 5 productive days per week; December in Zimbabwe has holidays and many customers slow down from about 20 Dec (UNVERIFIED but likely), so I target the **public free-tier launch on about 15-17 December**, leaving Week 8 as buffer and as a "quiet launch" week. Sum of gate items is now roughly 45-50 working days (the legal gate items and demo seed add about 5, mostly waiting time), so the plan is **tight but plausible only if the scope valves below are used**.

| Week | Dates | Focus | Exit criterion |
|---|---|---|---|
| 1 | Nov 3-9 | E1 CI/staging/env vars, D7 fix tests, start E2 browser pass, A8 hygiene, G6 start interviews, order domain/name check (G1), start H0 POTRAZ application and engage a lawyer | CI green; staging up with Clerk dev; first bug list from browser pass |
| 2 | Nov 10-16 | Finish E2 bug fixes; A3 stamp remaining collections and scope stats; A9 manifest; backup + dry run of backfill on restored copy | Staging walk-through ticked; backfill dry-run report with conflicts understood |
| 3 | Nov 17-23 | A1 query-level enforcement (log-only then enforce), cross-tenant matrix; A2 customers split on the copy; send legal drafts to lawyer (H0d); F2 palette token swap to ink/ivory/deep green (1 day) | Matrix green; zero un-scoped queries in log; A2 verified on copy |
| 4 | Nov 24-30 | A7 storage; E3 serverless hardening; E4 observability; E5 backups and restore drill; **production backfill + A2 on live, merge `development` to `main`** per Section 4 | Production on new code, tenantId complete, monitoring live |
| 5 | Dec 1-7 | B1-B5 lifecycle with three plan bands, enforcement, super-admin console, AI spend guard; A4 retire legacy login (after a stable week on prod); A6 webhooks; E6 email | Create, suspend and extend a test tenant from the console |
| 6 | Dec 8-14 | G2b seed demo tenant and screenshots, H0b DPAs, H0c breach plan, C1 empty states, C2 wizard, C3 invites, C5 alerts, F1 mobile; H1-H3 drafted and sent for review; H4 export; D2 photo handling; D1 benchmark if key available | Private beta with 3-5 friendly tenants starts (from about Dec 10) |
| 7 | Dec 15-21 | H5 deletion, G2 Astro marketing site on its own Vercel project, G3 pricing, G5 analytics, beta fixes, final gate review. **Go/no-go on Dec 17.** | Gate checklist (Section 3) fully ticked |
| 8 | Dec 22-28 | Public free-tier launch if go; otherwise buffer. Monitor, fix, support. No new features. | Launch live, or a written list of what slipped |

Scope valves, in the order to pull them:
1. Launch with AI import **off** for new tenants (skip D1/D2/H2 as gates; ship as invite-only beta in January).
2. Drop F3 dashboard redesign and the full F2 shell (already post-launch); keep only the palette token swap so screenshots match. G2b can be trimmed to a smaller data set if screenshots are its only use.
3. Defer A5 roles (admin + manager only) and C3 invites beyond admin plus one manager.
4. Defer C2 wizard to a short checklist card.
5. If A1 slips past Week 4, **do not launch publicly**; run an invite-only beta with trusted tenants instead. Do not trade away A1, A2, A4, A7, H1, H4, H5, E5.

## 6. Biggest risks, ranked

1. **Cross-tenant leak (A1, A2, A3).** Highest consequence. Mitigation: enforce at query level, a route matrix, log-only first, and an invite-only beta before going public.
2. **Untested surface (E2).** Seven phases of unrun UI. Mitigation: Week 1 is spent on verification; expect 2-3 extra days of fixes.
3. **Live migration mistakes (backfill, A2).** Mitigation: backup, scratch-copy rehearsal, manifest, one change at a time, owner-notified window.
4. **Silent serverless failures (A7, D2, E3).** Lost uploads, over-size bodies, timeouts, rate limits that do not limit. Mitigation: test on a Vercel preview, not just locally.
5. **AI cost and accuracy (B4, D1).** Cost is bounded by the quota/caps; accuracy is unknown. Mitigation: off by default, benchmark before any claim.
6. **Schedule.** About 45-50 gate-days in about 40 working days with December slowdown, plus a single developer. The plan assumes no major Clerk or migration surprises. If Week 4's production merge slips by a week, launch moves to January; say so early rather than cutting the gate.
7. **Market risk, not code.** Pricing and willingness to pay are unvalidated; a free-tier launch is the right way to learn, but do the interviews (G6) in parallel from Week 1.
