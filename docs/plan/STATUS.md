# myFleet: where we are (2026-11-04)

Branch `development`, last commit `7c566c5`. `main` is 44 commits behind and merges cleanly (fast-forward). Backend tests: 33 suites, 253 tests, all passing. Nothing below is live for customers until `development` is merged to `main`.

Related documents: `RELEASE_CHECKLIST.md` (the exact release steps), `MASTER_PLAN.md`, `REMAINING_WORK_PLAN.md`, `DATA_EXPORT_AND_DELETION.md`, `TENANT_GUARD_ROLLOUT.md`, `FILE_STORAGE.md`, `../compliance/LEGAL_CHECKLIST.md`, `../compliance/BREACH_RESPONSE_PLAN.md`.

---

## 1. What has been built (all committed and pushed)

### Separating companies from each other
- Every company-owned record carries its company. A guard in the database layer (`TENANT_GUARD=off|log|enforce`) stops one company's request from reading another's records. It now also covers rates and contractor stats.
- Customers are per company (shared customers were split).
- **The live database has been stamped** (2026-11-04): every company-owned record has its company, 0 unstamped across 10 collections. 184 customers nobody owned were given to the first customer's company. A backup of live data is in `tapiwa projects/myfleet-backups/live-2026-11-04/`.
- A rehearsal on a copy of live data showed `enforce` and `off` return the same results on 48 read endpoints.

### Files
- Driver documents are stored privately (disk locally, Vercel Blob in production) and opened through a protected link. The driver page has a proper document control (state, View, Choose/Replace, file name, image shrinking).
- Logbook photos are read in memory and never stored, so there is nothing to keep or delete for a retention period.

### Data export and deletion
- Any company admin can download everything as a ZIP (CSV files, documents, a readme). Platform admins can export any company.
- A company admin can ask for the company to be deleted by typing its name. Nothing is removed for 30 days and the request can be cancelled. After that a daily job removes records, files and users and leaves only a small tombstone note.

### Plans, trials and payment
- Three plans by number of trucks (1-2, 3-10, 11-25) with a 30/60/90 day trial, in `backend/config/plans.js`. Prices live there and nowhere else.
- States: trial, active (7 days of grace after the paid-until date), read-only, suspended, cancelled. Read-only blocks changes but never viewing or downloading.
- Limits enforced: trucks (moves up a band automatically, stops above 25), users per plan, AI pages per month.
- The first customer's company has no billing record, so it is "legacy": always writable, no limits, no emails, never auto-deleted.
- Reminder emails (daily job, once per date): trial ends in 7 days, trial ended, payment due in 3 days, payment overdue. They quote EcoCash +263 778 115 084 with the company name as the reference.
- **Auto-deletion:** a company read-only for 30 days is emailed and scheduled for deletion with the normal 30-day cooling-off. Paying cancels it. It never applies to legacy companies and never lifts a deletion an owner asked for.
- Mail goes through the existing SMTP code using the Echo Africa mailbox (settings in `backend/config/.env`, not in git). Port 465 now uses TLS.

### Admin console (platform admins only)
- Menu item "Admin console": summary tiles, searchable company table, and a Manage window per company (mark paid +30 days, extend trial, suspend/restore, change plan/status/dates/note, download their data, schedule or cancel deletion, recent changes). Every change is audited. Platform admins with no company now log in straight to it.

### First-run and empty companies
- A brand-new company opens to zeros instead of errors. A "Getting started" checklist and real empty states on the list pages.
- Stats can be rebuilt per company.
- Invoice PDFs carry a "not a fiscal tax invoice" footer.

### Legal and wording
- Drafts written: privacy policy, terms, FAQ (marketing site), breach response plan, legal checklist. Wording now matches what the product does: sub-processors including Vercel Blob, retention, the read-only promise, and the 30-day read-only then 30-day deletion rule.
- Your lawyer is reviewing. POTRAZ filing is being done by you.

---

## 2. What is NOT done, and who does it

### You (in this order)
| # | Item | Why it matters |
|---|------|----------------|
| 1 | Add `SMPT_HOST`, `SMPT_PORT`, `SMPT_MAIL`, `SMPT_PASSWORD` to Vercel Production (same values as in `backend/config/.env`) | Without them reminder emails fail quietly and retry the next day |
| 2 | Confirm in Vercel: the Blob store is connected, `CRON_SECRET` is set (you said it is) | Uploads and the two daily jobs |
| 3 | Open a Vercel Preview of `development` and upload one driver document, then view it | First real use of Blob storage; cannot be tested from here |
| 4 | Release: `git push origin origin/development:main` | Puts everything above live. Undo: Vercel "Promote previous deployment" |
| 5 | Set `TENANT_GUARD=enforce` in Vercel Production, then redeploy | Turns the isolation on. Safe: the live data is already stamped. Undo: set it back to `log` |
| 6 | Post-release checks from `RELEASE_CHECKLIST.md` (your company shows as legacy and writable; both daily jobs listed under Cron Jobs) | Proves nothing locked you out |
| 7 | Lawyer review of the privacy policy, terms, and the new deletion wording; fill the blanks in the breach plan | Required before strangers sign up |
| 8 | POTRAZ filing (in progress) and data-processing agreements with vendors (Vercel, MongoDB Atlas, Anthropic, Clerk) | Legal basics for public sign-up |
| 9 | Keep public sign-up closed until 1 to 8 are done | Plan: invite-only beta in December, public in January |

### Me (after you tell me the release is done)
- Run the post-release checks against the live site and report.
- Nothing else is waiting on me.

### Possible later work (nobody is blocked on these)
- A bank-transfer detail in the reminder emails if you want one besides EcoCash.
- Tell me if a company's owners should also be emailed when a plan limit (trucks, users, AI pages) is hit.
- Look into the export button sometimes appearing to fire twice per click. It is harmless because a second export is refused while one runs.
- You have uncommitted rebrand edits of your own in the working tree that I have left alone.

---

## 3. Decisions already made
- Retention: logbook photos are not stored; company data is kept while the account is active.
- Deletion: asked-for deletions wait 30 days; non-paying companies go read-only, then 30 days later are scheduled with a further 30 days.
- Billing started with the default bands and prices; you are not VAT registered, so no VAT is shown.
- Public sign-up stays closed until the gates above are done.
