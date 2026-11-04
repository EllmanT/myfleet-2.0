# Legal and compliance checklist (what code cannot do for you)

Status as of 4 Nov 2026. Drafts exist for the first four lines; the rest need a person to file, sign or accept.

| # | Item | State | What is needed |
|---|---|---|---|
| H1 | Terms of Service and Privacy Policy | Drafted and live in `marketing/` (aligned to the product on 4 Nov) | Lawyer review (H0d). |
| H5b | "Not a fiscalised tax invoice" statement | Done: Terms, FAQ, and the footer of every invoice and quotation PDF | None. |
| H0c | Breach response plan | Drafted: `BREACH_RESPONSE_PLAN.md` | Fill the blanks (deputy, lawyer, POTRAZ route); do the drill. |
| H4/H5 | Export and deletion | Built (see `docs/plan/DATA_EXPORT_AND_DELETION.md`) | Set `CRON_SECRET` in Vercel; confirm 30 days. |
| H0 | POTRAZ data controller licence (Form DP1) | Not started | A legal entity (company registration), a named contact, then the form. Facts to declare are below. |
| H0b | Vendor data-processing terms | Not started | Accept and file each vendor's DPA (list below), with the date. |
| H0d | Lawyer review | Not started | Send Terms, Privacy, this checklist, the AI notice, trial wording, liability cap. Questions below. |
| H2 | AI notice and consent record | Text is in the Privacy Policy; no stored acceptance yet | Build next (see `docs/plan/REMAINING_WORK_PLAN.md` H2). |

## Facts for the POTRAZ filing (H0)
- **What we hold:** account holders (name, email, phone, company), and for each company: customers, drivers (name, phone, address, ID number, licence), vehicles, jobs, invoices, payments, expenses, uploaded driver ID and licence images, optional logbook photos.
- **Where:** Vercel (hosting and private file storage, region chosen at store creation: record it here: ______), MongoDB Atlas (region: ______), Clerk (sign-in, USA), Anthropic (photo reading, USA, optional).
- **Retention:** while the account is active; company deletion after a 30-day cooling-off; backups age out with the Atlas backup window (record it: ______).
- **Security measures:** per-company isolation tested on every route, private file storage with signed-in access only, no passwords stored in plain text, sign-in handled by Clerk, secrets only in environment settings.
- **Subject rights:** download of all data (Modules page), deletion on request, contact by WhatsApp.

## Vendor DPAs to file (H0b)
Anthropic (commercial terms and DPA), Clerk, Vercel, MongoDB Atlas, Vercel Blob (covered by Vercel's DPA), the email provider (when chosen). Save a PDF of each with the date you accepted, in `docs/compliance/dpas/` (do not commit anything confidential).

## Questions for the lawyer
1. Are we controller, processor, or both, for company data? Do we need a licence as a processor?
2. Does sending data to the USA/EU need a notification to POTRAZ, and what wording?
3. Confirm: POTRAZ 24 hours, individuals 72 hours.
4. The Cyber and Data Protection Act's erasure right appears narrow and portability is not stated. Confirm that offering full export and deletion is enough, and the six-year ZIMRA record duty rests on the customer.
5. Is 30 days a reasonable deletion cooling-off? Should deletion keep invoices and payments longer for our own accounting?
6. May the founder be the named data protection contact?
7. USD pricing: any VAT or levy on a software subscription sold to Zimbabwean businesses? (accountant)
8. Liability cap wording, the trial and refund wording, and the "we never charge you on our own" promise.

## Promises kept honest (4 Nov)
- Terms and FAQ now say: if you stop, the account becomes read-only, you can still see and download everything, and we contact you before deleting anything. That matches what is built (read-only state, export, deletion on request).
- Automatic deletion some days after a company stops paying is NOT built. If you want it, decide the number of days with the lawyer, then add it as a scheduled step before the daily purge.
- "Logbook images are deleted 60 days after import" was removed from the Privacy Policy: no retention job exists yet.
