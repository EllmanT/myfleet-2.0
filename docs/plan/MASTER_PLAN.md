# myFleet master plan: launch, brand, landing page, go-to-market

Written 2026-11-03. This combines seven reports. Read them for detail; this page is the order of work and the decisions.

| Report | File |
|---|---|
| Remaining work and launch gate | `docs/plan/REMAINING_WORK_PLAN.md` |
| Dashboard audit | `docs/research/dashboard-audit.md` |
| Design system, palette, fonts | `docs/research/design-system-research.md` |
| Landing page design direction | `docs/research/landing-page-design-direction.md` |
| Landing page copy and offer | `docs/marketing/LANDING_PAGE_PLAYBOOK.md` |
| Go-to-market (Facebook/WhatsApp) | `docs/marketing/GO_TO_MARKET_PLAYBOOK.md` |
| Legal and data protection notes | `docs/research/legal-and-compliance-notes.md` |

Decisions already made: ink and ivory with a deep green accent; separate fast static marketing site (Astro, own Vercel project); demo company with invented data for all screenshots; launch prices $9 / $29 / $59 by truck band as a test; free first month for solo operators, 2-3 months for fleets (exact split below); manual payment (EcoCash/bank), never auto-charged.

## 1. The one honest constraint

Public sign-ups cannot open until a company's data is isolated from every other company's, uploads survive on real storage, and the legal basics are in place. The engineering gate is about 45-50 working days against about 40 available before the end of December, and December is slow. So the plan protects the gate, runs brand and marketing work alongside it, and is ready to fall back to an invite-only beta in December and a public launch in January if the gate slips.

## 2. Three tracks, run side by side

**Track A: Make it safe (the gate).** Strict order, from `REMAINING_WORK_PLAN.md`:
1. Verify: run tests, add CI, make a staging copy, click through every page in a browser, fix what breaks. (Weeks 1-2)
2. Tenant isolation: query-level enforcement, per-company customers, stamp the remaining collections. (Week 3)
3. Production backfill and merge to main, using the dry-run, restore-to-scratch, apply, re-run procedure and a change list for rollback. (Week 4)
4. Billing and your admin console: three price bands in one config file, trial clock, read-only after expiry, export always works, manual payment recording, AI cost view. (Week 5)
5. Onboarding for a brand-new empty company, data export, account deletion, real file storage (uploads currently vanish on Vercel), browser-side photo shrinking. (Weeks 5-6)
6. Legal gate: POTRAZ licence, vendor data-processing terms, breach plan, lawyer review, AI notice at upload, "not a fiscal invoice" line on PDFs. (Weeks 1-6, mostly waiting time, so start now)

**Track B: Brand and dashboard (small steps first).**
1. Week 1, one day: swap the palette to ink, ivory and deep green and fix the readability failures. This is the single biggest visual gain: about 320 text uses fixed in one edit.
2. Week 1-2: quick wins from the audit: sidebar highlight bug, menu closing on phones, hard-coded name in the footer, mobile margins, full-screen dialogs on phones, tap sizes, the dead settings icon, 2026 hard-coded in two pages.
3. Week 2: design foundation: tokens, type scale (Inter variable, three weights), shared Page Header, Data Table, Empty State and loading skeletons; split the 1.16 MB bundle with lazy loading.
4. Weeks 3-5: page revamps in this order: Dashboard and sidebar, Trips/Invoices/Quotations, list pages, Add Job. Sidebar regrouped (Expenses and Fuel out of "Revenue", duplicates removed).
This track is the first to be cut if time runs short, except step 1, which ships anyway.

**Track C: Marketing assets.**
1. Week 2: `seedDemoTenant.js` with a safe reset (touches only companies flagged as demo), and the "Demo company" screenshots (19-shot list in the landing page playbook) taken after Track B step 1 so they show the new palette.
2. Weeks 2-4: soft pre-launch only: your own contacts, the "send me one logbook photo" demo, and a waitlist. No open sign-up link yet.
3. Weeks 5-7: build the Astro marketing site from the playbook (copy is written, design direction is set), record the 75-second demo and 15-second cut, write Terms and Privacy from the legal outlines.
4. Week 7: go or no-go on about 17 December. Go means public free sign-ups and the Facebook/WhatsApp calendar switches to its launch posts. No-go means invite-only beta and a January public launch.

## 3. Reconciled design (where the reports differed)

| Question | Decision |
|---|---|
| Accent colour | Deep emerald. Light `#0E5A43`, dark `#4DBF93` (text) and `#3FAF85` (fills with ink text). Warnings use ochre `#8A5200` with an icon. Orange is retired. |
| Backgrounds | Ivory `#FAF8F3`, ink `#15140F` (light); `#0E0E0C` with `#F3F0E8` text (dark). |
| Dashboard font | Inter variable, weights 400/500/600. SF Pro and Segoe UI are not usable on the web without separate licences. |
| Marketing fonts | Instrument Serif for headlines, Inter for body and figures (tabular numerals). The second report suggested Fraunces and JetBrains Mono; dropped to keep to two files. |
| Hero | A logbook photo turns into an invoice, once, in HTML and CSS, still image when reduced motion is on. |
| Allea logo | On an ivory tile in dark mode; never on buttons. Needs Allea's written permission. |
| Page weight | Under 150 KB first view, under 500 KB total, under 30 KB gzipped JS. |

## 4. Corrections to the plans

- **Posting dates:** the go-to-market calendar starts 9 November. Weeks 1-3 of it should be audience-building and warm demos only, because the product can't take public sign-ups yet. Launch posts begin only after the Week 7 go decision.
- **The 30-fleet "founding price" and the 24-hour first invoice** appear in the copy. They stay only if they are real and staffed.
- **No handwriting accuracy figure** anywhere until measured on at least 30-50 real pages. Schedule that measurement in Week 2 with your 12 sample photos.
- **Photo import** stays off by default and is the main scope valve.
- **Cross-border ledger photo reading** is "coming soon" in all copy until built.
- **Facts that aren't verified** (POTRAZ fees and breach timings, VAT rate, vendor terms, TOAZ contacts, font licences) are marked in the reports. None goes into customer-facing text without a check.

## 5. Still needed from you

1. Free-period split by truck band (proposed 1 / 2 / 3 months).
2. Can you staff a 24-hour first-invoice promise? And is "founding price for the first 30 fleets" real?
3. Prices include VAT or not.
4. Allowances per band (users, and AI pages per month).
5. Allea's written permission and real figures; a real logbook photo.
6. WhatsApp business number and the domain name.
7. Atlas region, Vercel plan limits, and which legal entity owns the product.
8. A Zimbabwean lawyer and an accountant to review the legal and VAT wording.
9. The Anthropic API key (photo import cannot be tested without it).

## 6. What I would do first when you say go

1. Palette swap and the readability fixes (Track B step 1).
2. Run and repair the whole test suite, set up CI, and prepare the staging copy (Track A step 1).
3. Write `seedDemoTenant.js` (Track C step 1).
These three are independent, small, and make everything after them faster and safer.
