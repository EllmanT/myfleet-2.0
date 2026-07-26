# Jobs reseed from Excel/PDF — handoff / resume notes

**Read this first if picking up after a restart.** This documents exactly where
this task stands so work can resume without re-deriving anything. Written
2026-07-26, mid-implementation.

## 0. STATUS UPDATE (2026-07-26, later same day)

MongoDB was back up. `run.js` was built (§5), run successfully, but the
**first run had a bug**: it wiped every local job with `orderDate >= 2025-01-01`
with no upper bound. The Excel source files only cover through Jun 2026, so
July 2026 jobs the user had entered directly into the local app (not from any
Excel file) got deleted and never replaced — real data loss risk.

**Recovered:** live Mongo (Atlas) still had the 129 July 2026 jobs (local →
live is a one-way mirror via `migrateToAtlas.js`, so live still held a copy
from before local's July data existed only locally). Confirmed with the user
no jobs were entered locally after 2026-07-22 (live's cutoff) that would be
unrecoverable. Copied those 129 docs from live back into local by `_id`
(all their `from`/`customer`/`vehicleId`/`driverId`/`contractorId` references
already existed in local with matching ids — verified before copying), then
called `rebuildJobRelationships(db)`.

**Fixed:** `run.js`'s wipe logic no longer uses an open-ended date boundary.
It now derives a `{vehicleId, monthStart, monthEnd}` bucket per distinct
(vehicle, year-month) pair actually present in the parsed source data
(`buildReplaceBuckets` in `run.js`), and only deletes+replaces jobs matching
those exact vehicle+month combinations. Any month with no corresponding
source file (the current in-progress month, future months) is structurally
never touched — no cutoff date to remember to update by hand each time this
is rerun for a new month.

**Verified on local:** reran the fixed `run.js` — reproduced identical
Jan 2025–Jun 2026 totals (idempotent: it deleted exactly its own
previously-inserted 4269 jobs and reinserted the same 4269), and July 2026's
129 jobs were untouched (confirmed via direct count query and by clicking
**Sync Stats** in the running app — dashboard's Yearly Analysis chart showed
July's revenue collapsing to ~0 before the fix, restored to the correct
value after).

Local total jobs after all this: 7343 (pre-2025 untouched data + 4269
reimported Jan2025–Jun2026 + 129 recovered July 2026).

**DONE (2026-07-26):** user explicitly confirmed, `migrateToAtlas.js` was
run. Live now matches local exactly — verified 7343 total jobs and 129 July
2026 jobs on both sides. Scratch cleanup done (`backend/scratch_analyze_jobs.js`,
root `scratch_jobs_report.json` deleted). **Task complete.**

Original write-up below is otherwise still accurate for the historical
Mongo-not-running blocker; §5/§6 are now superseded by the status update
above but left for context.

## 1. The task, in one paragraph

The user keeps the real, hand-adjusted job records (per vehicle, per month:
job legs, distance, cost, mileage) in Excel/PDF files under
`all jobs 2025 to 2026/{2025-jobs,2026-jobs}/` in the repo root, because they
edit numbers outside the app. The local MongoDB `jobs` collection is stale for
2025+ (only goes up to 2025-03-31). Goal: make those Excel/PDF files the
source of truth for **Jan 2025 – Jun 2026**, load them into the `jobs`
collection, refresh derived relationships/stats, verify locally, then mirror
local → live (production) Mongo. Full plan (already approved by the user) is
at `C:\Users\Ropafadzo Muridzi\.claude\plans\mutable-crafting-backus.md`.

## 2. Decisions already confirmed with the user (do not re-ask)

- **Driver assignment** (no file has a driver column anywhere; `Job.driverId`
  is required and driver analytics depend on it): one fixed driver per
  vehicle for the whole import —
  - `AAV4331` (Toyota Dyna, small) → **Chamu**
  - `AFO0724` (Toyota Dyna, small) → **Chris**
  - `AFE5848` (DAF, medium) → **Chris**
  - `AEX7352` (Iveco Eurocargo, medium) → **Chris**
- **Wipe boundary**: keep every existing job with `orderDate < 2025-01-01`
  untouched. Delete and fully replace any job with `orderDate >= 2025-01-01`
  in the **local** DB (live is untouched until the separate final step).
- **Customer/location matching**: match `From`/`Customer` text
  case-insensitively (trimmed) against existing `Customer.name`; anything
  unmatched is auto-created as a new `Customer` (name only, no review gate).
- **Rollout sequencing**: build + validate against local DB only. Live Mongo
  is only touched in a later, separate, explicitly-confirmed step (see §7).

## 3. What's been fully investigated (don't redo this research)

- Confirmed via `backend/model/*.js`: `Job` requires `jobNumber, from
  (ObjectId→Customer), customer (ObjectId→Customer), distance, cost
  (Decimal128), mileageOut/mileageIn (String), orderDate, description,
  deliveryType, contractorId, vehicleId, driverId`.
- Confirmed the dashboard's **"Sync Stats"** button
  (`frontend/src/redux/actions/overallStats.js` → `POST
  /api/v2/overallStats/rebuild-stats` → `backend/controller/overallStats.js`)
  already just calls `rebuildStatsFromJobs` from
  `backend/scripts/seed/rebuildStatsFromJobs.js`. **No new sync code is
  needed** — after import, clicking Sync Stats in the running app is the
  correct, already-built way to (re)generate `overallstats/vehiclestats/
  driverstats/contractorstats`. This is also the built-in verification step.
- `rebuildStatsFromJobs`'s `buildOverallStats` reads `deliverer.job_ids` to
  scope which jobs belong to the company — so after inserting jobs directly
  into Mongo, `job_ids` on vehicles/drivers/contractors/deliverers **must** be
  refreshed first, or Sync Stats will silently miss the new jobs. That
  refresh logic existed inline in `backend/scripts/seed/index.js` and has
  been extracted into its own reusable module (done — see §4).
- `backend/scripts/migrateToAtlas.js` already does exactly "wipe destination
  collections, copy everything from source" between
  `MONGO_URI_LOCAL`/`OFFLINE_DB_URL` → `MONGO_URI_LIVE`/`DB_URL` (all four env
  vars already set in `backend/config/.env`). **This is the live-rollout
  step later — no new script needed for it**, just run it once local is
  verified.
- Contractor prefix → company name (confirmed against the live `contractors`
  collection's `prefix` field, and cross-checked against every prefix that
  appears in the source files): `LM→Lammel, RK→Romeo Kitchens, BH→Besthule,
  UF→Ufurn, CR→Carador, MN→Moxon`.
- Vehicles in DB: `AEX7352` (Iveco Eurocargo, medium), `AFE5848` (DAF,
  medium), `AFO0724` (Toyota Dyna, small), `AAV4331` (Toyota Dyna, small) —
  exactly matches the 4 vehicle families across all files.
- File layout (verified across all ~40 files + both PDFs): title row
  (cosmetic, sometimes stale — **never trust it**), blank row, header row
  (`J/N|D/T|From|Customer|Out|In|Dist|Cost|Job Date`, one file uses `Job
  No|Type|...`), then one row per **leg** (a job number spans 2+ consecutive
  rows). Some files end with a `TOTAL` row to be excluded. Newer 2026
  "Vehicle: AFE5848" style files have an extra **Contractor** column already
  filled in, header row at index 4 instead of 2.
- Known data-quality quirks already accounted for in the parser/logic:
  - Several files' printed header total (JOBS/DIST/COST) doesn't match the
    row-level sum (e.g. `TOYOTA AAV MARCH 2025.xlsx` header says 950KM but
    rows sum to 1330KM). **Rule applied: always trust row-level data, never
    the header text.** `buildReport.js` surfaces these as `headerMismatches`
    for visibility, but does not block on them.
  - `toyota_aav_march_2026 (1).xlsx` has one stray malformed row (distance
    `23`, no job number) — dropped automatically (any row missing a job
    number/valid distance/cost/date is dropped, see `parseWorkbook.js`).
  - `Toyota aav feb 2026.xlsx` (through 2026-03-03) and
    `toyota_aav_march_2026 (1).xlsx` (from 2026-03-02) overlap by ~1 day —
    `collectAllRows.js` builds an exact-duplicate-leg key (vehicle + job
    number + from + customer + mileageOut + mileageIn + date) and skips
    exact duplicates automatically, recording them under `duplicates` in the
    report.
- The two Iveco PDFs (`iv aex january latest 2025 (2).pdf` — 62 rows/legs,
  `iveco aex feb 2025_3.pdf` — 2 rows/legs) are the **only** Iveco AEX data
  that exists (Jan/Feb 2025 only, nothing after). Both were read via the
  Read tool (which extracts PDF tables cleanly — no ambiguous word-splitting
  needed) and transcribed by hand into
  `backend/scripts/importExcelJobs/convertIvecoPdfs.js`. **Already run
  successfully** — see §4. Cost sums matched the PDF header exactly for both
  months (integrity check passed); distance sum for January differs from the
  PDF's printed header by 30km, which is the same known "stale header text"
  pattern as other files (every row's cost = distance × $2.95 local rate
  checks out internally, so the row data is trusted, not the header).

## 4. What's been implemented and already verified working

All new code lives under `backend/scripts/importExcelJobs/`:

| File | Status | Purpose |
|---|---|---|
| `fileManifest.js` | ✅ done | `SOURCE_ROOT`, `VEHICLES`, `DRIVER_BY_VEHICLE`, `CONTRACTOR_PREFIXES`, and the explicit `FILE_VEHICLE_MAP` (filename → vehicle regNumber, or → `{sheetName: regNumber}` for the one multi-vehicle aggregate file) for all ~40 files. |
| `convertIvecoPdfs.js` | ✅ done, **already run successfully** | Writes `IVECO AEX JAN 2025.xlsx` and `IVECO AEX FEB 2025.xlsx` into `all jobs 2025 to 2026/2025-jobs/` from hardcoded transcribed PDF rows. Validates cost sum against the PDF's declared header (hard fail on mismatch) and warns (not fails) on distance mismatch. **These two xlsx files already exist on disk** — do not need to be regenerated unless this script is edited. |
| `parseWorkbook.js` | ✅ done | `parseSheet(sheet, {sourceFile, sourceSheet})` — finds the header row (searches first 30 rows, handles both header layouts), maps columns fuzzily, stops at a `TOTAL` row, coerces Excel-serial or `dd/mm/yyyy` dates, drops rows missing jobNumber/distance/cost/date, returns `{rows, dropped, columnMap, headerRowIndex, titleRowRaw}`. |
| `resolveEntities.js` | ✅ done | `loadReferenceData(db)` (read-only: loads contractors/vehicles/drivers/customers into lookup maps, validates every manifest vehicle/driver exists in DB — throws early if not). `resolveRow(row, vehicleRegNumber, refData, pendingNewCustomers)` resolves one parsed row into a `jobDraft` (contractor via jobNumber prefix, vehicle/driver via manifest, customer/from via case-insensitive name match, staging unmatched names in `pendingNewCustomers` without creating them yet). `finalizeJobDraft(jobDraft, refData)` turns a draft into a final Mongo-ready Job document **after** pending customers have actually been created and `refData.customerIdByName` updated. |
| `collectAllRows.js` | ✅ done | `collectAllRows(refData)` — walks every file/sheet in `FILE_VEHICLE_MAP`, parses + resolves every row, does the cross-file exact-duplicate-leg detection, and returns `{perFile, jobDrafts, pendingNewCustomers, unresolved, duplicates}`. This is the shared core used by both the dry-run report and the real import. |
| `buildReport.js` | ✅ done, **not yet successfully run** (blocked, see §6) | Read-only dry run: connects to local Mongo, calls `loadReferenceData` + `collectAllRows`, writes `backend/scripts/importExcelJobs/report.json` (summary counts, per-file breakdown, header mismatches, list of new customers that would be created, unresolved rows, duplicate legs skipped). Makes **no writes**. |
| `run.js` | ✅ done, **run twice, verified idempotent, July-2026 regression fixed** | The actual orchestrator — see §0 for the July wipe bug and fix, §5 for original design (still accurate except the wipe-boundary description). |

Also touched:
- `backend/scripts/seed/rebuildJobRelationships.js` — **new file**, extracted
  verbatim from the function that used to be inline in
  `backend/scripts/seed/index.js`. Exports `rebuildJobRelationships(db)`.
- `backend/scripts/seed/index.js` — **edited**: now imports
  `rebuildJobRelationships` from the new module instead of defining it
  inline (behavior unchanged, just deduplicated so `run.js` can reuse it
  too).

Also present but **to be deleted before considering this done** (per the
approved plan — throwaway investigation artifacts, not part of the shipped
change):
- `backend/scratch_analyze_jobs.js`
- `scratch_jobs_report.json` (repo root)

## 5. `run.js` — what still needs to be built

Orchestrator, local DB only, should:

1. Connect to `OFFLINE_DB_URL` (same pattern as `buildReport.js`).
2. Call `loadReferenceData(db)` then `collectAllRows(refData)` (reuse as-is
   from `collectAllRows.js` — same logic the report uses, so the report you
   already reviewed is representative of what this will do).
3. **Abort loudly** if `unresolved.length > 0` (print them, exit non-zero) —
   these need a manifest/logic fix, not a blind import.
4. Create every customer in `pendingNewCustomers` (bulk insert into the
   `customers` collection: `{ name, createdAt, updatedAt }` — matches
   `backend/model/customer.js`, `name` is the only required field), then
   update `refData.customerIdByName` with the new ids so
   `finalizeJobDraft` can resolve them.
5. Call `finalizeJobDraft(jobDraft, refData)` for every draft in
   `jobDrafts` to get final Job documents.
6. Delete every doc in `jobs` where `orderDate >= 2025-01-01T00:00:00Z`
   (`db.collection("jobs").deleteMany({ orderDate: { $gte: new
   Date("2025-01-01T00:00:00.000Z") } })`).
7. `insertMany` the new job documents (batch if needed, `{ ordered: false }`
   matches the pattern used elsewhere in `scripts/seed/importCollections.js`).
8. Call `rebuildJobRelationships(db)` (from
   `backend/scripts/seed/rebuildJobRelationships.js`).
9. Print a final summary: total jobs inserted, per-vehicle/month counts,
   distance/cost totals — for the user to spot-check against the Excel
   headers.

Do **not** call `rebuildStatsFromJobs` from `run.js` — the plan deliberately
leaves that to the app's own "Sync Stats" button as the verification step
(see §3).

## 6. Current blocker (why you likely restarted)

Local MongoDB (Windows service `MongoDB`, config at `C:\Program
Files\MongoDB\Server\8.0\bin\mongod.cfg`, dbPath `C:\Program
Files\MongoDB\Server\8.0\data`, port 27017) was **stopped**, and:
- `Start-Service MongoDB` failed: "Cannot open MongoDB service" (needs admin
  rights not available in the sandboxed shell).
- Running `mongod.exe` directly against the same dbPath failed with
  `Permission denied` on `WiredTiger.lock` (Program Files data dir needs
  admin to write to, again not available in the sandboxed shell).
- The user mentioned MongoDB "fails to start sometimes when storage is
  running low" — worth checking free disk space on whatever drive
  `C:\Program Files\MongoDB\Server\8.0\data` lives on if it still won't start
  after the restart.

**To resume:** start MongoDB yourself (Services app → MongoDB → Start, or an
elevated PowerShell `Start-Service MongoDB`), then tell me to continue. I'll
verify connectivity, run `buildReport.js`, and walk through `report.json`
with you before writing/running `run.js`.

## 7. Full remaining sequence (after Mongo is back up)

1. Run `node backend/scripts/importExcelJobs/buildReport.js` — review
   `report.json` together (counts, header mismatches, new customers,
   unresolved rows, skipped duplicates). Fix anything surprising in the
   manifest/parser before proceeding.
2. Build `run.js` per §5.
3. Run `run.js` against local DB.
4. Start the app locally, log in, open the dashboard, click **Sync Stats**,
   spot-check numbers against the Excel totals for a few sampled
   vehicle/months, and check job list/report pages for a sampled
   vehicle/month against the source file.
5. **Only after explicit user sign-off on local numbers**: run
   `node backend/scripts/migrateToAtlas.js` to mirror local → live. This is
   a distinct, separately-confirmed action — do not run it as part of step
   3/4.
6. Clean up: delete `backend/scratch_analyze_jobs.js` and
   `scratch_jobs_report.json`.

## 8. Key paths/env reference

- Source data: `all jobs 2025 to 2026/{2025-jobs,2026-jobs}/` (repo root).
- New code: `backend/scripts/importExcelJobs/`.
- Reused seed infra: `backend/scripts/seed/{rebuildStatsFromJobs,
  rebuildJobRelationships,config,errors,logger}.js`.
- Env file: `backend/config/.env` — has `OFFLINE_DB_URL` (local Mongo,
  `mongodb://127.0.0.1:27017/myfleet-test2`), `DB_URL` (live), `MONGO_URI_LIVE`
  (live, used by `migrateToAtlas.js`/seed scripts) already set.
- Approved plan doc: `C:\Users\Ropafadzo Muridzi\.claude\plans\mutable-crafting-backus.md`.
