# AI import and cross-border ledger: mapping and design (draft)

Sources: the 4 cross-border ledger photos in `cross-border-trips/` (low resolution, photographed sideways, so some column names are my best reading), 12 local log-sheet photos and `Vehicle_Logs_October_2026 (2).xlsx` in `frontend/public/sample-log-sheets-images/`, and the existing importer in `backend/services/jobImport/`.

## 1. Two document families (do not mix them)

| | Local vehicle log (existing) | Cross-border ledger (new) |
|---|---|---|
| Granularity | One row = one leg between two places, with odometer in and out | One row = one whole trip/load |
| Owner of the paper | Driver, per vehicle | Office/transporter, per client, running list |
| Key fields | Driver, date, time out/in, mileage out/in, from, to, total km, contractor | Ref, date, transporter, route, cargo, client, supplier, distance, price, horse, trailer, delivery date, container no, comments |
| Money | Derived (rate x km) | Written on the sheet (price) |
| Destination | `Job` legs | New `Trip` record (plus invoice later) |

## 2. Cross-border ledger mapping (as read from the photos)

Columns, left to right across the pages (reading is approximate where marked ?):

| Sheet column | Canonical field | Notes |
|---|---|---|
| Date | `trip.date` | Loading date |
| Ref (AL.01, AL.02...) | `trip.clientRef` | The client's own job id, like "allea01". Not unique across tenants; unique per tenant and ideally per transporter |
| Transporter | `trip.transporterName` | "ALLEN"/Allea here; in the SaaS this is the tenant or a subcontractor, so keep it a field, not a constant |
| Loading and offloading points (e.g. Harare - Zim, Jobeeg - SA, Musina - Zim) | `trip.legs[]` (place, country) | One cell holds a route; split on dash/arrow into ordered stops with country tags |
| Description (fertilizer, granite slabs, natural stone, chrome, various) | `trip.cargo.description` | Free text; keep original, add optional cargo category |
| Client | `trip.customerName` | Matched to Customer |
| Supplier | `trip.supplierName` | The consignor/shipper |
| Distance | `trip.distanceKm` | Number |
| Price | `trip.price`, currency USD | Currency is USD for now (confirmed) |
| Horse reg | `trip.horseId` | Match to a vehicle of kind horse |
| Trailer reg | `trip.trailerId` | Match to a trailer; sometimes a link of two trailers |
| Delivery date | `trip.deliveredAt` | |
| Container number | `trip.containerNo` | Only for container loads |
| Comments | `trip.notes` | |

Open reading uncertainties to confirm with a clear page: whether the last two columns before Comments are "Delivery date" and "Container number", and the exact wording of the two header cells I could not read. The right-hand page appears to carry payment-related columns near the end ("Comments" plus two narrow columns at the bottom); confirm whether payment status or amount received is recorded there.

New concepts this ledger needs in the product:
- A `Trip` parent record with its own price (not rate x km).
- Horse and trailer as separate assets on the trip.
- Country tags on stops, so "Zim" and "SA" legs are cross-border.
- Payment status per trip, because the owner's stated problem is losing track of which trips were paid.

## 3. Local log mapping (existing importer, from the clearer photos and the Excel)

Photo form: header "Vehicle type and reg number" (e.g. DAF 5848), columns Driver, Date, Time Out, Mileage Out, From, To, Mileage In, Time In, Total KMS, plus an unlabelled right-hand column holding the contractor/authorised-by (PVT, ROMEO, BESTHULE, LAMMEL, WALLACE, U-PLAN, U-FURN).

Handwriting patterns seen in the photos that the AI must handle:
- Ditto marks ("11" or quote marks) for driver, date and contractor, meaning "same as above".
- Date written only when it changes, and sometimes as "03/9" for 03/10.
- Rows where a place is written "TOTAL" (a day subtotal inside the data).
- Odometer chain: each row's mileage out should equal the previous row's mileage in.
- Overwritten digits and unreadable names.
- Contractor notes like "U-PLAN" that map to a real contractor.

The generated Excel (Vehicle_Logs_October_2026) already shows the structure the owner wants and the review mechanics:
- One sheet per vehicle; title row; legend row (yellow = hard to read, orange = numbers do not add up, with hover reasons).
- Header: Driver, Date, Time Out, Mileage Out, From, To, Mileage In, Time In, Total KM, Contractor, Notes, Check KM (In minus Out).
- A final "Items to Review" sheet: Sheet, Row, Column, Value entered, Type (Hard to read / Doesn't add up), Reason.
- A footer note describing the transcription assumptions.
- Observed from the output: totals differ from the Check column (e.g. 651 vs 925 on AFO 0724), which is exactly what the review step must surface.

## 4. AI import design: a guiding schema, any input

Principle: the system owns a small canonical schema; the AI's job is to map whatever the customer uploads onto it and say how sure it is. The customer's layout does not matter.

### 4.1 Pipeline
1. Upload: image (JPEG/PNG/WebP/HEIC), PDF (scanned or digital), or Excel/CSV. Validate by magic bytes, size and page count; re-encode images; strip EXIF; hash for dedupe.
2. Classify: ask the model which document family each page is (local leg log, cross-border ledger, fuel receipt, invoice, other) and what the table's column headers are.
3. Extract: forced structured output into the canonical schema for that family. Unreadable values are null with a confidence, never guessed. Every row carries `rawText` and a reference to the source page.
4. Normalise in code, not by the model: dates (assume a stated month/year when missing), ditto expansion, number cleaning, odometer chain checks, place and name fuzzy matching (reuse `matching.js`), contractor aliases, duplicates.
5. Stage: write to import batch/rows, not live data.
6. Review UI: source image beside an editable grid; yellow and orange flags with reasons (same logic as the Excel the owner reviews today); per-row approve, edit or reject; unmatched names resolved with the existing decisions panel.
7. Commit: through the existing preview/commit path (`buildImportPreview` and `commitImport`), inside a transaction, recording who approved.

### 4.2 Canonical schemas (the guide the AI must fill)
Local leg row: `vehicleReg, driverName, date, timeOut, mileageOut, from, to, mileageIn, timeIn, totalKm, contractor, notes, confidence{field}, flags[]`.
Cross-border trip row: `clientRef, date, transporterName, stops[{place,country}], cargoDescription, customerName, supplierName, distanceKm, price, currency, horseReg, trailerReg, deliveredAt, containerNo, notes, paymentStatus?, confidence{field}, flags[]`.
Minimum required to commit: for legs, date, mileage in and out, from, to, driver; for trips, date, customer, route, price. Everything else optional so sparse customers are not blocked.

### 4.3 Flags the code computes (not the model)
- Hard to read: model confidence below threshold, or the model returned null.
- Doesn't add up: mileage in lower than out; total km differs from in minus out; out does not equal previous in; time in before time out; ditto filled with a value that breaks the chain.
- Unknown entity: driver, contractor, place, vehicle, client not matched.
- Duplicate: same vehicle and odometer pair (existing rule) or same tenant and client ref.
- Policy: private trips skipped per tenant setting (PVT/private values are tenant-configurable, not hard-coded).

### 4.4 Tenant-specific mappings
Each tenant stores aliases so the importer improves over time: contractor aliases (U-PLAN -> LAMMEL), place aliases, default driver per vehicle, which contractor values mean private, expected format hints. The review decisions a user makes are saved as aliases.

### 4.5 PDFs
Digital PDFs: extract text/tables first; fall back to sending page images to the model. Scanned PDFs: render pages to images. Cap pages per upload and per month by plan.

### 4.6 Accuracy plan
Build a test set from the 12 local photos plus the owner's already-reviewed Excel (ground truth) and the 4 ledger photos once clearer images exist. Measure per-field accuracy for Haiku and Sonnet before choosing a default model; send only low-confidence pages to the larger model. Handwriting accuracy is untested, so no accuracy claims on the landing page until measured.

## 5. Client logo and testimonials
`frontend/public/logos-clients/alleaworldwide-logo-removebg-preview.png` is available for the testimonial/proof section. Use it only with Allea's permission and a real quote; do not invent a testimonial.

## 6. Questions
- Is the ledger kept per client (one ledger for Allea) or per transporter? In the SaaS, who owns it?
- Does the ledger's right-hand page track payments received? If not, where are payments recorded today?
- A clearer, flat, higher-resolution photo of one ledger page, ideally taken in landscape, to confirm column names.
