# MyFleet QA: test data and fixtures

Everything the test cases refer to by name is defined here. Build it once on **staging** (section 9 explains how to move dates), keep the **id sheet** in section 10 up to date, and rebuild from scratch when a release changes the data model.

Rules for test data:

- Every company, user, customer, vehicle and so on that QA creates starts with **QA**, so it can be found and deleted. Never use a real customer's name, ID number, phone number or photo. Use synthetic ID numbers and generated or stock images for driver documents.
- Production gets only the two dedicated smoke companies in section 8. Nothing else.
- Reference amounts below are written so you can check the application by hand. If you change a rate or a date, recompute the expected values.

## 1. Accounts and roles

All e-mail addresses must be real inboxes you control (Clerk verifies them). Plus-addressing on one mailbox works well: `qa+alpha-admin@<your-domain>`.

| Persona | Company | Clerk organisation role | App role | Notes |
|---|---|---|---|---|
| ALPHA-ADMIN | QA Alpha Haulage | org:admin | Deliverer Admin | Main working user. Can use finance routes, modules, export, deletion, add users. |
| ALPHA-MGR | QA Alpha Haulage | org:member | Deliverer Manager | Day-to-day user. No finance routes, no modules, no export, no deletion. |
| BRAVO-ADMIN | QA Bravo Freight | org:admin | Deliverer Admin | The "other company" in every isolation test. |
| BRAVO-MGR | QA Bravo Freight | org:member | Deliverer Manager | |
| BOTH-USER | Alpha and Bravo | member of both organisations | follows the active organisation | For organisation-switching tests (AUTH-009, TEN-029). |
| STATS-ADMIN | QA Stats Co | org:admin | Deliverer Admin | Holds the hand-checkable worked-example data (sections 6 and 7). |
| FRESH | created during AUTH-001/002 | org:admin | Deliverer Admin | Brand-new company, no data. Make a new one each test cycle. |
| STATE-<X>-ADMIN (STATE-EXPIRED-ADMIN, STATE-GRACE-ADMIN, STATE-OVERDUE-ADMIN, STATE-SUSPENDED-ADMIN, STATE-CANCELLED-ADMIN, STATE-ENDING-ADMIN, STATE-ACTIVE-ADMIN, STATE-LEGACY-ADMIN) | the matching "QA State <X>" company in section 2 | org:admin | Deliverer Admin | One admin per state company. |
| LIMIT-ADMIN, DOOMED-ADMIN, TIMELINE-ADMIN | QA Limit Co, QA Doomed, QA Timeline | org:admin | Deliverer Admin | Limit, purge and auto-deletion tests. |
| PLATFORM | none (or any) | none | Super Admin | Needed for the Admin console and billing changes. See below. |
| SITE | none | none | Site Admin | Optional; for PRM site-admin cases. |
| SMOKE-ADMIN, SMOKE-EXPIRED-ADMIN, SMOKE-PLATFORM | production smoke companies (section 8) | | | Production only. |

**Platform admins cannot be created in the app.** Sign the person up through Clerk first (no organisation), then ask a developer to run one database update on the staging database: `db.users.updateOne({email:"<platform email>"}, {$set:{role:"Super Admin"}})` (use `Site Admin` for SITE). Platform admins do not need an organisation; their data access is through the Admin console and the API.

## 2. Companies (tenants)

Create each company by signing up a new user and creating the organisation (that creates a starter-band, 30-day trial company). Then a platform admin sets the state with the helper in section 9.

| Company | Purpose | State to set (PUT /api/v2/tenant/billing) | Modules |
|---|---|---|---|
| QA Alpha Haulage | Main company for functional tests | band fleet, status active, paidUntil = today + 365 days | all ON |
| QA Bravo Freight | Isolation counterpart | same as Alpha | all ON |
| QA Stats Co | Worked-example numbers | band fleet, status active, paidUntil = today + 365 days | all ON |
| QA Fresh Haulage | Onboarding / empty company | leave as created (starter, trial 30 days) | defaults (only Revenue analytics ON) |
| QA State Ending | Trial ending banner / email | trialEndsAt = now + 5 days | defaults |
| QA State Expired | Read-only after trial | trialEndsAt = now - 2 days | defaults |
| QA State Active | Paying company | status active, paidUntil = now + 20 days | defaults |
| QA State Grace | Inside the 7-day grace | status active, paidUntil = now - 3 days | defaults |
| QA State Overdue | Read-only because unpaid | status active, paidUntil = now - 10 days | defaults |
| QA State Suspended | Suspended | status suspended | defaults |
| QA State Cancelled | Cancelled | status cancelled | defaults |
| QA State Legacy | Pre-billing company: unlimited, never read-only | developer runs `db.deliverers.updateOne({companyName:"QA State Legacy"},{$unset:{billing:1}})` | defaults |
| QA Limit Co | User and truck limits | band starter, status trial, trialEndsAt = now + 10 days; exactly 3 users (one admin + 2 managers created through Admins > Add) and exactly 2 trucks (LIM1001, LIM2002) | defaults |
| QA Doomed | Purge testing (destructive) | any; give it every record type (list in section 7) and a second user | all ON |
| QA Timeline | Auto-deletion timeline | band starter, status trial | defaults |

If a case needs a "fleet at 10 users" or "pro at 25 users/trucks" company, ask a developer to run the seed script for it or use the bulk helper in section 9.

## 3. Reference data per company

### Alpha (QA Alpha Haulage)

| Type | Records |
|---|---|
| Customers | Depot; Delta Mining; Beta Foods; Gamma Steel; "Alpha Exclusive Customer ALPHA-ONLY" |
| Vehicles | QAA1001 Toyota Dyna, Small (<=5T); QAB2002 Isuzu NPR, Medium (<=10T); QAC3003 Hino 500, Large (10T+); QAD4004 Volvo FH, Horse |
| Drivers | Tendai (ID number 63-1234567X63); Chipo (ID number 63-7654321Y63). Both with a licence image and an ID image. |
| Contractors | Lammel QA (prefix LQ, last order 1) and U-Plan QA (prefix UP, last order 1), with the rate tables below |
| Trailers (Tractor units ON) | ZZA 1234 tautliner, 3 axles, 34 t; ZZB 5678 flatbed, 2 axles, 28 t |

Rates (dollars per km):

| Contractor | Job type | Small | Medium | Large | Horse |
|---|---|---|---|---|---|
| Lammel QA | local | 0.60 | 0.90 | 1.20 | 2.50 |
| Lammel QA | express | 0.45 | 0.70 | 0.95 | 2.00 |
| U-Plan QA | local | 0.70 | 1.00 | 1.30 | 2.60 |
| U-Plan QA | express | 0.50 | 0.75 | 1.00 | 2.10 |

Lammel QA: goods types, delivery types local and express, vehicle types all four. U-Plan QA the same.

### Bravo (QA Bravo Freight)

Deliberately overlaps with Alpha so "same name" tests are real, plus records that exist only in Bravo.

| Type | Records |
|---|---|
| Customers | Depot; Delta Mining (same names as Alpha); "Bravo Exclusive Customer BRAVO-ONLY" |
| Vehicles | QAA1001 Toyota Dyna (same plate as Alpha); "BRV9001 Bravo Truck BRAVO-ONLY" |
| Drivers | Tendai (same ID number 63-1234567X63 as Alpha); "Bravo Driver BRAVO-ONLY" (ID 63-9990001B63) |
| Contractors | Lammel QA (same name, same rates); "Bravo Contractor BRAVO-ONLY" |
| Trailers | ZZA 1234 (same registration as Alpha); "BRV 0001 BRAVO-ONLY" |
| Trip | clientRef AL.01 (same as Alpha's) and one trip "Bravo Trip BRAVO-ONLY", price 777 |
| Invoice | one issued invoice customer "Delta Mining", total 500.00 USD, plus one Bravo payment of 100.00 |
| Expense / fill | one expense "BRAVO-ONLY expense" (service, 40.00) and one fuel fill on BRV9001 |
| Quotation, document, maintenance record, tyre | one of each, named with BRAVO-ONLY |

Record the Mongo ids of all Bravo records in the id sheet (section 10). Cross-checks in TEN-xxx use those ids from Alpha's session.

### QA Stats Co

Same reference data as Alpha (customers: Depot, Delta Mining, Beta Foods, Gamma Steel, Spare Customer = 5; vehicles QAA1001, QAB2002, QAC3003, QAD4004; drivers Tendai, Chipo; contractors Lammel QA and U-Plan QA with the same rates). **No other jobs may exist.**

## 4. Other fixtures

- **Photos for drivers**: two small JPG files (under 1 MB), one PNG, one WebP, one 3 MB JPG, one 4.5 MB PDF, one 10 MB PDF, a renamed text file `fake.jpg`, an SVG with `<script>`, an `.exe` renamed to `.jpg`. Keep them in a folder, never in the repo.
- **Logbook photos for AI import**: use the pictures in `frontend/public/sample-log-sheets-images/` (no real driver data) plus a blank white JPG and an iPhone HEIC file.
- **Text payloads**: XSS `"><img src=x onerror=alert(1)><script>alert(2)</script>`; formula strings `=HYPERLINK("http://evil.test","click")`, `+1+1`, `@SUM(1+1)`; long strings of 5,000 and 100,000 characters; `Ñandú Éxpress 🚚`; `O'Neil & Sons`.

## 5. Sample Excel workbook QA_Vehicle_Log_QAA1001.xlsx (row by row)

Used by IMP-001 and following. Build it in Excel, or run the generator below from the repo's `backend` folder (the `xlsx` package is already installed there): save the snippet as `make-sample.js` **outside the repo**, adjust the require path, run `node make-sample.js`.

Sheet name `QAA1001`. Row 1 is the title, row 2 empty, row 3 the header, then the data. Dates are text in day/month/year order.

| # | Driver | Date | Time Out | Mileage Out | From | To | Mileage In | Time In | Total KM | Contractor | Type | What it tests / expected |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tendai | 05/01/2026 | 07:00 | 1000 | Depot | Delta Mining | 1050 | 08:00 | 50 | Lammel QA | | Ready. 50 km x 0.60 = 30.00 |
| 2 | (blank) | (blank) | 08:10 | 1050 | Delta Mining | Depot | 1100 | 09:00 | 50 | Lammel QA | | Driver and date carried over from row 1 (two warnings). Same job as row 1 (unbroken odometer). 30.00 |
| 3 | Tendai | 05/01/2026 | 10:00 | 1100 | Depot | Beta Foods | 1130 | 10:45 | 30 | PVT | | Skipped: "Private trip (PVT)" |
| 4 | Tendai | 06/01/2026 | 07:00 | 1130 | Depot | Beta Foods | 1160 | 08:00 | 30 | Lammel QA | express | Express small rate 0.45: 30 x 0.45 = 13.50 |
| 5 | Tendai | 07/01/2026 | 07:00 | 1160 | Depot | Delta Mining / Beta Foods | 1200 | 09:00 | 40 | Lammel QA | | Compound place: first name Delta Mining by default. 40 x 0.60 = 24.00 |
| 6 | Chipo | 08/01/2026 | 07:00 | 1200 | Depot | Unknown Place XYZ | 1220 | 08:00 | 20 | Lammel QA | | New customer "Unknown Place XYZ". 20 x 0.60 = 12.00 |
| 7 | Tendai | 09/01/2026 | 07:00 | 1220 | Depot | Beta Foods | 1210 | 08:00 | 10 | Lammel QA | | Error: "Mileage in is lower than mileage out" |
| 8 | Tendai | 09/01/2026 | 09:00 | 1230 | Depot | Beta Foods | 1260 | 10:00 | 35 | Lammel QA | | Ready; warning "Total KM says 35, mileage gives 30 - using 30". 30 x 0.60 = 18.00 |
| - | | | | | | | | TOTAL | | | | Row with TOTAL ends the log |
| 9 | Ghost | 10/01/2026 | | 1300 | Depot | Beta Foods | 1310 | | 10 | Lammel QA | | Below TOTAL: must be ignored |

Expected preview: **6 ready legs, 1 skipped, 1 error, 5 jobs** (rows 1 and 2 form one job). Expected commit message: **Imported 5 jobs (6 trips)**. Money added: 30.00 + 30.00 + 13.50 + 24.00 + 12.00 + 18.00 = **127.50**; kilometres added: 50+50+30+40+20+30 = **220**; dashboard "Total Jobs" rises by **6** (legs).

```js
// make-sample.js  (run from a folder where require("xlsx") resolves, e.g. the repo's backend folder)
const XLSX = require("xlsx");
const header = ["Driver","Date","Time Out","Mileage Out","From","To","Mileage In","Time In","Total KM","Contractor","Type"];
const rows = [
  ["Tendai","05/01/2026","07:00",1000,"Depot","Delta Mining",1050,"08:00",50,"Lammel QA",""],
  ["","","08:10",1050,"Delta Mining","Depot",1100,"09:00",50,"Lammel QA",""],
  ["Tendai","05/01/2026","10:00",1100,"Depot","Beta Foods",1130,"10:45",30,"PVT",""],
  ["Tendai","06/01/2026","07:00",1130,"Depot","Beta Foods",1160,"08:00",30,"Lammel QA","express"],
  ["Tendai","07/01/2026","07:00",1160,"Depot","Delta Mining / Beta Foods",1200,"09:00",40,"Lammel QA",""],
  ["Chipo","08/01/2026","07:00",1200,"Depot","Unknown Place XYZ",1220,"08:00",20,"Lammel QA",""],
  ["Tendai","09/01/2026","07:00",1220,"Depot","Beta Foods",1210,"08:00",10,"Lammel QA",""],
  ["Tendai","09/01/2026","09:00",1230,"Depot","Beta Foods",1260,"10:00",35,"Lammel QA",""],
  ["","","","","","","","TOTAL","","",""],
  ["Ghost","10/01/2026","",1300,"Depot","Beta Foods",1310,"",10,"Lammel QA",""],
];
const sheet = XLSX.utils.aoa_to_sheet([["TOYOTA DYNA - QAA 1001"], [], header, ...rows]);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "QAA1001");
XLSX.writeFile(book, "QA_Vehicle_Log_QAA1001.xlsx");
```

Variant workbooks (copy the sample and change one thing each):

| File | Change | Used by |
|---|---|---|
| V2_reordered.xlsx | Columns in a different order, an extra "Notes" column, header moved to row 6 | IMP header detection |
| V3_private_words.xlsx | Contractor values: blank, PVT, put, Private, priv, Personal, plus one real contractor | IMP private trips |
| V4_authorised_by.xlsx | Column renamed "Authorised By" (and a second copy with both "Contractor" and "Authorised By") | IMP contractor column |
| V5_two_vehicles.xlsx | Two sheets (QAA1001 and QAB2002, different mileages) plus a "Notes" sheet with free text | IMP multi-sheet and non-log sheet |
| V6_dates.xlsx | One leg each with dates 05/01/2026, 5-1-26, 2026-01-05, 5.1.2026, an Excel date serial, and an unreadable "n/a" | IMP date formats |
| V7_typo_names.xlsx | Driver "Tendi", place "Border Mukuvisi" with an existing "Border" customer | IMP fuzzy matching |
| V8_duplicates.xlsx | Row 1 copied twice | IMP duplicates in upload |
| V9_big.xlsx | 300 legs with ascending odometer | IMP performance |
| notes.txt, corrupt.xlsx (a renamed text file), 5 MB .xlsx, 11 copies | | IMP file validation |

## 6. ANALYTICS-2026 data set (QA Stats Co)

All dates are the order dates of the jobs (they are grouped by UTC calendar date). Odometers are chosen so legs are unbroken per vehicle.

### Jobs

| Job | Date | Contractor | Vehicle | Driver | Type | Legs (from > to, mileage out > in) | km | Cost |
|---|---|---|---|---|---|---|---|---|
| J1 | 2026-01-10 | Lammel QA | QAA1001 (small) | Tendai | local | Depot > Delta Mining, 1000 > 1100 | 100 | 100 x 0.60 = **60.00** |
| J2 | 2026-01-25 | Lammel QA | QAA1001 | Tendai | local | Delta Mining > Depot, 1100 > 1150 | 50 | 50 x 0.60 = **30.00** |
| J3 | 2026-02-03 | U-Plan QA | QAB2002 (medium) | Tendai | local | Depot > Beta Foods, 20000 > 20080 | 80 | 80 x 1.00 = **80.00** |
| J4 | 2026-02-14 | Lammel QA | QAB2002 | Chipo | express | Depot > Gamma Steel, 20080 > 20200 | 120 | 120 x 0.70 = **84.00** |
| J5 | 2026-02-20 | U-Plan QA | QAA1001 | Tendai | express | Depot > Beta Foods, 1150 > 1190 | 40 | 40 x 0.50 = **20.00** |
| J6 | 2026-03-05 | Lammel QA | QAC3003 (large) | Chipo | local | Leg 1 Depot > Delta Mining, 30000 > 30060 (60 km, **72.00**); Leg 2 Delta Mining > Beta Foods, 30060 > 30100 (40 km, **48.00**). One job number, two legs. | 100 | **120.00** |
| J7 | 2025-12-30 | Lammel QA | QAA1001 | Tendai | local | Depot > Delta Mining, 990 > 1000 | 10 | 10 x 0.60 = **6.00** (year 2025) |

### Expected 2026 results (jobs only)

| Measure | Value |
|---|---|
| Dashboard "Total Jobs" (legs) | 7 (J1 to J5 are one leg each, J6 is two) |
| "Tot Revenue" | 60 + 30 + 80 + 84 + 20 + 120 = **394.00** |
| Total km | 100+50+80+120+40+60+40 = **490** |
| Contractors tile | 2 |
| By month | January 2 jobs / 90.00 / 150 km; February 3 / 184.00 / 240 km; March 2 / 120.00 / 100 km |
| By day | 01-10: 1 / 60.00 / 100; 01-25: 1 / 30.00 / 50; 02-03: 1 / 80.00 / 80; 02-14: 1 / 84.00 / 120; 02-20: 1 / 20.00 / 40; 03-05: 2 / 120.00 / 100 |
| By contractor | Lammel QA: 5 jobs, 294.00, 370 km (74.6%); U-Plan QA: 2 jobs, 100.00, 120 km (25.4%) |
| By vehicle | QAA1001: 3 jobs, 110.00, 190 km; QAB2002: 2 jobs, 164.00, 200 km; QAC3003: 2 jobs, 120.00, 100 km |
| By driver | Tendai: 4 jobs, 190.00, 270 km; Chipo: 3 jobs, 204.00, 220 km |
| Year 2025 | 1 job, 6.00, 10 km, December |

### Expenses and income (2026)

| Id | Date | Type | Category | Vehicle | Amount | Flags |
|---|---|---|---|---|---|---|
| E1 | 2026-01-31 | expense | driver_salary | QAA1001 | 200.00 | paid to Tendai |
| E2 | 2026-02-15 | expense | insurance | QAB2002 | 150.00 | |
| E3 | 2026-02-28 | expense | owner_salary | none | 100.00 | left in the business |
| E4 | 2026-03-10 | expense | private_fuel | QAA1001 | 30.00 | tracked only |
| E5 | 2026-01-20 | income | cash_hire | QAA1001 | 50.00 | |
| E6 | 2026-03-01 | expense | fuel | QAC3003 | 80.00 | estimate (replaced by real fills) |

### Fuel fills on QAC3003 (set its expected km per litre to 4.0 first)

| Fill | Date and time | Odometer | Litres | Amount | Full tank | Photos | Expected result |
|---|---|---|---|---|---|---|---|
| F1 | 2026-03-02 08:00 | 10000 | 100 | 190.00 | yes | yes | first fill: OK, no km per litre |
| F2 | 2026-03-09 08:00 | 10360 | 80 | 152.00 | yes | yes | 360 km, 4.5 km/L, +12.5%, OK |
| F3 | 2026-03-16 08:00 | 10600 | 80 | 152.00 | yes | yes | 240 km, 3.0 km/L, -25%: CHECK |
| F4 | 2026-03-23 08:00 | 10600 | 40 | 76.00 | yes | yes | odometer did not go up: REVIEW |
| F5 | 2026-03-23 12:00 | 10640 | 10 | 19.00 | yes | **no** | 40 km, 4.0 km/L; second fill within 12 h and no photos: CHECK |

Weekly results: week of Mon 2026-03-02: 1 fill, 100.0 L, $190.00, km 0, no km/L, OK. Week of 03-09: 80.0 L, $152.00, 360 km, 4.5 km/L, expected litres 90.0, OK. Week of 03-16: 80.0 L, $152.00, 240 km, 3.0 km/L, expected litres 60.0, CHECK. Week of 03-23: 50.0 L, $95.00, 40 km, 4.0 km/L, expected litres 10.0, REVIEW.

### Expected profitability for 2026

| Month | Job revenue | Extra income | Revenue | Counted expenses | Profit | Cash profit | Private fuel |
|---|---|---|---|---|---|---|---|
| January | 90.00 | 50.00 | 140.00 | 200.00 | -60.00 | -60.00 | 0 |
| February | 184.00 | 0 | 184.00 | 250.00 (150 + 100) | -66.00 | 34.00 | 0 |
| March | 120.00 | 0 | 120.00 | 589.00 (190+152+152+76+19; E6 estimate dropped) | -469.00 | -469.00 | 30.00 |
| **Year** | 394.00 | 50.00 | **444.00** | **1,039.00** | **-595.00** | **-495.00** | 30.00 |

Per vehicle: QAA1001 revenue 160.00, expenses 200.00, profit -40.00 (private fuel 30.00); QAB2002 revenue 164.00, expenses 150.00, profit 14.00; QAC3003 revenue 120.00, expenses 589.00, profit -469.00; whole business (no vehicle) expenses 100.00, profit -100.00, cash profit 0.00. Profits add up to -595.00.

## 7. Other worked data (QA Stats Co unless stated)

### Trips (Cross-border ON)

| Trip | Date | Client | Route (place, country) | Price | Status | Distance | Costs |
|---|---|---|---|---|---|---|---|
| T1 | 2026-03-05 | Delta Mining | Harare ZW > Bulawayo ZW | 1500 USD | delivered | 300 km | fuel 400, toll 50, border_fee 120 (USD): total 570.00, margin 930.00 |
| T2 | 2026-03-08 | Delta Mining | Harare ZW > Johannesburg SA | 2000 USD | delivered | 800 km | fuel 700 (USD) |
| T3 | 2026-03-12 | Beta Foods | Musina SA > Harare ZW | 30000 ZAR | delivered | 1000 km | fuel 12000 (ZAR) |
| T4 | 2026-03-15 | Gamma Steel | Harare ZW > Mutare ZW | 900 USD | cancelled | 100 km | none |

Expected summary (all of 2026): trips 3, cross-border trips 2, distance 2100 km, USD revenue 3500.00 and ZAR revenue 30000.00.

### Invoices for receivables ageing (customer "Ageing Customer X", USD, all issued and unpaid; asOf = 2026-11-08)

| Invoice | Balance | Due date | Days overdue | Bucket |
|---|---|---|---|---|
| INV-A | 100.00 | 2026-11-20 | not due | current |
| INV-B | 50.00 | 2026-10-20 | 19 | 1-30 |
| INV-C | 80.00 | 2026-09-20 | 49 | 31-60 |
| INV-D | 40.00 | 2026-07-01 | 130 | over 90 |

Total 270.00. (Create each invoice as a one-line draft with the due date, then issue it. The issue date must not be after the due date.)

Auto-allocation set (customer "Payment Customer Y"): A 100.00 issued 2026-01-01, B 50.00 issued 2026-02-01, C 80.00 issued 2026-03-01.

Invoice arithmetic set: lines 2 x 45.50 and 1 x 100.00, tax 15% gives subtotal 191.00, tax 28.65, total 219.65; paid 100.00 gives balance 119.65; credit notes 20.00 then 99.65 settle it.

### Documents and maintenance

Compliance documents expiring on D-1, D, D+30, D+31, D+365 where D is the test day. Service plan "Full service" every 10,000 km, last done at odometer 50,000, truck odometer 59,500. Tyre T-001 cost 400.00 fitted at 50,000, truck now 60,000 (0.04 per km). Workshop records 150.00 and 50.00.

### QA Doomed inventory

At least: 2 users, 3 vehicles, 2 drivers with both documents, 5 customers, 2 contractors with rates, 10 jobs (one multi-leg), 2 trips, 1 trailer, 2 invoices (one issued, one paid), 1 payment, 1 quotation, 3 expenses, 3 fuel fills, 1 compliance document, 1 maintenance record, 1 service plan, 1 tyre with a fitment. Write the counts in the id sheet before the purge.

## 8. Production smoke companies (the only QA data allowed on production)

| Company | Purpose | Contents |
|---|---|---|
| QA Smoke Co | Writable canary | billing: band fleet, status active, paidUntil 12 months ahead (renew it every 6 months). All modules ON. 3 customers (SMOKE CUSTOMER 1..3); 2 vehicles SMK1001 (small) and SMK2002; 1 driver "Smoke Driver" with licence and ID images; contractor "Smoke Contractor" prefix SM, local small rate 1.00 per km (all other rates 1.00); 3 jobs of 50, 30 and 20 km (revenue 100.00 in total, 3 jobs). |
| QA Smoke Other | Cross-company canary | any billing; contains one customer named "CANARY ONLY"; note its id for SMK-013. |
| QA Smoke Expired | Read-only canary | status trial, trialEndsAt in the past (e.g. 2026-01-01) |

Accounts: SMOKE-ADMIN (Smoke Co admin), SMOKE-EXPIRED-ADMIN, SMOKE-PLATFORM (a Super Admin). Use a password manager; never use these accounts for anything else. A failed smoke case is an incident, not a re-run candidate.

## 9. Tools and helpers

All snippets run in the browser **Console** of the app while signed in (Clerk build). Replace `<...>`. Use staging for anything that changes data.

**API helper** (paste once per page load):

```js
async function api(method, path, body) {
  const t = await window.Clerk.session.getToken(); // valid for about 60 seconds; call it fresh each time
  const r = await fetch('/api/v2' + path, {
    method, credentials: 'include',
    headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}
```

On a local legacy build (no Clerk) use `credentials: 'include'` without the Authorization header.

**List companies and their ids** (as PLATFORM): `await api('GET', '/admin/companies')`.

**Time travel (as PLATFORM)** - set the state of a company:

```js
// trial ends in 5 days
await api('PUT', '/tenant/billing', { companyId: '<id>', status: 'trial', trialEndsAt: new Date(Date.now() + 5*864e5).toISOString() });
// trial ended 2 days ago
await api('PUT', '/tenant/billing', { companyId: '<id>', status: 'trial', trialEndsAt: new Date(Date.now() - 2*864e5).toISOString() });
// paid, due in 20 days
await api('PUT', '/tenant/billing', { companyId: '<id>', band: 'fleet', status: 'active', paidUntil: new Date(Date.now() + 20*864e5).toISOString() });
// overdue by 10 days
await api('PUT', '/tenant/billing', { companyId: '<id>', status: 'active', paidUntil: new Date(Date.now() - 10*864e5).toISOString() });
```

Allow up to 30 seconds for the server cache before testing the effect.

**Run the reminder job and the purge job** (staging only; needs the staging CRON_SECRET):

```
curl -H "Authorization: Bearer <CRON_SECRET>" https://<staging>/api/v2/tenant/billing-notices
curl -H "Authorization: Bearer <CRON_SECRET>" https://<staging>/api/v2/tenant/purge-due
```

For fast purge tests set `DELETION_GRACE_DAYS=0` on staging (then a deletion request is due immediately) and revert afterwards. **Never** run these two commands against production.

**Bulk-create trucks** (for limit tests, e.g. to reach 25 trucks):

```js
for (let i = 1; i <= 23; i++) {
  await api('POST', '/vehicle/create-vehicle', { make: 'QA Truck', size: 'smallVehicle', regNumber: 'BLK' + String(1000 + i) });
}
```

Reg numbers are 3 letters plus 4 digits. Stop at the first non-201 status.

**Set a truck's expected km per litre**: `await api('PUT', '/vehicle/update-vehicle', { id: '<vehicleId>', make: 'Hino 500', size: 'largeVehicle', regNumber: 'QAC3003', expectedKmPerLitre: 4 })`.

**Seeding more users** (for the 3 / 10 / 25 user limits): create them with Admins > Add; a developer can also seed them directly.

## 10. Id sheet (fill in on every rebuild)

| Item | Alpha | Bravo | Stats Co |
|---|---|---|---|
| Company id | | | |
| Vehicle QAA1001 / BRV9001 | | | |
| Driver Tendai / Bravo driver | | | |
| Customer Delta Mining / Bravo exclusive | | | |
| Contractor Lammel QA / Bravo contractor | | | |
| Job (one each) | | | |
| Trailer | | | |
| Trip | | | |
| Issued invoice | | | |
| Payment | | | |
| Expense | | | |
| Fuel fill | | | |
| Quotation | | | |
| Compliance document | | | |
| Tyre / plan / maintenance record | | | |
| Driver licence file key (tenants/.../driver-licence/...) | | | |

## 11. Reset and clean-up

- After each cycle delete the FRESH company through the Delete company flow (it also exercises DEL-001) or ask a developer to purge it.
- Rebuild QA Doomed, QA Timeline and the state companies when a time-dependent case consumed them (their dates drift).
- If Stats Co data is damaged, a platform admin can run POST /overallStats/rebuild-stats {companyId} to rebuild the statistics from the jobs; then re-check the section 6 totals.
- Remove stray files from the Drivers test (documents are deleted with the driver).
