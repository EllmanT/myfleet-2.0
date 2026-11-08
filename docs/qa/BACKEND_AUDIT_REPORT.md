# Backend audit report: correctness, multi-tenancy, tests

Date: 8 Nov 2026. Branch: `development`. Scope: `backend/` (Express + Mongoose). Nothing was committed or pushed, and no real database, Atlas, Clerk, Vercel or email service was touched. All tests use an in-memory MongoDB.

## 1. Baseline and result

| | Suites | Tests | Result |
|---|---|---|---|
| Baseline (original source, existing tests only) | 33 | 252 | all pass |
| After this work | 38 | 315 | all pass |

Notes on how the numbers were obtained:

- `node_modules` was absent in `backend/`, so every suite initially failed to start ("Cannot find module"). After `npm ci` the existing suite is green. This is an environment fact, not a code failure.
- The new tests were also run against the ORIGINAL controllers (changes stashed). 26 of them failed, which proves each test catches the bug it was written for (section 3). They pass with the fixes.
- One full run under `--coverage` showed `aiImport.test.js` and `customerIsolation.test.js` failing with "Instance failed to start within 10000ms". That is `mongodb-memory-server` timing out while the machine was busy (other agents were running at the same time), not a code defect. Both pass when re-run alone (20 tests). On CI, expect occasional flakes of this kind; consider raising the `mongodb-memory-server` start timeout.
- Run with: `cd backend && npx jest --runInBand --forceExit` (about 7 minutes; the suite does not exit on its own without `--forceExit` because of open Clerk/Mongo handles).

### Coverage (jest --coverage over controller, middleware, services, utils, model)

| Area | Statements | Branches | Lines |
|---|---|---|---|
| All | 76.0% | 63.5% | 77.3% |
| controller/ | 66.5% | 54.4% | 67.5% |
| middleware/ | 86.5% | 72.6% | 89.6% |
| services/ | 94.5% | 85.2% | 96.7% |
| utils/ | 93.0% | 76.1% | 97.3% |
| model/ | 98.2% | 57.1% | 98.6% |

Weakest controllers (lines): `employeeExpenses.js` 19%, `auth.js` (Clerk bootstrap, needs live Clerk) 38%, `vehicleStats.js` 44%, `contractorStats.js` 46%, `customer.js` 51%, `contractor.js` 53%, `driverStats.js` 54%, `deliverer.js` 60%, `job.js` 64%, `user.js` 65%, `vehicle.js` 68%. `popstats2.0.js` and `populateStats.js` are 0% and are not mounted in `app.js` (dead code). `services/aiImport/workbook.js` is 40%.

## 2. How tenancy is enforced (what exists)

Three layers, all in place:

1. Route layer: `isAuthenticated` (cookie JWT or Clerk bearer) then, depending on route, `requireCompany`, `requireFinance`, `requireRole`, `requireOwnership(field, getId)`, `requireModule`, `forceOwnCompany`. `requireOwnership` checks the record's `tenantId` first and falls back to the legacy id arrays on the `Deliverer` document for unstamped records.
2. Query layer: `services/tenantGuard.js`, a Mongoose plugin that adds the caller's company to every query, aggregate and save on 26 models. It is controlled by `TENANT_GUARD=off|log|enforce` and defaults to **off**.
3. Billing layer: `readOnlyError` inside `isAuthenticated` refuses every non-GET request from a company in a read-only state (trial ended, overdue, suspended, cancelled) except `/tenant/deletion`, `/auth/*` and `/user/logout`.

Existing automated checks: `tenantIsolation.test.js` (calls every route as company B using A's ids and fails if B sees or changes anything of A's; run in guard-off and guard-enforce mode), `tenantGuard.test.js`, and per-feature isolation tests.

The gap the existing matrix could not see: it sends A's ids in the URL, body and query as B, but a handler that trusts an id inside a body field to link B's own record to A's record only shows up if B owns something to link from. That is where the bugs in section 3 were.

## 3. Bugs found and fixed (each has a test that fails without the fix)

| # | Severity | Bug | Fix | Test |
|---|---|---|---|---|
| 1 | **High** (cross-tenant write, guard off) | `create-job` accepted any existing vehicle, driver, contractor or customer id. Company B could create jobs pointing at company A's truck/driver/contractor; `bulkCreateJobs` then pushed B's job ids into A's `job_ids` arrays and into stats. | `bulkCreateJobs` now requires every referenced contractor, vehicle, driver and customer to be owned by the caller's company (`companyOwns`). One bad leg rejects the whole batch with 400. | `crossTenantReferences.test.js` (create-job x5 + batch) |
| 2 | **High** (cross-tenant write, guard off) | `update-job` accepted `vehicleId`, `driverId`, `contractorId`, `fromId`, `pageCustomerId` from the body without an ownership check (same effect as #1 on edit). | Each supplied reference is checked with `companyOwns`; answers 404. | `crossTenantReferences.test.js` (update-job x5, plus controls) |
| 3 | **High** (cross-tenant read, guard off) | `export-jobs-csv` and `export-jobs-pdf` with `scope=contractor|driver|vehicle&entityId=<A's id>` returned A's jobs to company B (the export looked up the entity by id with no ownership check). | `getScopedJobIds` checks ownership of `entityId` for the chosen scope; errors keep their 404 status instead of being turned into 500. | `crossTenantReferences.test.js` (6 combinations + controls) |
| 4 | **High** (cross-tenant write, guard off) | `update-contractor` loaded the rate with `Rate.findById(rateId)` using a client-supplied id. Company B could overwrite company A's price list by sending A's `rateId` with B's own contractor id. | Rate is looked up by `_id` AND `contractor` AND (for non-platform users) `deliverer = caller's company`. | `crossTenantReferences.test.js` (update-contractor rates) |
| 5 | **High** (functional, money) | `create-vehicle-expense` and `create-employee-expense` did `yearlyExpenses += parseFloat(cost)` on Decimal128 fields whose getter returns text (`"0.00"`). Result: `"0.00" + 50` became `"0.0050"` (0.005) and the second expense failed with a 500 (`Cast to Decimal128 failed for value "0.0125.5"`). Per-truck and per-driver expense totals and profit were wrong from the first entry. | Numeric `addMoney` helper used for every expense/profit increment. | `legacyExpenses.test.js` |
| 6 | Medium (functional) | `delete-vehicle-expense` removed the expense but never took it out of OverallStats/VehicleStats, so totals stayed inflated forever. | The delete now reverses the amount in the yearly and monthly totals of both stats documents. | `legacyExpenses.test.js` |
| 7 | Medium (info disclosure) | `GET /deliverer/get-deliverer-info` and `/deliverer/get-all-deliverers-page` returned the company's whole `billing` object to its own users, including `billing.note` (the platform admin's private note, e.g. "paid by EcoCash, chase") and reminder bookkeeping. | Both fields are excluded for non-platform users. Platform console still sees the note. | `routeAccess.test.js` (private billing note) |
| 8 | Medium (completeness of deletion) | Company deletion left the company's `rates` (contractor price lists) behind in the database. | `rates` added to `DERIVED_KINDS` so the purge removes them. | `purgeCompleteness.test.js` (also fails if a future model is added without being purged or exported) |
| 9 | Medium (auth) | There was no logout endpoint. The session cookie is httpOnly, so a cookie-login user could not log out; `billing.js` already whitelisted `/user/logout` but the route did not exist. | Added `POST /api/v2/user/logout` (clears the cookie; allowed for read-only companies). **Frontend still needs to call it**: the non-Clerk "Logout" menu item in `Navbar.jsx` only reopens the menu. | `routeAccess.test.js` (logout) |
| 10 | Medium (functional) | `delete-admin` deleted the user first, then looked for the company list via the ACTOR's company. A platform admin with no company got a 500 after the user was already gone; one with their own company cleaned the wrong company's list. | Cleans the TARGET user's company with `$pull`; no 500. | `listsAndAdmins.test.js` |
| 11 | Low (functional) | Pagination on drivers, vehicles, contractors, admins, vehicle expenses, employee expenses joined strings (`start + "20"`), so page 2 and later returned all remaining rows instead of one page. | `Number(pageSize)`. | `listsAndAdmins.test.js` (drivers, vehicles, admins) |
| 12 | Low | `create-vehicle-expense` logged the whole VehicleStats document to the server log on every call. | Removed. | n/a |

Source files changed (all under `backend/`): `controller/job.js`, `controller/helpers/bulkCreateJobs.js`, `controller/contractor.js`, `controller/vehicleExpenses.js`, `controller/employeeExpenses.js`, `controller/deliverer.js`, `controller/user.js`, `controller/driver.js`, `controller/vehicle.js`, `services/dataExport.js`.

Operational follow-up for #5: any company that already used the per-vehicle or per-driver expense screens may have corrupted `yearlyExpenses`/`totalExpenses` values (for example `0.0050`). Check live data for `OverallStats`, `VehicleStats` and `DriverStats` rows with tiny expense totals and rebuild them (`POST /overallStats/rebuild-stats` rebuilds from jobs; confirm it also re-applies the vehicle and employee expenses before relying on it).

## 4. Route-by-route tenancy matrix

Legend. Auth: A = `isAuthenticated`; RO = read-only gate applies to non-GET (it is inside A); Co = `requireCompany`; Fin = `requireFinance` (Deliverer Admin, Super Admin); Own = `requireOwnership`; Mod = `requireModule`; Plat = Super/Site Admin only. Scoping: T = filters by `tenantId`; L = filters by the company's id arrays on `Deliverer`; G = also covered by the tenant guard when `TENANT_GUARD` is on. "Sweep" = covered by the automated all-routes tests (`tenantIsolation`, `routeAccess`).

| Mount | Routes | Auth / role | Tenant scoping | Verdict |
|---|---|---|---|---|
| `/user` public | login-user, create-user, activation, forgot-password, reset-password, logout | none (rate limited, except logout) | role/companyId never read from body; generic errors; operators stripped | OK |
| `/user` | get-user | A | own user | OK |
| `/user` | create-admin, update-admin, delete-admin, get-all-admins-page | A; creator roles Deliverer/Super/Site Admin | company forced from session for Deliverer Admin; foreign/missing users both 404; cannot grant global roles; plan user limit enforced (402) | OK. Site Admin can mint Super Admin (R6) |
| `/auth` | bootstrap | Clerk session | local identity resolved from verified Clerk token | OK (needs live Clerk to test fully) |
| `/tenant` | me, setup | A | own company only | OK |
| `/tenant` | billing (PUT) | A, Plat | audited | OK |
| `/tenant` | modules, export | A, Deliverer/Super/Site Admin | company from session; platform may name one | OK |
| `/tenant` | deletion (POST/DELETE) | A, Deliverer Admin | own company, name confirmation, 30-day cooling off | OK |
| `/tenant` | purge-due, billing-notices | CRON_SECRET bearer, timing-safe; 404 when unset | all companies (platform job, intended) | OK, tested |
| `/admin` | companies, summary, deletion, audit | A, Plat | cross-company by design | OK |
| `/files/*` | GET | A | key must start with caller's tenant folder; platform excepted; foreign = 404 | OK |
| `/vehicle` | create / update / delete / lists | A, RO, Own (L+T), forceOwnCompany, truck band limit | L + T | OK |
| `/driver` | create / update / delete / lists | A, RO, Own, forceOwnCompany; files stored under tenant folder | L + T | OK |
| `/customer` | create / update / delete / lists | A, RO, Own | L + T (customers unique per company) | OK |
| `/contractor` | create / update / delete / lists | A, RO, Own | L + T; rate lookup now scoped (fixed #4) | Fixed |
| `/deliverer` | create (Plat), update (Own company or Plat), info, list | A, role | own company; note hidden (fixed #7) | Fixed |
| `/job` | create-job, update-job | A, RO | references now ownership-checked (fixed #1, #2) | Fixed |
| `/job` | delete-job, get-latest-jobs-*/:id, get-all-jobsReport-*/:id | A, RO(delete), Own | job ids come from the company/entity lists | OK |
| `/job` | get-all-jobs-page, get-latest-jobs-deliverer, get-all-jobsReport-deliverer | A | company `job_ids` | OK |
| `/job` | export-jobs-csv / pdf | A | company list or owned entity (fixed #3) | Fixed |
| `/job-import` | preview, commit | A, RO | rows matched/created only within the caller's company; commit goes through `bulkCreateJobs` | OK |
| `/overallStats`, `/vehicleStats`, `/driverStats`, `/contractorStats` | gets | A, Own for by-id | `companyId` from session or entity ownership | OK. `get-total-rev-overallStats-company` returns `jobsByCategory` (never populated); route is unused by the frontend |
| `/overallStats/rebuild-stats` | POST | A, Plat; one named company | OK |
| `/expenses/vehicle`, `/expenses/employee` | create / get / delete | A, RO, Own on vehicle/driver | `companyId` string filter | Fixed #5, #6. No finance-role gate (R5) |
| `/expense` | CRUD, profitability, meta | A, Fin, Mod | `companyId` | OK |
| `/fuel` | CRUD, weekly, meta | A, Fin, Mod | `companyId`; vehicle must be the company's | OK |
| `/invoice`, `/payment`, `/quotation` | all | A, Fin, Mod | `tenantId`; line `jobId`/`tripId` ownership checked; PDF is company-scoped; numbering per tenant counter | OK |
| `/trip`, `/trailer`, `/compliance`, `/maintenance` | all | A, Co, Mod | `tenantId`; asset ids validated | OK |
| `/ai-import` | usage, extract, workbook | A, Co, Mod; per-company monthly page allowance | `tenantId` usage | OK |
| `/rate` | get-rates | A | `deliverer` = session company. Contractor branch is dead code with a ReferenceError | OK in practice |
| socket.io rooms | n/a | there is no socket.io in the backend | n/a | n/a |

Cross-cutting checks run by `routeAccess.test.js` against every route discovered from the router:

- Signed out: 401 on every route except the documented public set.
- Forged JWT and valid JWT for a deleted user: 401 on every route.
- Read-only company (trial ended, overdue, suspended, cancelled): every write route refuses (402, or 403 when suspended); reads, `/tenant/me` and export still work; platform admins are not blocked.
- Roles `Deliverer Manager`, `Contractor Manager`, `Contractor Admin`, `deliverer`: 403 on all finance routes and on billing, module, export, deletion, admin-management, platform and company-creation routes.
- Company Deliverer Admin: 403 on all platform-only routes. Site Admin: 403 on finance data.
- Cron endpoints: 404 without a configured secret; 401 for no/wrong/prefix-less/extended secret, for a logged-in user's cookie (including a platform admin), and for the secret in the query string; 200 only with the exact bearer.

## 5. Residual risks, ranked

**R1 (High, launch gate): the tenant guard defaults to `off`.** `docs/plan/TENANT_GUARD_ROLLOUT.md` says production stays `off` until the backfill and stamp verification have run on live data. Today the per-route ownership checks are the only barrier, and this audit found four route-level cross-tenant gaps they missed. They are fixed and tested, but the same class of bug can exist in code not yet exercised. Before a second paying company is onboarded: run `backfillTenantId.js`, `splitSharedCustomers.js`, `verifyTenantStamps.js` (exit 0), then set `TENANT_GUARD=enforce` in production and confirm the environment value. The suite already includes an enforce-mode run of the whole isolation matrix.

**R2 (High): possible corrupted expense statistics in live data** (bug #5) if the vehicle/employee expense screens were ever used. See section 3 follow-up.

**R3 (Medium): front end must call the new logout.** Cookie-login users still cannot sign out from the UI (`Navbar.jsx` non-Clerk branch). This is a frontend change outside this workstream.

**R4 (Medium): cookie flags.** `utils/jwtToken.js` always sets `secure: true, sameSite: "none"`. A project memory note says an environment-aware fix was made on 2026-06-24, but the committed file does not contain it (it matches the original commit). Fine on HTTPS and on `localhost` in modern Chrome; verify on any plain-HTTP staging host. The JWT is also returned in the JSON body and lives 1 day with no revocation list.

**R5 (Medium): role model is coarse.** Any signed-in company user, including `Deliverer Manager`, `Contractor Manager`, `Contractor Admin` and the default `deliverer` role, can create, edit and delete jobs, vehicles, drivers, customers and contractors, and use the older vehicle/employee expense routes (`/expenses/*`), which are finance data but have no `requireFinance`. Only the newer modules (expenses, fuel, invoices, payments, quotations) and tenant/user administration are role-gated.

**R6 (Medium): privilege inside the platform tier.** A `Site Admin` may create or promote users to `Super Admin` (`create-admin`, `update-admin` allow any `ADMIN_ROLES` for global actors). Also `Super Admin`, unlike `Site Admin`, is allowed through `requireFinance` and bypasses the read-only gate. Decide whether Site Admin should be limited.

**R7 (Medium): scale of the legacy id arrays.** Ownership and list queries still depend on `Deliverer.job_ids` and friends (the live company already has about 7,900 jobs). Each list request loads the array and uses `$in` with thousands of ids; the document also grows toward the 16 MB limit over years. Fine for launch; plan moving list queries to `tenantId` once everything is stamped.

**R8 (Low-Medium): activation email token carries the plaintext password.** `create-user` signs `{name,email,phoneNumber,password,...}` into a JWT (readable base64) placed in the email link. It only goes to the owner's own mailbox, but it should be replaced by a token that stores a hash or by creating the pending user server-side.

**R9 (Low): CSV export formula injection.** `escapeCsv` quotes but does not neutralise cells beginning with `=`, `+`, `-`, `@`. Exports contain customer and contractor names that tenants type. Prefix such cells with a single quote.

**R10 (Low): CORS in production.** If neither `ALLOWED_ORIGINS` nor `FRONTEND_URL` is set when `NODE_ENV=production`, no origin is configured and the `cors` library falls back to its permissive default. Confirm one of them is set on Vercel.

**R11 (Low): login throttling is per IP only** (20 per 15 minutes on auth routes); no per-account lockout. Billing and module caches are per serverless instance for 30 s, so a just-suspended company can keep writing briefly. Truck and user limits are check-then-act and can be exceeded by a few under concurrent requests.

**R12 (Low): the read-only whitelist is a prefix** (`/api/v2/auth/`), so any future route added under `/auth` silently bypasses the gate. Keep write routes out of that mount or narrow the pattern.

**R13 (Low): platform admins with no company** reach handlers that filter `{ companyId: req.user.companyId }` with `undefined`. In MongoDB that matches documents whose field is missing (legacy unstamped rows). Impact is limited to platform accounts and unstamped data; resolved by stamping everything (R1).

**Not covered by automated tests (needs manual or staging checks):** live Clerk sign-in and organisation switching, real email delivery (activation, reset, billing notices), real Vercel Blob storage, the AI import provider, real Atlas behaviour (multi-document transactions are used by `runWithOptionalTransaction`; the in-memory server runs without a replica set), Vercel cron invocation, and PDF visual layout.

## 6. Tests added

| File | Tests | What it proves |
|---|---|---|
| `tests/crossTenantReferences.test.js` | 25 | Fixes 1-4: cross-company references in create-job, update-job, job exports, contractor rates, with positive controls |
| `tests/routeAccess.test.js` | 27 | All-routes sweeps: 401 signed out, forged/stale cookies, read-only company (4 states), role restrictions (4 roles), platform-only routes, cron secret, private billing note, logout |
| `tests/listsAndAdmins.test.js` | 6 | Pagination (drivers, vehicles, admins) and admin deletion across companies |
| `tests/legacyExpenses.test.js` | 3 | Expense totals add numerically, delete reverses stats, other companies cannot add/list/delete |
| `tests/purgeCompleteness.test.js` | 2 | Rates removed on purge; every model file is either exported/purged or explicitly exempt |
| `tests/helpers/routes.js` | helper | Route discovery from the Express router, shared by sweeps |

Suggested next tests (not done): `employeeExpenses` happy path and delete-parity, `vehicleStats`/`driverStats`/`contractorStats` read paths, `customer`/`contractor` update paths, and a controller-level test for the Clerk bootstrap with a mocked Clerk client.
