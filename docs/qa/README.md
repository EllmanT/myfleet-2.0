# MyFleet manual QA: how testing works here

This folder is the manual test suite for MyFleet, the multi-tenant fleet-management SaaS (React single-page app, Express/MongoDB API, Clerk sign-in, Vercel hosting). It is written for testers who may not read code, but every expected result was derived from the code and the project documents (`docs/PROJECT_REFERENCE.md`, `docs/SAAS_PLAN.md`, `docs/FUEL_PROCEDURE.md`, `docs/plan/STATUS.md`, `docs/plan/RELEASE_CHECKLIST.md`, `docs/compliance/`). Where the code and a document disagree, or where behaviour looks unintended, the case says "record" and the item is listed in section 12 for the product owner.

| File | What it is |
|---|---|
| [README.md](README.md) | This guide: environments, accounts, severity, process, entry/exit criteria, sign-off, open questions |
| [TEST_CASES.md](TEST_CASES.md) | Index of all cases, counts per module, ID scheme, traceability |
| [cases/](cases/) | The cases themselves, one file per group of modules (tables with a Result column) |
| [TEST_DATA.md](TEST_DATA.md) | Companies, users, reference data, sample Excel workbook, hand-checkable worked examples, helper scripts |
| [qa-tracker.csv](qa-tracker.csv) | Every case as one spreadsheet row with status columns (open in Excel or import into Google Sheets/Jira) |

`BACKEND_AUDIT_REPORT.md` in this folder is a separate code audit and is not part of this suite.

## 1. What is being tested

MyFleet lets a transport company record customers, contractors (the parties that pay), vehicles, drivers and **jobs** (trips priced by rate per km), import jobs from Excel or from photos of logbooks, run cross-border **trips**, track **fuel** and **expenses**, issue **quotations and invoices**, and see **analytics**. Companies are separate **tenants**: nobody may ever see or change another company's data. Each company has a plan band (1-2, 3-10, 11-25 trucks), a free trial, and becomes **read-only** when the trial or payment lapses; after 30 days read-only it is scheduled for deletion with a further 30-day cooling-off. Platform staff (Super Admin, Site Admin) manage companies in the **Admin console**.

Important facts that shape testing:

- Optional parts are **modules** switched on or off per company (Settings > Modules). A new company starts with only Revenue analytics on. A switched-off module must be hidden in the menu **and** refused by the API.
- A "job" in the totals is one **leg**. A multi-leg job counts once per leg.
- Jobs have **no status field** (no pending/completed). Trips have a status (planned, in transit, delivered, closed, cancelled); invoices have draft, issued, void and a payment status. Anything in the brief about "job status" maps to invoice linkage (billed or not).
- There is **no real-time channel** (no websockets). Notifications are toasts, the billing banner, on-page statuses and e-mails.
- Money on invoices is stored in cents; job costs are rounded to two decimals; dates in statistics are grouped by the UTC calendar day.

## 2. Environments

| Environment | URL / how | Database and services | What you may do |
|---|---|---|---|
| **Local** | Frontend `http://localhost:3000`, API `http://localhost:5050`. Without the Clerk key in the frontend the **legacy e-mail/password login** is used (cases marked "legacy"). | Local or scratch MongoDB, local file storage for uploads, SMTP optional (`RESET_PASSWORD_DEV_LINK=true` shows reset links) | Everything, including destructive and time-travel cases. Good for API-level cases and for the guard modes (`TENANT_GUARD=off\|log\|enforce`). |
| **Staging** | A Vercel **Preview** deployment of the `development` branch (or a dedicated staging project). | Its **own** MongoDB database, a Clerk development instance, a **private** Vercel Blob store, SMTP credentials, `CRON_SECRET`, and `ALLOWED_ORIGINS` set to the staging URL | Everything, including destructive cases (deletion purge, billing time travel). Confirm before you start that staging does **not** point at the live database; if it does, treat every action as live. |
| **Production** | The live app URL | The live database and services | **Only** the 15-minute smoke pack (`cases/08-smoke.md`) with the dedicated smoke companies in `TEST_DATA.md` section 8. Never run purge, billing-notices, import bulk loads, security attack cases or time-travel on production. |

Features that exist only when configured: Clerk (publishable and secret keys), SMTP (`SMPT_HOST`, `SMPT_PORT`, `SMPT_MAIL`, `SMPT_PASSWORD`; note the spelling), Blob storage (`BLOB_STORE_ID`), the Anthropic key for photo import, and `CRON_SECRET` for the two daily jobs. If a case needs one that is missing, mark it **BLOCKED** with the missing setting, not FAIL.

Daily scheduled jobs (Vercel cron): `GET /api/v2/tenant/purge-due` at 02:00 UTC and `GET /api/v2/tenant/billing-notices` at 06:00 UTC. Both need `Authorization: Bearer <CRON_SECRET>`.

## 3. Accounts and data

Build the fixtures in `TEST_DATA.md` first: two main companies (QA Alpha Haulage and QA Bravo Freight) with overlapping names, a statistics company (QA Stats Co) with hand-checkable numbers, one company in each billing state, a platform admin, and the production smoke companies. Use real inboxes you control (plus-addressing works). Never use real customer data, real ID numbers or real photos.

Browser tools you will need: Chrome DevTools (Network, Console, Application), a second browser profile for the "other company", a phone, an e-mail inbox, and a spreadsheet program. Many cases use small console snippets (`api('GET', ...)` helper in `TEST_DATA.md` section 9).

## 4. Priorities and severities

**Test-case priority** (how important the case is):

| Priority | Meaning | Run when |
|---|---|---|
| P0 | Money, data safety, isolation, access control, core flows. A failure blocks release. | Every release (regression pack) |
| P1 | Important behaviour and common edge cases. | Every release, may be sampled for hotfixes |
| P2 | Less common paths, polish, secondary devices. | Major releases |
| P3 | Nice-to-have checks and observations. | When time allows |

**Defect severity** (how bad the bug is):

| Severity | Definition | Examples |
|---|---|---|
| **S1 Critical** | Data of one company visible or changeable by another; data loss or corruption; security hole; production down; a paying company locked out; a wrong amount on an issued invoice or statistic that drives money decisions. No workaround. | Foreign id returns data; read-only wrongly applied to an active company; purge deletes the wrong company; invoice total wrong |
| **S2 Major** | A main feature fails or gives wrong results, a workaround exists; wrong figures in a report; an important validation missing. | Import creates duplicates; dashboard totals off after editing a job; manager can reach finance data |
| **S3 Minor** | Small functional fault, confusing text, layout break, an edge case. | Wrong toast text, cut-off column on a phone |
| **S4 Trivial** | Cosmetic or an enhancement idea. | Alignment, spelling |

Fix priority (Urgent, High, Normal, Low) is set by the product owner at triage; severity is set by QA.

## 5. How to run a case

1. Read the **Preconditions** and set them up. Note the build/commit id and the environment.
2. Follow the **Steps** in order. Step texts quote the exact labels and routes from the app.
3. Compare with **Expected result**. Where a case says "record", write down what you saw even if no expectation is given; it is information for the owner.
4. Mark the Result column (or the Status column in `qa-tracker.csv`):
   - **PASS**: everything matched.
   - **FAIL**: something differs. Raise a defect and put its id in Notes/Defect ID.
   - **BLOCKED**: could not run (missing setup, an earlier defect, missing configuration). Say why.
   - **N/A**: not applicable to this build (e.g. a legacy-only case on a Clerk build).
   - **Not run** is the default.
5. Evidence: for every FAIL attach a screenshot or screen recording, the request URL, status and response body from the Network tab, the time (with time zone), the company and user.
6. Re-test a fixed defect on the **same case**, then run the neighbouring cases in that module.
7. Do not change a case's expected result to match the app. Raise it as a defect or as a question for the owner.

Environment column in the case tables: **S** means run on staging or local only; **SP** means safe on production with the dedicated smoke company.

## 6. Defect report template

```
Title:            [MODULE-ID] short description of the wrong behaviour
Severity:         S1 / S2 / S3 / S4
Environment:      Local / Staging / Production + build or commit id + backend/frontend
Browser/device:   e.g. Chrome 130 Windows 11, iPhone 14 iOS 17
Company / user:   e.g. QA Alpha Haulage / ALPHA-MGR (role)
Test case:        e.g. TEN-017
Preconditions:    data or state needed
Steps to reproduce:
  1.
  2.
Expected result:  (copy from the case or the document)
Actual result:
Evidence:         screenshots, video, request/response (remove tokens and personal data)
Frequency:        always / sometimes (n of m)
Workaround:       none / describe
Notes:            related cases, regressions, suspected cause
```

Security defects (cross-company access, XSS, injection, auth bypass): do **not** post details in shared channels; report them to the product owner directly and mark S1.

## 7. Test cycles

| Cycle | Scope | Typical effort for two testers |
|---|---|---|
| **Smoke** (every deploy, staging then production) | `cases/08-smoke.md` (20 cases, 15 minutes with two testers) | 15 minutes |
| **Hotfix regression** | Smoke + the module touched + all `TEN` P0 cases | 2-3 hours |
| **Release regression** | All P0 and P1 cases, plus `TEN` in both guard modes (`off` and `enforce`) | 3-4 days |
| **Full pass** (before opening public sign-up or a major release) | Everything, including P2/P3, the browser/device matrix, accessibility and performance | 1-2 weeks |
| **Isolation re-run** | `TEN` and `SEC` after any change to authentication, middleware, models, indexes, the tenant guard or the data migration | 1 day |

Run the automated backend tests too (`cd backend && npm test`; 33 suites and 253 tests passed at the last status note). They protect many rules but do not replace these browser checks.

## 8. Entry criteria (start testing a build)

- The build is deployed to staging with a known commit id, and the release notes list what changed.
- Backend automated tests are green on that commit.
- Environment checks done: staging database is not the live one; Clerk, SMTP, Blob storage, `CRON_SECRET`, `ALLOWED_ORIGINS` and the Anthropic key are set (or the dependent cases are marked BLOCKED up front).
- Fixtures from `TEST_DATA.md` are built and the id sheet is filled in.
- The staging smoke pack passes. If it fails, stop and return the build.
- No open S1 defect from the previous cycle without a fix in this build.

## 9. Exit criteria (the build may go to production)

- 100% of P0 cases executed and passed (no FAIL, no BLOCKED without owner approval).
- At least 95% of P1 cases executed; every FAIL has a defect; no open S1; no open S2 unless the product owner accepted it in writing.
- All `TEN` and `SEC` cases passed, `TEN` in both `TENANT_GUARD=off` and `enforce`.
- Billing and lifecycle cases (BILL, USR, ROL, DEL, ADM, DEX) passed on staging with real e-mail delivery checked.
- Worked-example numbers in ANA, EXP, FUE, INV and TRP match to the cent.
- Browser matrix: Chrome (desktop and Android) and Safari (iPhone) core script passed; other rows have no S1/S2.
- Smoke pack passed on staging, then re-run on production after the deploy; results recorded.
- Open defects and the questions in section 12 are listed in the sign-off sheet.

## 10. Sign-off sheet

Copy this block into the release ticket for each cycle.

```
Release / build:        ____________________   Commit id: ____________
Environment:            Staging / Production   Dates tested: ____ to ____
Testers:                ____________________

Cases:  total ___   executed ___   passed ___   failed ___   blocked ___   not run ___
P0: ___ / ___ passed      P1: ___ / ___ passed      P2: ___ / ___      P3: ___ / ___
Open defects:  S1 ___   S2 ___   S3 ___   S4 ___   (list ids attached)
Accepted risks (owner approval):  ______________________________________
Open product questions (README section 12) still unanswered:  _________

Recommendation:   GO  /  NO-GO  /  GO with conditions: ____________________
QA lead:      ____________________  date ________
Product owner: ___________________  date ________
```

## 11. Where to look when something fails

- API error texts are plain language and listed in the expected results. HTTP codes used: 400 bad input, 401 not signed in, 402 plan limit or read-only, 403 not allowed, 404 not found (also used for "belongs to another company"), 409 conflict, 413 too large, 429 too many requests, 5xx server fault.
- A "feature switched off" response has `code: MODULE_DISABLED`; a read-only refusal has `code: READ_ONLY`; a plan limit has `code: BAND_LIMIT`; a Clerk session that needs linking has `code: NEEDS_BOOTSTRAP`.
- Server caches: module settings and billing state are cached for about 30 seconds per company; the Clerk organisation lookup for 60 seconds.
- Console snippets and time-travel helpers: `TEST_DATA.md` section 9.

## 12. Open questions and suspicious behaviour (for the product owner)

Found while reading the code to write the cases. Each is covered by a case that says "record". None has been verified in a running system, so treat them as hypotheses until QA confirms.

Status note: when this suite was written the backend working tree held uncommitted edits (from the parallel backend audit) that appear to address A-01 (job creation now checks ownership of contractor, vehicle, driver and customer and answers 400 "Invalid contractor, vehicle, driver or customer for job"), the paging arithmetic in A-18, and add `POST /api/v2/user/logout` (A-20). The expected results in the cases describe the **fixed** behaviour. Test the build you are given: if it still accepts foreign ids, that is an S1 defect.

| # | Observation | Why it matters | Case |
|---|---|---|---|
| A-01 | Creating or editing a job only checks that the contractor, vehicle and driver ids **exist**, not that they belong to the caller's company; the job's `from` and `customer` ids are not validated at all. | A user could attach another company's vehicle/driver to their jobs and alter that company's statistics. Probable cross-tenant gap. | TEN-017 to TEN-019 |
| A-02 | In the Admin console, **Save plan** for a legacy company (no billing record) with Status left blank gives it status "trial" with **no trial end date**, which the billing rules treat as already ended. | A platform admin could lock out the original customer by saving a band. | ADM-006 |
| A-03 | Every new sign-up starts on the starter band with a **30-day** trial. Moving up a band (truck 3 or 11) keeps the old trial end, so the 60 and 90-day trials in the plan table never apply. The plan document talks about longer free periods for fleets. | Pricing promise vs behaviour. | BILL-001, USR-010 |
| A-04 | The **user allowance** is checked only in "Admins > Add" (`create-admin`). Members who join through a Clerk organisation invitation are not counted or limited. STATUS.md says users per plan are enforced. | The 3/10/25 user limits can be bypassed. | USR-015, AUTH-011 |
| A-05 | Users created by "Admins > Add" get a password in our database but no Clerk account. In a Clerk build the sign-in page is Clerk's. | Those users may not be able to sign in at all. | USR-009 |
| A-06 | Photo-import allowance comes from the setting `AI_IMPORT_PAGES_PER_MONTH` (default 100), not from the band's 50/200/500 pages shown in billing. | Customers see one number, the system enforces another. | IMP-025 |
| A-07 | Reminder e-mails: nothing is sent between the paid-until date and the 8th day (inside the 7-day grace), and the deletion warning is the only mail after read-only. | Owner may not know the account is about to lock. | BILL-014 |
| A-08 | If an owner cancels an **automatic** deletion but has not paid, the next daily run schedules it again. | The "Keep my company" button looks permanent but is not. | DEL-016 |
| A-09 | Deleting a vehicle, driver, customer or contractor that has jobs is not blocked and nothing cascades; deleting a job that is on an issued invoice, or editing/deleting a trip that is on an invoice, is not blocked either. Delete buttons appear not to ask for confirmation. | Orphaned data, broken edit screens, mismatched totals. | VEH-010, DRV-007, CUS-005, CTR-006, JOB-012, TRP-014 |
| A-10 | The Revenue ($ Overview) page's **Profit** tile equals revenue and **Expenses** is 0; the Expenses module does not feed the yearly statistics. The Profitability page shows different, correct figures. | Two pages disagree about profit. | EXP-015 |
| A-11 | Dashboard **Customers** and **Contractors** tiles are copied into the yearly record only when a job is saved, so they can be stale. When the chosen year has no data the API returns the **latest year with data** instead of zeros. | Wrong figures shown without warning. | ANA-010, ANA-011 |
| A-12 | The fuel check has hard-coded plates (AFE5848, AAV4331, AFO0724) that apply to **every** company, and a truck's own expected km per litre can only be set through the API (no field in the UI). | Another company with a truck on one of those plates gets someone else's norm. | FUE-015 |
| A-13 | Managers see the Expenses, Fuel Log, Invoices and Quotations menu items but get 403 on every call. Trips, trailers, documents and maintenance (with prices and margins) are readable by managers. | Confusing UX; possible unintended exposure of prices. | PRM-003, PRM-006 |
| A-14 | Platform admins with no company are sent to `/del-dashboard` after Clerk sign-in; the status document says they start at the Admin console (the legacy login does). | Possible blank or error dashboard for staff. | ONB-012 |
| A-15 | The login cookie is always `Secure; SameSite=None`, although project notes say it was made environment-aware for HTTP dev. Legacy login also returns the token and user in the response body, which the SaaS plan wanted removed. | Local dev login may fail in some browsers. | SEC-004, AUTH-016 |
| A-16 | Upload limits are inconsistent: files over 4 MB return the text "max 5 MB"; the photo import states 8 MB but the host rejects request bodies above about 4.5 MB. | Confusing errors for users with big photos. | UPL-003, UPL-012 |
| A-17 | The jobs **CSV export** only quotes cells (spreadsheet formulas in names are not neutralised) and prints the `entityName` parameter into the first line. The full company export does neutralise formulas. | CSV injection when a customer name starts with `=`. | SEC-008 |
| A-18 | Admins list paging does its page arithmetic on query-string values and an invalid `sort` value throws; "Add Admin" offers roles (Contractor Manager, Contractor Admin) that have no effect. | Wrong rows on page 2; 500 on bad input. | PRM-016 |
| A-19 | `/del-admins` and `/del-deliverers` routes are not wrapped in the protected-route component, and the router has no catch-all page. | Unauthenticated users see a shell; unknown URLs show a blank page. | PRM-015, NEG-007 |
| A-20 | There is no server-side logout in legacy mode and tokens are never revoked (24-hour life). | Stolen cookie stays valid until expiry. | SEC-024 |
| A-21 | The Tractor units module promises licence/Yellow Card/permit **expiry reminders**, but nothing is sent; documents also cannot hold an attached file. | Wording vs behaviour. | NOT-007, TRL-012 |
| A-22 | Quotation numbers are taken at creation (gaps if deleted); invoice numbers at issue (no gaps). Truck cost per km adds job distance and trip distance, which can double count one journey. | Accounting and costing surprises. | QUO-007, MNT-011 |
| A-23 | The first-run checklist offers "Send your first invoice" although Invoices is off for new companies. | Dead-end step. | ONB-005 |
| A-24 | No websocket or push notifications exist, although the test brief mentions them. | Confirm real-time is not expected. | NOT-001 |
