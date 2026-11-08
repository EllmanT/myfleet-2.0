# MyFleet manual test cases: index

All cases live in [cases/](cases/) (grouped by area) and in [qa-tracker.csv](qa-tracker.csv) (the same cases as spreadsheet rows). Read [README.md](README.md) first for environments, severity definitions, the process, entry and exit criteria, and the list of open questions. Fixtures and worked-example data are in [TEST_DATA.md](TEST_DATA.md).

## ID scheme and columns

- **ID**: `MODULE-NNN` (for example `TEN-017`). IDs are stable within a release of this suite; new cases are appended at the end of a module so existing ids never change meaning. A defect or tracker row refers to the id.
- **Pri**: P0 (blocks release), P1 (important), P2 (secondary), P3 (nice to have).
- **Env**: S = staging/local only; SP = safe on production using the smoke company.
- **Preconditions / Steps / Expected result**: written so that a tester can run them without reading code. Quoted text is the exact string the app shows. A number in an expected result is a value you can verify by hand from [TEST_DATA.md](TEST_DATA.md).
- **Result**: PASS, FAIL, BLOCKED, N/A or empty (not run). The CSV has Status, Tester, Date run, Build/version, Defect ID and Notes columns for the same purpose.

## Cases per module

| Module | Name | File | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|---|---|
| AUTH | Sign-up and login (Clerk, plus legacy cookie login) | [cases/01-access.md](cases/01-access.md) | 8 | 13 | 2 | 0 | 23 |
| ONB | Onboarding and empty-company experience | [cases/01-access.md](cases/01-access.md) | 2 | 8 | 2 | 0 | 12 |
| PRM | Permissions and roles | [cases/01-access.md](cases/01-access.md) | 7 | 8 | 1 | 0 | 16 |
| BILL | Trial, plans, billing and reminder emails | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 9 | 13 | 2 | 1 | 25 |
| USR | User management and plan limits | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 4 | 9 | 2 | 0 | 15 |
| ROL | Read-only mode (trial ended, overdue, suspended, cancelled) | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 7 | 7 | 0 | 0 | 14 |
| DEL | Company deletion after 30 days | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 7 | 8 | 3 | 0 | 18 |
| ADM | Platform admin console | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 4 | 7 | 2 | 0 | 13 |
| DEX | Company data export | [cases/02-billing-lifecycle.md](cases/02-billing-lifecycle.md) | 6 | 7 | 1 | 0 | 14 |
| TEN | Multi-tenancy isolation (explicit two-company cross-checks) | [cases/03-tenancy-security.md](cases/03-tenancy-security.md) | 26 | 5 | 0 | 0 | 31 |
| SEC | Security checks (IDOR, XSS, injection, auth, headers) | [cases/03-tenancy-security.md](cases/03-tenancy-security.md) | 7 | 15 | 3 | 0 | 25 |
| UPL | File uploads | [cases/03-tenancy-security.md](cases/03-tenancy-security.md) | 4 | 8 | 0 | 0 | 12 |
| VEH | Vehicles | [cases/04-core-data.md](cases/04-core-data.md) | 4 | 7 | 1 | 0 | 12 |
| DRV | Drivers | [cases/04-core-data.md](cases/04-core-data.md) | 4 | 4 | 1 | 0 | 9 |
| CUS | Customers | [cases/04-core-data.md](cases/04-core-data.md) | 3 | 4 | 0 | 0 | 7 |
| CTR | Contractors and rates | [cases/04-core-data.md](cases/04-core-data.md) | 2 | 5 | 1 | 0 | 8 |
| JOB | Jobs (create, edit, delete) | [cases/04-core-data.md](cases/04-core-data.md) | 6 | 11 | 2 | 0 | 19 |
| IMP | Excel and AI photo import | [cases/04-core-data.md](cases/04-core-data.md) | 7 | 22 | 3 | 0 | 32 |
| TRP | Trips and cross-border | [cases/05-trucking.md](cases/05-trucking.md) | 7 | 11 | 0 | 0 | 18 |
| TRL | Trailers and compliance documents | [cases/05-trucking.md](cases/05-trucking.md) | 5 | 5 | 1 | 1 | 12 |
| FUE | Fuel log and weekly fuel check | [cases/05-trucking.md](cases/05-trucking.md) | 5 | 8 | 2 | 0 | 15 |
| MNT | Maintenance, service plans and tyres | [cases/05-trucking.md](cases/05-trucking.md) | 4 | 8 | 2 | 0 | 14 |
| EXP | Expenses and profitability | [cases/06-finance.md](cases/06-finance.md) | 4 | 10 | 1 | 0 | 15 |
| QUO | Quotations | [cases/06-finance.md](cases/06-finance.md) | 2 | 7 | 0 | 0 | 9 |
| INV | Invoices, payments and receivables | [cases/06-finance.md](cases/06-finance.md) | 11 | 12 | 0 | 0 | 23 |
| PDF | PDF documents (invoices, quotations, job exports) | [cases/06-finance.md](cases/06-finance.md) | 2 | 6 | 1 | 0 | 9 |
| ANA | Analytics and dashboard figures | [cases/06-finance.md](cases/06-finance.md) | 8 | 9 | 1 | 0 | 18 |
| NOT | Notifications, toasts, emails and real-time behaviour | [cases/07-cross-cutting.md](cases/07-cross-cutting.md) | 1 | 6 | 3 | 0 | 10 |
| NEG | Negative, validation and edge cases | [cases/07-cross-cutting.md](cases/07-cross-cutting.md) | 1 | 13 | 2 | 0 | 16 |
| BRW | Browser, device and responsive matrix | [cases/07-cross-cutting.md](cases/07-cross-cutting.md) | 3 | 8 | 3 | 0 | 14 |
| A11Y | Accessibility basics | [cases/07-cross-cutting.md](cases/07-cross-cutting.md) | 0 | 5 | 4 | 1 | 10 |
| PERF | Performance sanity | [cases/07-cross-cutting.md](cases/07-cross-cutting.md) | 1 | 5 | 3 | 0 | 9 |
| SMK | Post-deploy smoke test for the live URL (15 minutes) | [cases/08-smoke.md](cases/08-smoke.md) | 9 | 9 | 2 | 0 | 20 |
| **All** | | | **180** | **283** | **51** | **3** | **517** |

Counts above are generated from the case files; the CSV has one row per case with the same ids.

## Where each requested area is covered

| Area | Module(s) |
|---|---|
| Sign-up, login (Clerk and legacy) | AUTH |
| Onboarding and empty company | ONB |
| Trial, plans, billing, EcoCash reminder e-mails | BILL |
| User management and plan limits | USR |
| Read-only after trial or non-payment | ROL |
| 30-day deletion (owner-requested and automatic) | DEL |
| Multi-tenancy isolation with explicit two-company cross-checks | TEN (plus DEX for exports, SMK-013 on production) |
| Vehicles, drivers, customers, contractors and rates | VEH, DRV, CUS, CTR |
| Jobs: create, edit, delete (jobs have no status field; billing state is shown through invoices) | JOB |
| Excel import and AI photo import | IMP |
| Trips and cross-border | TRP |
| Trailers and compliance documents | TRL |
| Fuel logs and the weekly fuel check | FUE |
| Expenses and profitability | EXP |
| Maintenance, service plans, tyres | MNT |
| Quotations, invoices, payments, receivables, PDFs | QUO, INV, PDF |
| Analytics and dashboard figures with hand-checkable examples | ANA (data in TEST_DATA section 6) |
| Admin console | ADM |
| Data export | DEX |
| Notifications, toasts, e-mails, sockets (none exist) | NOT |
| Permissions and roles | PRM |
| File uploads | UPL |
| Negative and validation cases | NEG (and the validation cases inside each module) |
| Browser, device and responsive matrix | BRW |
| Accessibility basics | A11Y |
| Performance sanity | PERF |
| Security: IDOR, XSS, injection, auth, headers | SEC (and TEN) |
| Post-deploy smoke test for the live URL | SMK |

## Suggested order of execution

1. SMK on staging.
2. AUTH, ONB, PRM (get accounts and roles right first).
3. BILL, USR, ROL (time-dependent: do them with the `TEST_DATA.md` time-travel helper).
4. VEH, DRV, CUS, CTR, JOB, IMP (build the data).
5. TRP, TRL, FUE, MNT, EXP, QUO, INV, PDF, ANA (use QA Stats Co for the worked examples).
6. TEN, SEC, UPL, DEX, ADM (needs both companies populated).
7. DEL last on staging (destructive), then NOT, NEG, BRW, A11Y, PERF.
8. SMK on production after deployment.

## Traceability to sources

| Source | Covered by |
|---|---|
| docs/SAAS_PLAN.md phases 0-6 (security, tenancy, modules, tractor units and trips, quotations/invoices/payments, AI import, maintenance and tyres) | SEC, TEN, PRM, TRL, TRP, QUO, INV, IMP, MNT |
| docs/FUEL_PROCEDURE.md (OK/Check/Review rules, Monday check, WhatsApp summary, private fuel) | FUE, EXP |
| docs/AI_IMPORT_AND_CROSS_BORDER_SPEC.md (ledger fields, flags, canonical schema) | IMP, TRP |
| docs/plan/STATUS.md and RELEASE_CHECKLIST.md (billing, read-only, auto-deletion, admin console, release checks) | BILL, USR, ROL, DEL, ADM, DEX, SMK |
| docs/compliance/ (30-day deletion, export promise, not-a-tax-invoice footer) | DEL, DEX, PDF |
| backend/config/plans.js, modules.js; services/billing.js, billingEmails.js, companyDeletion.js, fuelCheck.js, invoicing.js; middleware/*; controller/* | the numeric and wording expectations in the matching modules |
