# MyFleet SaaS plan (draft for discussion)

Decisions so far: security first; truck-band pricing; manual EcoCash/bank payment at launch; first niche is cross-border owner-operators with 2-20 trucks (Beitbridge and Beira corridors).

Sources: five research reports from 2026-11-02. Items marked UNVERIFIED have no solid source. No fee amounts, market sizes or conversion rates in this plan are confirmed data.

## Phase 0: Safety (before anything else)
- Snapshot Atlas. Commit the current uncommitted fuel/expense/finance work.
- Remove committed DB backups and user JSON from git; rotate credentials; tighten `.claude/settings.local.json`.
- Require auth on all create endpoints (user, deliverer, vehicle, driver, customer, contractor). Stop trusting `companyId` and `role` from request bodies.
- Fix IDORs: every by-id read/update/delete must check company ownership (job, vehicle, driver, customer, contractor, admin).
- Fix `update-admin` role escalation, `rebuild-stats` scope, and the import commit's cross-company customer and duplicate lookups.
- `User.password` becomes `select:false`; stop returning the JWT in the login body; generic login errors; rate limiting; helmet; mongo-sanitize; escape regex input; upload limits and file filters; do not serve uploads publicly.
- Fix JWT error handling (401 not 500), the `activation` double response, and the plaintext password in the activation token.

## Phase 1: Tenancy and Clerk
- `Tenant` model (plan, modules, settings), `tenantId` on every model, shared Mongoose plugin plus AsyncLocalStorage, compound unique indexes, a cross-tenant test per route.
- Migration: existing company becomes tenant #1. Idempotent script, verify counts, back up first.
- Clerk organizations and roles (admin, finance, dispatcher, driver). Move users; keep the legacy login behind a flag until done. UNVERIFIED: whether old password hashes can be imported.

## Phase 2: Module toggles
- `Tenant.modules` enforced server-side by `requireModule`, mirrored in sidebar from `/tenant/me`.
- Core: company, users, vehicles, drivers, customers, contractors, rates, jobs, import, basic reports.
- Optional: expenses and profitability, fuel and fuel check, tractor units, cross-border, mileage, quotations, invoices, payments, AI import, advanced analytics, payroll.
- Make fuel-check expected consumption per-vehicle data, not hard-coded registrations.

## Phase 3: Tractor units and cross-border trips
- Vehicle kind (rigid/horse/trailer), Trailer, horse-trailer assignment with history, `trailerId` on jobs.
- Trip parent record: parties, cargo, border crossings, cost lines (editable fee types per tenant), currency and exchange rate, consignment note number.
- Compliance documents with expiry reminders (Yellow Card, SADC permit, licences, roadworthy).
- Mileage as numbers; odometer log; service intervals.
- Needs your logbook sheet (not yet received) to confirm the columns.

## Phase 4: Quotations, invoices, payments
- Quotation -> invoice -> payment with allocations, partial payments, credit notes, per-tenant numbering, money in cents, FX captured.
- Job-level invoice status so a trip cannot be billed twice.
- Monthly per-truck statement and customer statement with ageing, PDF via pdfkit.
- Tax handled as configurable; an accountant should confirm local rules (UNVERIFIED).

## Phase 5: AI logbook photo import
- New `/job-import/extract` produces the same row shape as `parseVehicleLog`; existing preview/commit and review panel are reused, plus an image-beside-table editor.
- Build the review UI with a mock extractor first. Then wire up the Claude API with forced structured output, null for unreadable cells, per-field confidence, image hash dedupe, EXIF stripping, per-tenant quotas and cost counters.
- Test 30-50 real logbook pages on Sonnet and Haiku before choosing a model. Estimated cost per page is roughly $0.002 (Haiku) to $0.033 (Sonnet) at standard prices; this is an estimate. Check Anthropic data-retention terms before making promises to customers.

## Phase 6: Maintenance and tyres
- Service schedules, tyre fitments, cost per km, feeding the per-truck statement.

## Go-to-market (runs alongside Phases 1-4)
- Interview 10-15 operators first (TOAZ, WhatsApp load groups, your own contacts) about payment tracking, late invoices, and what they pay for tools now.
- Pricing to test (not validated): Starter 1-2 trucks $9/mo, Fleet 3-10 $29/mo, Pro 11-25 $59/mo, AI import quota included, then bundles. Free first month for solo operators, 2-3 months for fleets, disclosed upfront with no card taken. Manual EcoCash/bank collection at first; check Paynow/EcoCash recurring billing later.
- Offer draft: "Every Trip Billed" - free setup including import of last month's logbook photos, first invoice within 24 hours, data export guarantee, founding-member price locked for the first 30 fleets (real scarcity only).
- Lead magnets: trip profit calculator; "send one logbook photo, get an invoice back".
- Landing page order: hero, proof, problem, demo, how it works, offer, FAQ, repeated CTA. WhatsApp as the main conversion path. Premium, non-generic design using the Apple design, impeccable and ui-ux-pro-max skills; screenshots from your live app as the case study; Remotion for short demo videos.
- Facebook/WhatsApp: join 5-8 verified groups, give value first, disclose that you built the tool, post twice a week, follow up at most 2-3 times. No named group could be verified; find them manually.

## Open items
- Logbook sheet/image from the user.
- Product name and logo.
- Currencies to support at launch (USD certain; ZWG/ZAR?).
- Whether to migrate old password hashes or force resets.
