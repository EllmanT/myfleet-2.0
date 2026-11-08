# myFleet deployment guide (production and staging)

Written 2026-11-08 from the code on branch `development` (HEAD `c0b961a`). Everything here was derived from the repo; nothing was run against live services. Statements about vendor dashboards (Vercel, Atlas, Clerk, DNS hosts) describe how those products worked when this was written. Menu names change, so treat them as a guide and check the vendor's current docs where a step says VERIFY.

Companion documents: `docs/PRODUCTION_CHECKLIST.md` (go/no-go gates and the list of code gaps), `docs/RUNBOOK.md` (what to do when something breaks), `docs/plan/RELEASE_CHECKLIST.md` (the release that moves `development` to `main`), `docs/HOSTING.md` (the two-project layout), `docs/plan/TENANT_GUARD_ROLLOUT.md`, `docs/compliance/*`.

Conventions: commands run from the repo root in Git Bash unless a `cd` is shown. `<angle brackets>` are values you fill in. Never paste a real secret into a file that is committed.

---

## 0. Architecture in one page

```
                       yourdomain.com / www        app.yourdomain.com
                       (Vercel project 1)          (Vercel project 2)
  Browser  ----------> marketing/ (Astro, static)  frontend/ (React CRA, static)
                                                   + api/index.js (Express, serverless, 30 s max)
                                                        |        |         |          |
                                                    MongoDB   Vercel    Clerk      SMTP server
                                                    Atlas     Blob      (sign-in)  (reminder mail)
                                                              (private            Anthropic API
                                                               files)             (logbook photo read)
  Vercel Cron --> GET /api/v2/tenant/purge-due       02:00 UTC daily, Bearer CRON_SECRET
  Vercel Cron --> GET /api/v2/tenant/billing-notices 06:00 UTC daily, Bearer CRON_SECRET
```

Facts that shape the steps below (all checked in code):

- The API is one Express app (`backend/app.js`) wrapped by `api/index.js`. Every `/api/*` request is rewritten to it (`vercel.json`). It connects to Mongo once per warm instance and answers `503 Database unavailable` if it cannot.
- Production auth is Clerk. The browser sends a Clerk session token as `Authorization: Bearer ...`; the server verifies it (`clerkMiddleware`) and maps the Clerk organization to a company (`Deliverer.clerkOrgId`). **Cookies are not used by Clerk sign-in**, so the cookie / SameSite questions only concern the legacy password login (see section 8).
- The legacy email-and-password login still exists in the backend (`/api/v2/user/login-user`, `create-user`, `activation`, `forgot-password`, `reset-password`) and the cookie fallback in `middleware/auth.js` still works whenever `JWT_SECRET_KEY` is set. This is a launch gap (see `PRODUCTION_CHECKLIST.md`, G1).
- `backend/db/Database.js` picks the database by `NODE_ENV`: `production` uses `DB_URL`, anything else uses `OFFLINE_DB_URL`. **Vercel sets `NODE_ENV=production` on Preview deployments as well as Production.** So a Preview deployment uses whatever `DB_URL` is set for the Preview environment. If Preview has no `DB_URL` of its own it inherits nothing (it fails with 503). If you copy the production value into Preview, Preview writes to live data. Sections 2 and 3 deal with this.
- `.env` loading: `app.js` and `server.js` load `backend/config/.env` only when `NODE_ENV !== "PRODUCTION"` (upper case). On Vercel `NODE_ENV` is lower-case `production`, so dotenv runs, finds no file, and does nothing. Harmless. Vercel's own environment variables are what count.

---

## 1. Prerequisites

| Need | Detail |
|---|---|
| Domain | One you control, DNS access to it. Used below as `yourdomain.com` and `app.yourdomain.com`. **Replace these literally everywhere** (list in section 17). |
| GitHub | The repo, with `main` as the production branch and `development` as the working branch. |
| Vercel | **Pro plan or higher for production.** Hobby is restricted to non-commercial use, and the cron jobs, the 30 s function limit and log retention differ by plan. VERIFY current limits. Two projects will be created. |
| MongoDB Atlas | Organization and project. A paid dedicated tier for production (section 4). |
| Clerk | Two instances: Development (staging) and Production. A production instance needs your own domain. Organizations must be enabled. |
| SMTP mailbox | The reminder emails are sent as the mailbox itself (`from = SMPT_MAIL`). Today that is the Echo Africa mailbox. A transactional provider (Resend, Postmark, SES, Brevo) is better at scale (section 7). |
| Anthropic | Console account, an API key, spend limit set. Needed only for AI logbook import. |
| Local tools | Node 20 (CI uses 20), npm, Git, `mongosh` and MongoDB Database Tools (`mongodump`, `mongorestore`), Vercel CLI (`npm i -g vercel`), optional `gh`. |
| People | One owner with access to every account above, plus a second person with break-glass access (section 18). Do not run a paid product on one person's login. |

Check the toolchain:

```bash
node -v        # v20.x
npm -v
git --version
mongosh --version
mongodump --version
vercel --version
```

Run the tests before any release (CI does the same):

```bash
cd backend && npm ci && npx jest --runInBand
cd ../frontend && npm ci && CI=false npm run build
cd ../marketing && npm ci && npm run build
```

---

## 2. Environments

Three environments, three of everything that holds state.

| | Local | Staging | Production |
|---|---|---|---|
| Git branch | any | `development` (Vercel Preview) | `main` |
| Vercel project | none | same app project, **Preview** scope (or a dedicated `myfleet-staging` project, see 2a) | app project, **Production** scope |
| URL | localhost:3000 / :5050 | `https://staging-app.yourdomain.com` (alias) | `https://app.yourdomain.com` |
| MongoDB | local `OFFLINE_DB_URL` | **separate Atlas cluster or at least a separate database + separate DB user**, name `myfleet-staging` | production cluster, database `myfleet` |
| Clerk | development instance | **Development instance** (`pk_test_`, `sk_test_`) | **Production instance** (`pk_live_`, `sk_live_`) |
| Blob store | disk (`uploads/`) | its own Blob store | its own Blob store |
| Anthropic key | optional | separate key with a low spend limit | production key |
| SMTP | off or Mailtrap-style sandbox | sandbox mailbox (never real customers) | production mailbox |
| `CRON_SECRET` | n/a | different value (crons do not run on Preview anyway; call by hand) | production value |

### 2a. Create staging (it does not exist yet)

Two valid shapes. Pick one.

**Shape A (recommended, least work): Preview scope of the existing app project.**

1. Vercel, app project, Settings, Environment Variables. For every variable in section 3 that is marked "differs in staging", add it with **only the Preview checkbox ticked** (untick Production and Development). Never copy a production secret into Preview.
2. Settings, Git: leave "Production Branch" as `main`. Every push to `development` then builds a Preview deployment.
3. Give the `development` branch a stable URL: Settings, Domains, Add `staging-app.yourdomain.com`, and under "Git Branch" choose `development`. Add the CNAME at your DNS host (section 6).
4. Create the staging database (section 4.9) and the Clerk development instance (section 5.7).
5. Protect it: Settings, Deployment Protection, enable "Vercel Authentication" for Preview so strangers cannot sign up on a test database. Clerk's development instance still works behind it for you and your testers (they sign in to Vercel first).

**Shape B: a second Vercel project** (`myfleet-staging`) imported from the same repo with the same root directory and the same `vercel.json`, production branch set to `development`. Use this if you want the staging environment to have its own domain, Blob store and cron history without relying on the Preview scope. More to maintain; same variables.

Whichever you pick: staging must never hold `MONGO_URI_LIVE`, the production `CLERK_SECRET_KEY`, the production `DB_URL` or the production Blob token.

### 2b. Rule for copying live data into staging

Staging should be loaded from a restored backup, not from the live cluster by connection string (section 15 has the commands). Live customer data in staging is still live customer data: restrict who can open staging, and do not leave it there longer than the test needs. Prefer the demo seed (`backend/scripts/seedDemoTenant.js`, flagged `isDemo: true`) for anything shown to outsiders.

---

## 3. Environment variables (complete)

Source of truth is `grep process.env` over `backend/`, `frontend/src` and `marketing/`. "Secret" means: store only in Vercel (mark **Sensitive** where Vercel offers it), a password manager and nowhere in git.

### 3a. App project (Vercel project 2: repo root, serves `frontend/build` and `api/`)

| Name | Used in | Required? | Example / placeholder | Secret | Production | Staging |
|---|---|---|---|---|---|---|
| `DB_URL` | `backend/db/Database.js` (when `NODE_ENV=production`, which includes Preview) | **Yes**, API returns 503 without it | `mongodb+srv://myfleet_app:<pw>@<cluster>.mongodb.net/myfleet?retryWrites=true&w=majority` | **Yes** | prod cluster, db `myfleet` | **different**: staging db `myfleet-staging`, different user |
| `OFFLINE_DB_URL` | `Database.js` when `NODE_ENV` is not `production`; scripts `--target=local` | Local only. Do not set on Vercel | `mongodb://127.0.0.1:27017/myfleet` | Treat as yes | not set | not set |
| `NODE_ENV` | many places | Set by Vercel to `production` (Production and Preview). Do not override | `production` | No | auto | auto |
| `CLERK_SECRET_KEY` | `services/clerkAuth.js`, `@clerk/express` | **Yes** (without both Clerk keys the Clerk middleware is not mounted and Bearer tokens are ignored) | `sk_live_...` | **Yes** | `sk_live_` | `sk_test_` (development instance) |
| `CLERK_PUBLISHABLE_KEY` | `clerkAuth.js` (falls back to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, then `REACT_APP_CLERK_PUBLISHABLE_KEY`) | **Yes** (or rely on the REACT_APP one; set both explicitly) | `pk_live_...` | No (public) | `pk_live_` | `pk_test_` |
| `JWT_SECRET_KEY` | `middleware/auth.js`, `model/user.js` (legacy cookie login) | **Yes while legacy login code exists.** Missing means `jwt.sign` throws on any legacy login | 64+ random chars: `openssl rand -hex 48` | **Yes** | unique | unique |
| `JWT_EXPIRES` | `model/user.js` | Yes with `JWT_SECRET_KEY` (missing means tokens have no expiry or sign fails; set it) | `1d` (the cookie itself is 1 day; the repo's `.env.example` says `7d`, keep them equal) | No | `1d` | `1d` |
| `ACTIVATION_SECRET` | `controller/user.js` (legacy signup email link) | Yes while `/create-user` exists | `openssl rand -hex 48` | **Yes** | unique | unique |
| `ALLOWED_ORIGINS` | `app.js` CORS allow-list (comma-separated). Falls back to `FRONTEND_URL` | **Yes in production.** If both are empty on production, `cors` runs with no origin option and allows every origin | `https://app.yourdomain.com` | No | `https://app.yourdomain.com` | `https://staging-app.yourdomain.com` |
| `FRONTEND_URL` | `app.js` (CORS fallback), `controller/user.js` (links in emails) | Yes (email links fall back to `http://localhost:3000` if unset, which would put localhost links in customer email) | `https://app.yourdomain.com` | No | as left | as left |
| `CLIENT_URL` | `controller/user.js` fallback for email links | No | same as `FRONTEND_URL` | No | leave unset | leave unset |
| `CRON_SECRET` | `controller/tenant.js` `purge-due`, `billing-notices`. Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when this variable exists | **Yes.** Unset: both endpoints return 404 and the jobs silently never run | `openssl rand -hex 32` | **Yes** | unique | unique |
| `BLOB_STORE_ID` | `services/fileStorage.js` `useBlob()` | **Yes** (added automatically when you connect a Blob store to the project). Without it, uploads go to the ephemeral serverless disk and vanish | `store_xxxx` (auto) | No | prod store | staging store |
| `BLOB_READ_WRITE_TOKEN` | same. Alternative to the store id; also added on connect for non-OIDC setups | One of the two | `vercel_blob_rw_...` | **Yes** | prod | staging |
| `ANTHROPIC_API_KEY` | `services/aiImport/localLog.js` | Only if AI import is on. Without it the import route answers with an error | `sk-ant-...` | **Yes** | prod key, spend limit | separate key, tiny limit |
| `AI_IMPORT_MODEL` | `localLog.js` | No. **Default hard-coded to `claude-opus-5-5`**, the most expensive choice; the plan estimated Haiku to Sonnet. Decide and set it explicitly | e.g. a Sonnet-class model id | No | set deliberately | cheap model |
| `AI_IMPORT_PAGES_PER_MONTH` | `controller/aiImport.js` | No (default 100). Plan bands also limit pages (`config/plans.js`: 50/200/500) | `100` | No | decide | `10` |
| `SMPT_HOST` | `utils/sendMail.js` (**sic: SMPT, not SMTP**) | **Yes** for reminders, activation, password reset. Either this or `SMPT_SERVICE` | `smtp.yourmailhost.com` | No | prod | sandbox |
| `SMPT_PORT` | same. 465 uses implicit TLS (`secure: true`); other ports use STARTTLS when the server offers it | Yes with host | `465` or `587` | No | | |
| `SMPT_SERVICE` | same (nodemailer well-known service name) | Alternative to host | `gmail` | No | | |
| `SMPT_MAIL` | same. **Also used as the From address** | Yes | `billing@yourdomain.com` | No (but it is the login) | | |
| `SMPT_PASSWORD` | same | Yes | app password / API key | **Yes** | | |
| `PAYMENT_ECOCASH_NUMBER` | `config/plans.js`, shown in reminder emails | No. Default is hard-coded `+263 778 115 084` | `+263 77X XXX XXX` | No | confirm the number is the business one | any |
| `DELETION_GRACE_DAYS` | `services/companyDeletion.js`, `billingEmails.js` | No (default 30). Marketing copy, the Terms and the Privacy Policy all say 30 | `30` | No | `30` | `0` or `1` for testing the purge |
| `TENANT_GUARD` | `services/tenantGuard.js` | **Set to `enforce` in production** after the stamp gate (section 12). Default `off` means isolation relies on per-route checks only | `enforce` | No | `enforce` | `enforce` (test with `log` first) |
| `RESET_PASSWORD_DEV_LINK` | `controller/user.js` | **Never `true`** in production or staging. It returns the reset link in the API response | unset | No | **unset** | **unset** |
| `UPLOADS_DIR` | `backend/uploadsDir.js` | No. Local/test only; on Vercel it falls back to a temp dir | unset | No | unset | unset |
| `VERCEL` | `app.js`, `middleware/error.js`, `uploadsDir.js` | Set by Vercel. Its presence stops Express serving `frontend/build` and hides 5xx messages | auto | No | auto | auto |
| `PORT` | `server.js` (local only) | Local only | `5050` | No | unset | unset |
| `CI`, `GENERATE_SOURCEMAP`, `NODE_OPTIONS` | `vercel.json` `build.env` | Already set in `vercel.json` (`CI=false`, source maps off, 8 GB heap) | | No | | |

Build-time (React CRA bakes these into the JavaScript bundle at build, so changing them needs a redeploy):

| Name | Used in | Required? | Example | Secret | Production | Staging |
|---|---|---|---|---|---|---|
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | `frontend/src/utils/clerk.js`. Its presence turns Clerk on in the UI; **absent means the UI falls back to the legacy password login page** | **Yes** | `pk_live_...` | No | `pk_live_` | `pk_test_` |
| `REACT_APP_API_ORIGIN` | `frontend/src/server.js` | **Leave unset.** Unset means the app calls `/api/v2` on its own host, which is correct for the single app project | unset | No | unset | unset |

Scope rule: every variable above marked "differs" must be entered **twice** in Vercel, once with only Production ticked and once with only Preview ticked, with different values.

### 3b. Marketing project (Vercel project 1: Root Directory `marketing`)

| Name | Used in | Required? | Example | Secret | Production | Staging |
|---|---|---|---|---|---|---|
| `PUBLIC_APP_URL` | `marketing/src/lib/links.ts` ("Start free", "Sign in" links) | **Yes.** Fallback in code is `https://app.example.com`, which would ship broken links | `https://app.yourdomain.com` | No | as left | `https://staging-app.yourdomain.com` |
| `PUBLIC_SITE_URL` | `astro.config.mjs` `site`, `links.ts`, canonical URLs, sitemap, social tags. Fallback `https://myfleet.example.com` | **Yes** | `https://yourdomain.com` | No | as left | staging URL |
| `PUBLIC_WHATSAPP_NUMBER` | `links.ts` | No (default is built in) | `263778115084` (digits only) | No | confirm | |
| `PUBLIC_PLAUSIBLE_DOMAIN` | `layouts/Base.astro` analytics snippet | No (empty means no analytics) | `yourdomain.com` | No | set when you want analytics | empty |

All `PUBLIC_*` values land in page HTML. No secrets.

### 3c. Script-only variables (set on your trusted machine in the shell, **never in Vercel**)

| Name | Used by | Purpose |
|---|---|---|
| `MONGO_URI_LIVE` | `backfillTenantId.js`, `verifyTenantStamps.js`, `splitSharedCustomers.js`, `seedDemoTenant.js`, `importExpenses2026.js`, `fixExpenseIndex.js`, `copyLiveToLocal.js`, seed config, `migrateToAtlas.js` | Connection string used by `--target=live` |
| `OFFLINE_DB_URL` / `MONGO_URI_LOCAL` | same scripts with `--target=local`; seed; imports | Scratch/rehearsal database. Use this for the **staging** database when running scripts against staging |
| `DB_URL` | seed config fallback for live | Prefer `MONGO_URI_LIVE` explicitly |
| `SEED_BACKUP_DIR` | `scripts/seed/config.js` | Backup directory for seed pipeline |
| `MIGRATE_INCLUDE_EXPENSES` | `migrateToAtlas.js` | `1` to include the protected `expenses` collection. Leave unset |
| `EXPENSE_TEST_URI` | two jest suites | Optional test DB |

Scripts take an explicit `--target=local|live`; live also needs `--confirm-live` and `--apply` to change anything. For staging, use `--target=local` with `OFFLINE_DB_URL` set to the staging Atlas string (scripts do not guess from `NODE_ENV`).

### 3d. Setting them without pasting into a browser form (optional)

```bash
vercel login
vercel link                       # choose the APP project (repo root)
vercel env add DB_URL production          # prompts for the value
vercel env add DB_URL preview             # separate, staging value
vercel env ls
vercel env pull .env.vercel.production --environment=production   # NEVER commit; delete after use
```

`.env.vercel*` is not in `.gitignore`. Add `.env.vercel*` to your global gitignore first, or pull into a path outside the repo.

---

## 4. MongoDB Atlas

### 4.1 Organization hygiene
- Enable MFA on every Atlas login. Create a second Organization Owner (break-glass).
- Create two projects: `myfleet-prod` and `myfleet-staging`. Separate projects means separate users, network lists, API keys and billing views, so a staging mistake cannot touch production.

### 4.2 Cluster
- **Region**: choose deliberately and record it in `docs/compliance/LEGAL_CHECKLIST.md` ("Atlas region: ____"). It cannot be changed later without a migration, and the POTRAZ filing and Privacy Policy name it. A region close to the Vercel function region matters for latency: functions default to `iad1` (Washington). Either set the function region to match Atlas (`"regions": ["<id>"]` in `vercel.json`, a code change, VERIFY with Vercel) or choose an Atlas region next to `iad1`/`fra1`. For Zimbabwean users the nearest cloud regions are in South Africa (check availability for Atlas and Vercel) or Europe; latency to the API is dominated by distance to the function region, not by Atlas.
- **Tier (production)**: start at **M10 or higher** (dedicated). M0/M2/M5 shared tiers have no continuous cloud backup, connection and operations limits, and may not meet a "paid product holding financial records" standard. `docs/plan/REMAINING_WORK_PLAN.md` already flags this. VERIFY the current Atlas tier names, limits and prices before choosing.
- **Connections**: each warm serverless instance opens up to 10 connections (`maxPoolSize: 10` in `Database.js`). Many concurrent instances multiply this. M10 allows on the order of 1,500 connections (VERIFY). Watch the "Connections" chart (section 19) and lower `maxPoolSize` (a code change) if it approaches half the limit.
- **Staging**: M0 free cluster or a separate database on a small shared tier is acceptable. Name the database `myfleet-staging` so a connection string mix-up is visible.
- Enable **Auto-scaling** for storage; leave compute auto-scaling off until you understand the cost.

### 4.3 Network access (Vercel and the IP allow-list)
Vercel serverless functions do not have fixed IP addresses on standard plans. Options, best first:

1. **Atlas Network Access, add `0.0.0.0/0`** (allow from anywhere) and rely on strong credentials + TLS + a least-privilege user. This is what `backend/config/.env.example` assumes ("allow 0.0.0.0/0 unless using Vercel IPs"). Acceptable only with: a long random DB password, a user limited to the one database, and the alerting in section 4.8 and 19 turned on.
2. **Vercel Secure Compute / dedicated outbound IPs** (Enterprise add-on) or a Vercel-Atlas private link integration. Costly; revisit when the business can pay for it. VERIFY availability.

Add your own admin IP separately if you also run scripts from the office, and give that entry an expiry date.

For staging, same approach, in the staging project.

### 4.4 Database users
Create these in Database Access (built-in roles, scoped to the one database):

| User | Role | Used by |
|---|---|---|
| `myfleet_app` | `readWrite` on `myfleet` only | Vercel `DB_URL` |
| `myfleet_ops` | `readWrite` on `myfleet`, **not** stored in Vercel | your machine, for scripts (`MONGO_URI_LIVE`) |
| `myfleet_backup` | `read` on `myfleet` | dumps / restore drill source |
| Atlas UI users | via SSO/MFA, `Project Owner` for two people | admin |

The app needs `createIndexes` (Mongoose `autoIndex`) in the database. `readWrite` includes it. Do not use `atlasAdmin` for the app.
Use a password without characters that need URL-encoding (`@ : / ?`), or percent-encode it, or the connection string will break.

### 4.5 Connection string
Atlas, cluster, Connect, Drivers. Use the SRV string and add the database name and options:

```
mongodb+srv://myfleet_app:<password>@<cluster>.<id>.mongodb.net/myfleet?retryWrites=true&w=majority
```

Test it from your machine before putting it in Vercel:

```bash
mongosh "mongodb+srv://<cluster>.<id>.mongodb.net/myfleet" --username myfleet_app
> db.runCommand({ ping: 1 })
```

### 4.6 Indexes needed by the code
Mongoose creates every index declared in `backend/model/*.js` automatically (`autoIndex` is the default and is not disabled anywhere) the first time each model is used on a cold instance. Two consequences: (a) first deploy against an empty database creates them; (b) on a large live collection a new unique index can fail if duplicates exist. Create and verify them deliberately instead of waiting for a cold start.

**Declared in the models (these are created automatically):**

| Collection | Index |
|---|---|
| `deliverers` | `clerkOrgId` unique sparse; `isDemo` |
| `users` | `clerkUserId` unique sparse |
| `jobs` | `tenantId`; `invoiceId`; `orderDate`; `{contractorId, orderDate}`; `{vehicleId, orderDate}`; `{driverId, orderDate}` |
| `customers`, `vehicles`, `drivers`, `contractors`, `driverstats`, `vehiclestats` | `tenantId` (stats also unique `{driverId, year}` / `{vehicleId, year}`) |
| `contractorstats` | one compound unique index (see model) |
| `overallstats` | unique `{companyId, year}` |
| `expenses` | `{companyId, date}`; `{vehicleId, date}`; partial unique `{companyId, importKey}` where `importKey` is a string |
| `fuelfills` | `{companyId, vehicleId, filledAt}` |
| `invoices` / `quotations` | `{tenantId, issueDate}`; partial unique number per tenant |
| `payments` | `{tenantId, date}`; `{tenantId, allocations.invoiceId}` |
| `trips` | `{tenantId, date}`; partial unique client reference |
| `trailers`, `tyres` | unique `{tenantId, regKey}` / `{tenantId, serialKey}` |
| `compliancedocs`, `maintenancerecords`, `serviceplans`, `tyrefitments` | `tenantId` plus the compound indexes in each model |
| `aiusages`, `counters` | unique `{tenantId, month}` / `{tenantId, series}` |

**Gaps (not declared; recommended before mass-market load).** With `TENANT_GUARD=enforce` every query on the guarded models gains `{tenantId: <company>}` (or `companyId`, `deliverer`, `delivererId` for the five older models, see `GUARDED` in `services/tenantGuard.js`). Indexes that lead with `orderDate` or only `contractorId` cannot serve those filters well. Create these in `myfleet-staging` first, check query times, then production. They are additive and safe to build online (`background` is the default on Mongo 4.2+):

```js
// mongosh, connected as myfleet_ops to the right database
db.jobs.createIndex({ tenantId: 1, orderDate: -1 })
db.jobs.createIndex({ tenantId: 1, vehicleId: 1, orderDate: -1 })
db.jobs.createIndex({ tenantId: 1, customer: 1 })            // VERIFY the field name used by customer filters
db.users.createIndex({ companyId: 1 })
db.vehicleexpenses.createIndex({ companyId: 1, vehicleId: 1 })      // VERIFY collection names with show collections
db.employeeexpenses.createIndex({ companyId: 1 })
db.rates.createIndex({ deliverer: 1 })
db.contractorstats.createIndex({ delivererId: 1 })
db.overallstats.getIndexes()   // already has companyId+year
```

Also **no unique index on `users.email`** exists in `model/user.js` (only `required`). The legacy signup checks for an existing email in code (`create-user`, `activation`), which is racy. Clerk identities link by verified email; two users with one email would make the link ambiguous. Create it only after checking for duplicates:

```js
db.users.aggregate([{ $group: { _id: { $toLower: "$email" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
// if empty:
db.users.createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } })
```

(Code-side, the schema should declare it so a fresh database has it; that is a gap listed in the checklist.)

Verify all indexes after a deploy:

```js
db.getCollectionNames().forEach(c => { print("== " + c); printjson(db[c].getIndexes().map(i => i.name)); })
```

Slow-query check once real data exists: Atlas, Performance Advisor (M10+) lists missing indexes from real traffic. Review weekly during the first month.

### 4.7 Backups and point-in-time recovery
- Production cluster: turn on **Cloud Backup** (Atlas, cluster, Backup) with a snapshot schedule: daily snapshots kept 7 days, weekly kept 4, monthly kept 12 (VERIFY policy options for your tier). Turn on **Continuous Cloud Backup / Point-in-Time Restore** with a 7-day window or longer. The Privacy Policy says backups age out with the backup window: write that number into `docs/compliance/LEGAL_CHECKLIST.md` ("backups age out ... record it").
- On shared tiers (M0/M2/M5) Cloud Backup is not available. Run a scheduled `mongodump` to external storage instead (section 15.1).
- Independent copy: keep a weekly `mongodump` in storage you control in a different account/provider than Atlas. Atlas backups die with the Atlas account.
- Take a manual snapshot immediately before any migration step (section 12) and before every release that changes data shape.
- Restore drill: section 15.

### 4.8 Alerts (set in Atlas, Project, Alerts)
Minimum: connections above 80 percent of limit, CPU above 80 percent for 10 min, disk above 80 percent, replication lag, "host has restarted", failed backup, login failures spike, new IP access entry added. Send them to a shared mailbox plus a phone.

### 4.9 Staging database
In the `myfleet-staging` project create a cluster (M0 is fine), user `myfleet_stg_app`, network `0.0.0.0/0`. Put its URL in Vercel **Preview** `DB_URL`. Seed it with either a restored production copy (15.3) or the demo tenant script.

---

## 5. Clerk

### 5.1 Concept
Two instances. Development instance (test keys, `pk_test_`/`sk_test_`) for staging and local. Production instance (live keys) for `app.yourdomain.com`. Users and organizations do not move between instances; create the owner again in production. The legacy account of the first customer links by **verified email** the first time that email signs in through Clerk (`resolveLocalIdentity`), and the first Clerk organization created by that company's admin adopts the existing company (becomes tenant #1). So: create the production organization for the first customer using the same email as their legacy account.

### 5.2 Create the production instance
1. Clerk dashboard, application, instance selector, "Create production instance" (clone the development settings if offered).
2. Enter the production domain: `app.yourdomain.com` (the app's host, not the marketing apex). Clerk then shows **DNS records** to add (CNAMEs such as `clerk.<domain>`, `accounts.<domain>`, `clkmail`/`clk._domainkey` for Clerk's own mail). Add them at your DNS host, then press Verify. Production keys appear only after DNS verifies. VERIFY exact record names in the dashboard; they are generated per domain.
3. Copy the production `pk_live_...` and `sk_live_...` into Vercel Production (`CLERK_PUBLISHABLE_KEY`, `REACT_APP_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).

### 5.3 Features to configure
- **Organizations: enable.** The backend requires an active organization for every non-platform user (`needsBootstrap` otherwise). Settings, Organization settings: allow users to create organizations, set the maximum memberships per organization to cover the biggest plan (25 users on Pro; the app enforces its own per-plan user allowance too), and keep default roles `org:admin` and `org:member` (`roleForOrgRole` maps `org:admin` to "Deliverer Admin" and everyone else to "Deliverer Manager").
- **Sign-up**: Email address and/or phone. Require **email verification** (the link-to-legacy-account logic only trusts a verified email). Decide on password, email code or Google. Enable bot protection / CAPTCHA (Clerk "Attack protection": bot sign-up protection, account lockout, password breach check) for the production instance.
- **Restrict sign-ups until launch**: Clerk, User & authentication, Restrictions, "Restricted" sign-up mode or allow-list. The plan says public sign-up stays closed until the legal gates pass (STATUS.md item 9): this is the switch that does it. Invite-only beta = Restricted mode + create invitations from the Clerk dashboard.
- **Paths** (Customization, Paths): sign-in `https://app.yourdomain.com/login`, sign-up `https://app.yourdomain.com/sign-up`, after sign-in/sign-up `https://app.yourdomain.com/`. The React routes are `/login/*`, `/sign-up/*`, `/create-organization`.
- **Session lifetime**: leave defaults (7 days) or shorten; the Clerk session token itself is short-lived and refreshed by the SDK.
- Branding, support email and the "from" name for Clerk-sent mail.

### 5.4 Allowed origins and redirects
Clerk checks the page origin against the instance domain. For the production instance the allowed origin is `https://app.yourdomain.com`. The marketing site only links to the app; it never loads Clerk, so it needs nothing. In Clerk, Paths / "Allowed redirect URLs" (name varies, VERIFY) add `https://app.yourdomain.com/*`. For the development instance add `http://localhost:3000` and `https://staging-app.yourdomain.com`.

### 5.5 Webhooks
**The backend has no Clerk webhook endpoint** (`grep -i webhook` over `backend/` finds nothing). Nothing needs to be configured in Clerk for the product to work, because users and organizations are created lazily at the first call to `POST /api/v2/auth/bootstrap`. The consequence (gap): when a Clerk user or organization is deleted, suspended or removed from an organization in the Clerk dashboard, the local `User` / `Deliverer` records are not updated (deactivation relies on the next Clerk token failing). The platform admin console and the company deletion job are the supported removal paths. If you want Clerk-driven sync later, add a `/api/v2/auth/clerk-webhook` route that verifies the Svix signature with a `CLERK_WEBHOOK_SECRET`; that variable does not exist yet.

### 5.6 What the backend needs from Clerk
`CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` for token verification and for `clerkClient.users.getUser` / `organizations.getOrganization` during bootstrap. The first request after a Clerk sign-in is `POST /api/v2/auth/bootstrap`. If this call 503s with "Sign-in service is not configured", one of the two keys is missing in that environment.

### 5.7 Staging Clerk
Use the Development instance of the same Clerk application (`pk_test_`/`sk_test_`). Enable Organizations there too. Do not point staging at production keys.

### 5.8 Cookie / domain notes for Clerk
Clerk sets its own `__client`/`__session` cookies on the Clerk domain tied to `app.yourdomain.com`. The API call from the SPA is same-origin (`/api/v2`) and authorised by the Bearer token, so no cross-site cookie is needed. If you ever serve the API from `api.yourdomain.com`, set `REACT_APP_API_ORIGIN`, add the app to `ALLOWED_ORIGINS` and test the preflight.

---

## 6. Vercel projects, domains and DNS

### 6.1 Two projects
Follow `docs/HOSTING.md`. Summary with the exact settings:

| | Marketing | App |
|---|---|---|
| Import | this repo | this repo |
| Root Directory | `marketing` | (repo root) |
| Framework | Astro (auto) | Other (`"framework": null` in `vercel.json`) |
| Build | `npm run build` (from `marketing/vercel.json`) | `npm run build --prefix frontend`, install `cd backend && npm install && cd ../frontend && npm install` |
| Output | `dist` | `frontend/build` |
| Production branch | `main` | `main` |
| Domains | `yourdomain.com`, `www.yourdomain.com` (redirect www to apex) | `app.yourdomain.com` |
| Function | none | `api/index.js`, `maxDuration` 30 s |
| Crons | none | the two in `vercel.json` (Production deployments only) |

Pitfall: the root `vercel.json` rewrites `/(.*)` to `/index.html`. That is the app project only. The marketing project has its own `vercel.json` (clean URLs, cache headers). Do not move or merge them.

Pitfall: Vercel redeploys **both** projects on every push to `main` unless you set "Ignored Build Step" per project (Settings, Git). Recommended: marketing ignores builds when nothing under `marketing/` changed; the app ignores builds when only `marketing/` or `docs/` changed. Example for the marketing project: `git diff --quiet HEAD^ HEAD -- marketing/` (exit 0 means skip). VERIFY the semantics in the Vercel docs before relying on it.

### 6.2 Domains and DNS
In each project: Settings, Domains, add the names. Vercel prints the records. Typical:

| Host | Type | Value |
|---|---|---|
| `yourdomain.com` (apex) | A | `76.76.21.21` (Vercel shows the current value; VERIFY) or ALIAS/ANAME to Vercel |
| `www` | CNAME | `cname.vercel-dns.com` (VERIFY the project-specific value shown) |
| `app` | CNAME | `cname.vercel-dns.com` (VERIFY) |
| `staging-app` | CNAME | `cname.vercel-dns.com` (VERIFY) |
| Clerk records | CNAME | from the Clerk dashboard (section 5.2) |
| Email records | TXT / CNAME | from your mail provider (section 7) |

Set a low TTL (300) on `app` before launch week so a mistake can be undone quickly; raise it later. Vercel provisions TLS certificates automatically; wait for "Valid Configuration" on every domain. Turn on HSTS only after both HTTPS sites work (Vercel serves HTTPS and redirects HTTP; submit to the preload list only once you are sure).

Also set:
- A CAA record allowing `letsencrypt.org` (Vercel's certificate authority) if you use CAA. VERIFY.
- Domain registrar lock + 2FA + auto-renew.

### 6.3 CORS (`ALLOWED_ORIGINS`)
Code behaviour (`backend/app.js`): `ALLOWED_ORIGINS` (else `FRONTEND_URL`) is a comma-separated allow-list. Requests with no `Origin` header (curl, server-to-server, same-origin GETs) are allowed. Any request that carries an `Origin` not in the list gets `403 Origin not allowed`. Browsers send `Origin` on same-origin POST/PUT/DELETE, so **the app's own origin must be in the list** or every write from the SPA fails.

| Environment | Value |
|---|---|
| Production | `ALLOWED_ORIGINS=https://app.yourdomain.com` |
| Staging | `ALLOWED_ORIGINS=https://staging-app.yourdomain.com` (add the generated `*.vercel.app` Preview URL only if you test on it; no wildcard support) |
| Local | `ALLOWED_ORIGINS=http://localhost:3000` |

The marketing site makes no API calls, so it is not listed. Do not leave `ALLOWED_ORIGINS`/`FRONTEND_URL` both empty in production: `cors` then receives no origin function and allows all origins with credentials.

Vercel Preview URLs differ per commit (`myfleet-git-development-<team>.vercel.app`). Test staging through the stable alias (6.2) so the allow-list does not need to change.

### 6.4 Cookie settings across subdomains
Only the legacy login sets a cookie (`backend/utils/jwtToken.js`): name `token`, `httpOnly: true`, `secure: true`, `sameSite: "none"`, no `domain` attribute (so it is host-only to `app.yourdomain.com`), expiry 1 day. Implications:

- `secure: true` is hard-coded, which is correct for HTTPS production/staging. (Cookie login over plain `http://localhost` will not stick for that reason; test legacy login only over HTTPS.)
- `sameSite: "none"` is needed only if the SPA and API are on different sites. They are same-origin here (both `app.yourdomain.com`), so `lax` would be stricter and sufficient. Leave it while legacy login exists; remove the whole path at launch (checklist G1).
- Because the cookie is host-only, a cookie set on `app.` is **not** sent to `yourdomain.com` and vice versa. Good: the marketing site never receives it.
- Clerk's cookies are separate (5.8).
- Marketing and app are different origins but the same "site" (registrable domain), so SameSite cookies would be sent between them if a `Domain=yourdomain.com` cookie were ever set. None is. Keep it that way.

### 6.5 Cron authentication
- `vercel.json` declares two crons, UTC: `0 2 * * *` `/api/v2/tenant/purge-due` and `0 6 * * *` `/api/v2/tenant/billing-notices`.
- Vercel invokes them with `Authorization: Bearer <CRON_SECRET>` **if** a `CRON_SECRET` env var exists on the project. The handlers compare it in constant time; unset secret returns 404, wrong value returns 401.
- Crons run only on the **Production** deployment, with Production env values. They do not run on Preview. VERIFY plan limits (Hobby: once per day granularity; Pro: more).
- Each invocation is a normal function call and is subject to `maxDuration: 30`. A purge of a company with a lot of files/records could exceed it (gap, checklist P3).
- Test by hand after setting the secret:

```bash
curl -i https://app.yourdomain.com/api/v2/tenant/billing-notices                       # expect 401
curl -i -H "Authorization: Bearer $CRON_SECRET" https://app.yourdomain.com/api/v2/tenant/billing-notices   # expect 200 {success:true,results:...}
```

  Running `billing-notices` for real can send emails to real company owners (once per date per notice type). On production do this only when you intend to; on staging it is safe if the mailbox is a sandbox.
- Check Vercel, project, Settings, Cron Jobs: both listed, enabled, with last-run results.

### 6.6 Security headers
The API sets Helmet headers (CSP disabled, CORP cross-origin). **Neither Vercel project sets security headers for the static sites** (`vercel.json` has no `headers`, `marketing/vercel.json` only caches). Add (code/config gap, checklist S6): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY` (or a CSP `frame-ancestors`) for the app, and a CSP for the marketing site (static, easy).

---

## 7. Vercel Blob (private files)

Used for driver documents (and later compliance papers). Key format `tenants/<companyId>/<kind>/<uuid>.<ext>`; max 4 MB (`MAX_FILE_BYTES`); only JPEG, PNG, WebP, PDF by file signature; served only through an authenticated route that checks the key belongs to the caller's company.

1. Vercel, app project, Storage, Create, **Blob**. Choose access **Private** and the **region** (cannot be changed later; record it in `docs/compliance/LEGAL_CHECKLIST.md`). Connect it to the project for **Production** (and a second, separate store for **Preview**). Connecting adds `BLOB_STORE_ID` (and a read-write token, depending on mode).
2. Confirm in Settings, Environment Variables that `BLOB_STORE_ID` exists in Production and Preview, with different values.
3. Redeploy so the function sees the variable.
4. Test (STATUS.md item 3 notes this was never exercised end to end): on staging, upload a driver licence, view it, reload, view again. Then check Blob, Browse: the object exists under `tenants/<id>/...`.
5. Deletion: the 30-day company purge removes the `tenants/<id>/` prefix (`delPrefix`). Test it on staging with `DELETION_GRACE_DAYS=0`: schedule deletion for a throwaway company, call `purge-due` with the bearer secret, confirm the prefix is empty.
6. Backups: Blob has no built-in versioned backup of your objects (VERIFY). Files are small and customer-supplied; decide whether a monthly copy to another store is required. The data export (ZIP) is the customer's own backup.
7. Logbook photos for AI import are read in memory and **never stored**; nothing to back up or purge.

---

## 8. Legacy login: turn it off before public launch

Production is Clerk-only in intent, but the code still exposes the old password system: `POST /api/v2/user/create-user` (public, sends an activation email, and answers "User exists" for known emails, which leaks which emails are registered), `/activation`, `/login-user`, `/forgot-password`, `/reset-password`, plus the cookie fallback in `isAuthenticated`. Each creates or authenticates accounts outside Clerk and outside the organization model; self-activated accounts get no company (no tenant) but are real `User` rows.

Until a code change lands (there is no `LEGACY_LOGIN` flag yet; `REMAINING_WORK_PLAN.md` proposes one), mitigate:
- Do **not** set `SMPT_*` for the legacy flows separately; they share the mailbox with reminders, so you cannot starve them. Accept the exposure and rely on `authLimiter` (20 requests / 15 min per IP per instance, in memory).
- Remove or disable the routes at the first code change after launch prep. Track as checklist item G1.
- There is no configuration-only way to close `create-user`; it needs the code change. Until then, treat the password-signup path as open and watch for `User` rows with no `clerkUserId`.

---

## 9. SMTP, SPF, DKIM, DMARC

What sends mail: `backend/utils/sendMail.js` via nodemailer, plain-text only, From = `SMPT_MAIL`. Senders: trial/payment reminders (daily cron), legacy activation and password reset. Clerk sends its own verification mail separately (from Clerk's domain records, section 5.2).

1. Use a dedicated sender on **your** domain: `billing@yourdomain.com` (or `noreply@`) rather than a personal/third-party mailbox. A transactional provider (Resend, Postmark, Amazon SES, Brevo, or your mail host's SMTP) is preferable to a mailbox login at scale (daily send limits, spam rating). The code accepts any SMTP host: set `SMPT_HOST`, `SMPT_PORT` (`465` for implicit TLS, `587` for STARTTLS), `SMPT_MAIL`, `SMPT_PASSWORD`.
2. DNS for deliverability (names and values come from the provider; shown here for the shape):

| Record | Host | Example value |
|---|---|---|
| SPF | `yourdomain.com` TXT | `v=spf1 include:<provider-spf> -all` (only **one** SPF record per domain; merge includes) |
| DKIM | `<selector>._domainkey.yourdomain.com` TXT/CNAME | given by provider |
| DMARC | `_dmarc.yourdomain.com` TXT | start `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; fo=1`, move to `p=quarantine` then `p=reject` after 2 to 4 weeks of clean reports |
| Return-path / custom bounce | provider-specific CNAME | given by provider |

3. Verify: send to a Gmail and an Outlook address, "Show original": SPF, DKIM, DMARC must all say PASS. Use mail-tester.com or similar for a score.
4. Test the app path (staging, sandbox or a test inbox): call `billing-notices` for a trial that ends in 7 days (create a throwaway company, then use the admin console to set the dates), and run the legacy forgot-password route.
5. Known gaps: emails are plain text with no unsubscribe or footer, no bounce handling, no send log beyond Vercel logs, and `sendMail` creates a new transporter per message. Fine for beta; track for scale (checklist E-section).
6. The payment instructions in reminders quote `PAYMENT_ECOCASH_NUMBER` (default hard-coded in `config/plans.js`). Confirm the number is the business account, or set the variable.

---

## 10. Platform-admin bootstrap

Platform admins have role `Super Admin` or `Site Admin`. There is **no script or public route** that creates one (by design; `create-user` strips role). The ways:

**A. Existing legacy admin (the first customer).** If a legacy `User` with role `Super Admin` already exists, signing in through Clerk with the same verified email links it automatically (`resolveLocalIdentity`). Platform admins do not need an organization; with none they land on the admin console.

**B. New platform admin.**
1. Create the person in Clerk (production instance, Users, Create user, or invite them), verified email.
2. They sign in once at `https://app.yourdomain.com/login`. Bootstrap creates a `User` with no role (default). They will be asked to create an organization; skip, or create one if you want a normal company too.
3. Promote them in the database (from a trusted machine, as `myfleet_ops`):

```js
// mongosh "<MONGO_URI_LIVE>"
db.users.find({ email: "<their email>" }, { email: 1, role: 1, clerkUserId: 1, companyId: 1 })
db.users.updateOne({ email: "<their email>" }, { $set: { role: "Super Admin" } })
```

   Note: for an org member, bootstrap resets `role` from the Clerk org role on each organization sign-in **unless** the existing role is already global (`GLOBAL_ROLES` are kept). Set the role after the first sign-in, and verify it survived a second sign-in.
4. They open the app, the "Admin console" menu item appears (`/api/v2/admin/*` is `requireRole("Super Admin", "Site Admin")`).
5. Write down who holds platform-admin rights (at least 2 people) in the password manager. Remove anyone who leaves, in both Clerk and `users.role`.

**Verify:** `GET /api/v2/admin/...` returns 200 for the admin and 403 for a normal company admin; the admin console tiles load.

Recovery if the only admin is locked out: sign in to Clerk dashboard as owner, create a new user, repeat B.

---

## 11. First deploy, in order

Do this on **staging first**, then repeat on production. Stop at the first failing check.

1. **Accounts and secrets exist** (sections 1 to 9): Atlas project + cluster + user, Clerk instance, Vercel projects, Blob store, SMTP, Anthropic key. Secrets are in the password manager.
2. **DNS** for `app`, `staging-app`, apex, `www`, Clerk, mail records created (sections 5 to 9). Wait for each to verify.
3. **Environment variables** entered in the right scope (section 3). Double check `DB_URL` per scope, `RESET_PASSWORD_DEV_LINK` unset, `TENANT_GUARD` set to `log` for the first run.
4. **Indexes**: on an empty database let the first requests create the declared ones, then add the recommended ones (4.6).
5. **Production only: stamp the existing data before the new code is live** (section 12). A fresh empty staging/production database for brand-new SaaS use needs no backfill.
6. **Deploy**: push the branch (`development` for staging; merge to `main` for production, per `docs/plan/RELEASE_CHECKLIST.md` section 3 with a merge commit, not squash). Wait for Vercel "Ready" on **both** projects if both changed.
7. **Smoke test** (section 13).
8. **Switch the guard to enforce** (production: RELEASE_CHECKLIST section 4: `log` for a day, then `enforce`).
9. **Bootstrap platform admins** (section 10).
10. **Open the front door** last: Clerk sign-up restriction off, marketing "Start free" pointing at production, ads/WhatsApp promotion only after `PRODUCTION_CHECKLIST.md` gates.

---

## 12. Migrations and backfills (order matters)

Applies when there is already data in the database that predates tenant stamping (production today; staging when loaded from a restored production copy). Brand-new empty databases do not need any of this. All scripts live in `backend/scripts/`, default to dry run, and refuse live writes without `--confirm-live`.

Always, first: **backup** (Atlas snapshot plus `mongodump`, section 15) and write down per-collection document counts.

```bash
cd backend
export MONGO_URI_LIVE="mongodb+srv://myfleet_ops:<pw>@<cluster>.mongodb.net/myfleet?retryWrites=true&w=majority"
# for a rehearsal on a restored copy (or staging) use the local target instead:
# export OFFLINE_DB_URL="mongodb+srv://myfleet_stg_ops:<pw>@<staging-cluster>.mongodb.net/myfleet-staging"
```

| Step | Command | Check | Undo |
|---|---|---|---|
| 1. Stamp `tenantId` (dry run) | `node scripts/backfillTenantId.js --target=live` | **No conflicts.** Counts match expectation. Leftovers are listed | nothing written |
| 2. Stamp (apply) | `node scripts/backfillTenantId.js --target=live --apply --confirm-live --adopt-leftovers-into=<companyId>` | Exits cleanly. `--adopt-leftovers-into` refuses unless exactly one company exists; if a second company has since been created, stop and ask | restore snapshot, or `$unset tenantId` per collection (the old code ignores the field) |
| 3. Split shared customers | `node scripts/splitSharedCustomers.js --target=live --map=customer-split-map.json` then add `--apply --confirm-live` | Dry run first. Keep the map file: it is the rollback record. With one company it finds nothing | restore snapshot; use the map |
| 4. Verify stamps (the gate) | `node scripts/verifyTenantStamps.js --target=live` | Prints "Every company-owned record is stamped", **exit code 0**. Exit 1 means unstamped records exist and `enforce` would hide them | read-only |
| 5. Expense index fix (only if the old `{companyId, importKey}` unique index exists) | `node scripts/fixExpenseIndex.js --target=live` then `--apply --confirm-live` | Index list shows the partial unique version | recreate old index (not advised) |
| 6. Turn the guard on | set `TENANT_GUARD=log` (24 h watching `[tenant-guard]` log lines), re-run step 4, set `enforce`, redeploy | Owner sees the same counts as before | `TENANT_GUARD=off`, redeploy |

Other scripts you may meet (do not run as part of a normal deploy): `copyLiveToLocal.js` (read-only copy of live into a local scratch DB, refuses non-local destinations), `seedDemoTenant.js` (only creates/resets `isDemo` companies), `importVehicleLog.js`, `importExcelJobs/run.js`, `importExpenses2026.js`, `migrateToAtlas.js` (protects `expenses` unless `MIGRATE_INCLUDE_EXPENSES=1`), `seed/` pipeline.

Note: the live stamping was done on 2026-11-04 (0 unstamped on 10 collections). Re-run the verify gate before every `enforce` change anyway: any record created while the guard was `off` by code paths that do not stamp would show up.

---

## 13. Smoke test (after every deploy; staging then production)

Use a throwaway company. Time-box: 20 minutes. `<APP>` is the app URL.

| # | Check | Expected |
|---|---|---|
| 1 | `https://<APP>/` loads | Login page, no console errors, HTTPS valid |
| 2 | `curl -i https://<APP>/api/v2/tenant/me` (no auth) | `401` JSON (proves the function and DB connect; a `503 Database unavailable` means `DB_URL`/Atlas network) |
| 3 | Sign up with a new email in Clerk | Verification mail arrives; code works |
| 4 | Create organization | Lands in the app with Getting started checklist and zeros |
| 5 | `GET /api/v2/tenant/me` in the browser | `billing.state: "trial"`, `writable: true`, trial end date 30 days out |
| 6 | Add a vehicle, driver, customer, job | Saves; refresh keeps them |
| 7 | Upload a driver licence image; View | Opens; reload and it still opens (Blob works) |
| 8 | Create an invoice from the job; open PDF | Footer says "not a fiscal tax invoice" |
| 9 | Modules page, download all company data | ZIP arrives |
| 10 | Second browser profile: sign up a second company | Cannot see company 1's records (try pasting a company-1 record URL) |
| 11 | CORS: browser console from `https://evil.example` page (or `curl -H "Origin: https://evil.example" -i https://<APP>/api/v2/tenant/me`) | `403 Origin not allowed` |
| 12 | Cron endpoints without bearer | `401`; with bearer `200` |
| 13 | Platform admin signs in | Lands in the admin console; a company admin gets 403 on `/api/v2/admin/...` |
| 14 | Rate limit sanity | 25 rapid POSTs to `/api/v2/user/login-user` return `429` eventually (per-instance, may not trip on every instance) |
| 15 | AI import (if enabled): one logbook photo | Rows come back; usage counter increments; cost visible in Anthropic console |
| 16 | Marketing: `https://yourdomain.com` | "Start free" goes to `https://<APP>/sign-up`; no `example.com` link anywhere (`View Source`, search for `example`) |
| 17 | `/privacy`, `/terms` | Final lawyer-approved text, not the "Draft" banner |
| 18 | Vercel logs for the last 10 min | No stack traces; no `[tenant-guard]` lines you cannot explain |

Legacy check (first customer, production only): `/api/v2/tenant/me` as the owner shows `billing.state: "legacy"` and `writable: true`.

---

## 14. Rollback plan

| Problem | Action | Time |
|---|---|---|
| Bad app deploy | Vercel, app project, Deployments, previous Production deployment, "Promote to Production" / Instant Rollback. Data written meanwhile stays; releases so far do not change existing data shape | under 1 minute |
| Bad marketing deploy | same in the marketing project | under 1 minute |
| Isolation problem or missing data after enforce | set `TENANT_GUARD=off`, redeploy | minutes |
| Bad env var | Vercel keeps no env history; keep the previous values in the password manager. Re-enter and redeploy | minutes |
| Bad data migration | restore the Atlas snapshot taken before the step to a **new** cluster, verify, then repoint `DB_URL` (do not restore over live blindly) | 30 to 120 minutes |
| Leaked secret | rotate (section 21), redeploy | minutes |
| Cron emailed wrongly | disable the cron (Vercel, Settings, Cron Jobs), fix, re-enable; notices are once per date so a repeat the same day does not resend | minutes |
| Clerk misconfiguration locks users out | revert the setting in Clerk; the backend is unaffected | minutes |
| DNS error | revert the record; low TTL (6.2) makes this fast | TTL |

Rules: never roll back by force-pushing `main`. Revert with a new commit, or promote an old deployment. Do not release on a day you cannot watch it for two hours.

---

## 15. Backup, restore and the drill

### 15.1 Manual and scheduled dumps
```bash
# full dump of production to a dated folder OUTSIDE the repo
mkdir -p ~/myfleet-backups/live-$(date +%F)
mongodump --uri="mongodb+srv://myfleet_backup:<pw>@<cluster>.mongodb.net/myfleet" --gzip --out ~/myfleet-backups/live-$(date +%F)
```
Copy the folder off the machine (encrypted storage). A dump is customer data: encrypt at rest, restrict access, delete when superseded (state this in the retention policy). Schedule weekly with a GitHub Actions cron or a small VM if you are on a tier without Cloud Backup.

### 15.2 Restore to a scratch database (the drill)
Quarterly, and once before launch. Use a scratch Atlas cluster or a local `mongod`; never restore over live.

```bash
mongod --dbpath ~/scratch-mongo --port 27018 &       # or point at a scratch Atlas cluster
mongorestore --uri="mongodb://127.0.0.1:27018" --gzip --nsInclude="myfleet.*" ~/myfleet-backups/live-<date>/myfleet
mongosh "mongodb://127.0.0.1:27018/myfleet" --eval 'db.getCollectionNames().forEach(c=>print(c, db[c].countDocuments()))'
```
Compare counts with the numbers noted at backup time. Then run the app against it (`OFFLINE_DB_URL=mongodb://127.0.0.1:27018/myfleet`, `cd backend && npm run dev`, frontend `npm start`) and `node scripts/verifyTenantStamps.js --target=local`. Record in the runbook: date, who, snapshot used, time to restore, counts matched, problems.

Atlas path: Backup, Snapshots, "Restore" to a new cluster (or Point in Time with a timestamp), then connect and compare counts. Time it; that number is your real recovery time objective.

### 15.3 Loading a restored copy into staging
Restore the dump to the staging database (`--nsFrom "myfleet.*" --nsTo "myfleet-staging.*"` with `mongorestore`), then **scrub** if outsiders will use staging: change user emails (`<id>@example.invalid`), blank phone numbers, ID numbers, and remove Blob references. `scripts/copyLiveToLocal.js` is the read-only copier for a local scratch copy.

### 15.4 What is not covered
Blob objects (no automatic backup), Clerk users/organizations (export from the Clerk dashboard/API periodically; there is no Clerk webhook feeding a local mirror), environment variables (keep a sealed offline copy), and the repo (GitHub). Customer-side backup is the "download all data" ZIP.

---

## 16. Rate limiting and abuse controls (what exists)

- `apiLimiter`: 6,000 requests per 15 minutes per IP on all of `/api`. `authLimiter`: 20 per 15 minutes per IP on login, create-user, activation, forgot-password, reset-password. AI import has its own limiter (20 calls) plus a monthly page quota per company band.
- **They use express-rate-limit's default in-memory store, which is per serverless instance.** On Vercel, concurrent requests run on different instances and cold starts reset counters, so these limits are a speed bump, not a guarantee. For real protection use a shared store (Redis/Upstash via `rate-limit-redis`) or Vercel's firewall rate limiting (Vercel, project, Firewall, add a rate-limit rule on `/api/v2/user/*` and `/api/v2/auth/bootstrap`; VERIFY availability on your plan). `trust proxy` is set to 1, which is correct behind Vercel.
- Not covered by `authLimiter`: `POST /api/v2/auth/bootstrap` (calls Clerk APIs on each use), file uploads, the data export, `rebuild-stats` (global-cost endpoint, see REMAINING_WORK_PLAN). Clerk applies its own sign-in/up limits and bot protection.
- Add a Vercel Firewall rule set before launch: block known bad IPs/ASNs if abused, challenge mode when under attack. Document how to enable "Attack Challenge Mode" (Vercel, Firewall) in the runbook.

---

## 17. Placeholders and hard-coded values to replace before launch

| Where | Value | Action |
|---|---|---|
| `docs/HOSTING.md` | `yourdomain.com`, `app.yourdomain.com` | Replace with the real domain (docs only) |
| `marketing/.env.example`, `marketing/src/lib/links.ts`, `marketing/astro.config.mjs` | `app.example.com`, `myfleet.example.com`, `app.yourdomain.com` | **Set `PUBLIC_APP_URL` and `PUBLIC_SITE_URL` in Vercel**; the code fallbacks ship `example.com` links if unset. Consider failing the build when unset |
| `backend/config/plans.js` | `+263 778 115 084` EcoCash default; prices (`9/29/59`) and limits | Confirm the number; prices are a test and live only here |
| `backend/services/aiImport/localLog.js` | default model `claude-opus-5-5` | Set `AI_IMPORT_MODEL` deliberately |
| `docs/plan/RELEASE_CHECKLIST.md` | company id `654f669091e232eb07068b57` used in a live command | It is the first customer's id; fine in docs, but re-confirm at run time that exactly one company exists |
| `frontend/public/index.html` | `<title>myfleet</title>`, generic description | Update title and meta description; add `noindex` for the app (`robots.txt` currently allows all, so app login pages can be indexed) |
| `marketing` Privacy/Terms | "Draft, pending legal review", `noindex`, `TODO(owner)` / `TODO(lawyer)` in `src/content/site.ts` | Resolve every TODO; remove the draft banner |
| `docs/compliance/*` | blanks `______` (deputy, lawyer, POTRAZ route, Blob/Atlas regions, backup window) | Fill in |
| `frontend/public/sample-log-sheets-images/`, `frontend/public/logos-clients/` | real WhatsApp logbook photos, a client logo and a sample workbook, **served publicly from the app domain** | Remove from `public/` (or replace with synthetic demo images); see checklist D2 |
| repo root `all jobs 2025 to 2026/` (49 files) | real customer job spreadsheets tracked in git | Remove from the repo and from history if the repo is or will be shared (checklist D1) |

---

## 18. Access and ownership

Keep a table (password manager, not git): who owns each account (domain registrar, DNS, Vercel, GitHub, Atlas, Clerk, SMTP/provider, Anthropic, Blob), the recovery email, MFA method, and the break-glass person. Everything in the stack should have MFA on and at least two humans with owner rights before the first paying customer.

---

## 19. Monitoring, alerting, logging and error tracking

What exists: Vercel function logs (`console.log/error`; `[tenant-guard]`, `[company-deletion]`, `[billing-notices]`, `[data-export]` prefixes), the Express error handler (500s logged, message hidden in production), Atlas metrics. **What does not exist:** an error tracker (no Sentry or equivalent in `package.json` for backend, frontend or marketing), a health endpoint (only `/test` in `app.js`, and it is unreachable on Vercel because only `/api/*` is routed to the function), uptime checks, structured logging, request IDs, or a status page.

Set up before launch:

1. **Health endpoint** (code gap, checklist O1): `GET /api/health` returning `{ok:true}` and a DB ping. Until it exists, monitor `https://app.yourdomain.com/api/v2/tenant/me` expecting `401` (proves function + DB connect), and `https://yourdomain.com/` expecting `200`.
2. **Uptime monitor** (UptimeRobot, Better Stack, Pingdom or similar): 1-minute checks on the two URLs above and on a Clerk-protected page, alerting email + SMS/WhatsApp to two people. Add a certificate-expiry and a domain-expiry alert.
3. **Error tracking**: add Sentry (or similar) to the backend (`@sentry/node` in `api/index.js` and the error middleware, with `tenantId` and no PII in tags), and to the frontend (`@sentry/react`). Upload source maps privately (source maps are currently disabled in builds; keep them off the public site). The Sentry/error-tracker is a sub-processor: add to the privacy page and DPA list (`REMAINING_WORK_PLAN.md` H3 already lists Sentry).
4. **Logs**: Vercel log retention is short on lower plans (VERIFY). Set up a **Log Drain** to a log service (Axiom, Better Stack, Datadog) so incident evidence survives. The breach plan depends on these logs.
5. **Vercel alerts**: Settings, Notifications: deployment failed, usage thresholds, function errors if offered.
6. **Atlas alerts**: section 4.8.
7. **Business alerts** (cheap, high value): a daily email to yourself with: new companies, trials ending, failed cron runs (billing-notices returns `results`; log it), AI spend, Anthropic console budget alerts.
8. **Anthropic**: set a monthly spend limit and an alert in the console; the default model is the most expensive one (section 17).
9. **Status page** (optional): free tier of Better Stack/Instatus, linked from the footer.

---

## 20. Performance and capacity notes

- 30 s `maxDuration`. Heavy endpoints (rebuild stats, exports, large imports, the purge) can hit it; there is a documented concern in `REMAINING_WORK_PLAN.md`. Load test (50 concurrent mixed requests; no 5xx; Atlas connections under half the tier limit) before opening sign-up.
- Cold starts re-run `connectDatabase()` and Mongoose index checks; function bundle includes `html2pdf.js`, `pdfkit`, `xlsx`, `fflate`, the Anthropic SDK. Watch cold-start time in Vercel Observability.
- Frontend is CRA with source maps off and an 8 GB build heap; check the bundle (`npm run build` output) and Lighthouse on a throttled mobile profile, since users are on mobile networks.
- The marketing site has `npm run check:size` and `npm run check:contrast`.

---

## 21. Secrets rotation

Rotate on schedule (every 6 to 12 months), on staff change and immediately on suspicion (breach plan section "First hour"). Order and effect:

| Secret | How | Effect | After |
|---|---|---|---|
| `JWT_SECRET_KEY` | new value in Vercel, redeploy | signs out all legacy cookie sessions | none (Clerk users unaffected) |
| `ACTIVATION_SECRET` | same | invalidates outstanding activation emails (5-minute lifetime anyway) | none |
| `CRON_SECRET` | new value in Vercel, redeploy, then test both endpoints with the new bearer | old value stops working at once; Vercel Cron picks up the new one on the next deployment | confirm both crons succeed the next day |
| `CLERK_SECRET_KEY` | Clerk, API keys, roll key (Clerk supports overlap, VERIFY), update Vercel, redeploy | server-to-server calls use the new key | revoke the old key |
| Atlas DB password | create a new user or change the password, update `DB_URL` in Vercel, redeploy, then delete the old user | brief errors during the swap if done in the wrong order; create new user first | check connections chart |
| Blob token / store | regenerate in Vercel Storage, redeploy | uploads/reads fail until redeployed | test a document view |
| `ANTHROPIC_API_KEY` | new key in Anthropic console, update Vercel, redeploy, delete the old | AI import uses new key | check usage |
| SMTP password | provider console, update `SMPT_PASSWORD`, redeploy | reminders fail until updated (they retry next day) | send a test mail |
| Registrar / DNS / Vercel / GitHub / Atlas / Clerk logins | change password, rotate MFA, remove old members and tokens | | review audit logs |

Never put a secret in a commit. If one was committed, treat it as leaked: rotate first, then clean history. Scan the repo before launch (`git log -p | grep -iE "sk_live|sk-ant|mongodb\+srv://[^<]*:[^<]*@"` or a scanner such as gitleaks/trufflehog); `docs/plan` records that a credentials rotation was planned in Phase 0, confirm it was done.

---

## 22. Ten-line summary

1. Create staging (Preview scope + staging Atlas DB + Clerk development instance + own Blob store). Never share `DB_URL` between scopes.
2. Create the production Atlas project, M10+, backups + PITR on, record the region.
3. Create the Clerk production instance on `app.yourdomain.com`, organizations on, sign-ups restricted.
4. Two Vercel projects, domains, DNS, `ALLOWED_ORIGINS=https://app.yourdomain.com`, `PUBLIC_APP_URL`/`PUBLIC_SITE_URL` set.
5. Connect Blob (private). Set `CRON_SECRET`. Set the four `SMPT_*`. Set SPF, DKIM, DMARC.
6. Backup, stamp tenants, verify gate, deploy, `TENANT_GUARD=log` then `enforce`.
7. Promote platform admins in the database.
8. Smoke test. Restore drill. Load test.
9. Fix the launch-blocking gaps in `PRODUCTION_CHECKLIST.md` section 0.
10. Open sign-up only when every gate there is ticked.
