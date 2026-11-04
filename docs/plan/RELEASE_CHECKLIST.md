# Release checklist: development to production

Production (`main`) is 38 commits behind `development`. This releases the tenant isolation, private file storage, export and deletion, billing, and the dashboard fixes (including the `loadUser` request loop that production likely still has). Do the steps in order. Every step says how to check it worked and how to undo it. Stop at the first check that fails.

Do not release on a day you cannot watch it for two hours.

## 0. Before you start (once)

- [ ] Vercel Production has: `CRON_SECRET` (done), the Blob store connected (adds `BLOB_STORE_ID`), and all the settings production already uses (Clerk keys, `JWT_SECRET_KEY`, `DB_URL`, and so on). Nothing existing is renamed or removed.
- [ ] `TENANT_GUARD` is **not** set yet (it defaults to `off`).
- [ ] The private Blob store shows access **Private** and the region you chose (it cannot be changed later). Write the region in `docs/compliance/LEGAL_CHECKLIST.md`.
- [ ] A backup of live exists. Already made: `myfleet-backups/live-2026-11-04/` (8,758 documents). Make a new one if more than a day has passed: Atlas, Backup, take a snapshot (the better undo), or `node scripts/copyLiveToLocal.js --to=mongodb://127.0.0.1:27018/<name>` for a local copy.
- [ ] Tests are green on `development` (31 suites at last run).

## 1. Stamp the live data (before the code goes out)

Adds a `tenantId` field to existing records. It never deletes or changes anything else, and the old code ignores the field, so this is safe to do first.

```
cd backend
node scripts/backfillTenantId.js --target=live --adopt-leftovers-into=654f669091e232eb07068b57     # dry run: read it
node scripts/backfillTenantId.js --target=live --apply --confirm-live --adopt-leftovers-into=654f669091e232eb07068b57
node scripts/verifyTenantStamps.js --target=live
```

- **Check:** the last command ends "Every company-owned record is stamped". The dry run must show **no conflicts** and the company id must be the one company in live. If a second company was created since, the adopt step refuses; stop and ask.
- **Undo:** restore from the snapshot, or remove the field: `db.<collection>.updateMany({}, {$unset: {tenantId: ""}})` (and `delivererId` on contractor stats rows that were blank before). In practice there is nothing to undo, because the old code does not use it.

## 2. Release to a preview first

1. Push `development` (already done). Vercel builds a Preview deployment for it. Open it from the Vercel dashboard, Deployments.
2. The Preview environment needs the Blob store connected for **Preview** as well as Production, and the same database settings. If Preview points at the live database, treat everything you do there as live.
3. Sign in as the owner and check, in this order:
   - [ ] Dashboard loads once, no request loop (browser Network tab shows no repeating `/del-dash-orders` calls).
   - [ ] Jobs, customers, vehicles, drivers list the same counts as production.
   - [ ] **Drivers, Add (or edit an existing driver), upload a licence photo, save, open View.** This is the first real Blob test. The file opens; reload and it still opens.
   - [ ] Modules page, Download all company data: a ZIP arrives and opens in Excel.
   - [ ] Create a throwaway invoice from a job and open its PDF: the footer says it is not a fiscalised tax invoice. Void it.
- **If any check fails:** do not continue. Fix on `development`; the preview rebuilds.

## 3. Release to production

1. Open a pull request `development` into `main`. Read the file list once. Merge it (a merge commit, not a squash, so the history stays traceable).
2. Vercel deploys Production from `main` automatically. Wait for "Ready".
3. Immediately check, signed in as the owner:
   - [ ] Dashboard, jobs and customers load with the same counts as before.
   - [ ] `/api/v2/tenant/me` (in the browser, signed in) shows `billing.state: "legacy"` and `writable: true`. **This is the proof you cannot be locked out.**
   - [ ] One edit saves (change a note on a job, then change it back).
4. **Undo (takes under a minute):** Vercel, Deployments, find the previous production deployment, "Promote to Production" (or Instant Rollback). Data written meanwhile stays; nothing in this release changes the shape of existing data.

## 4. Switch the tenant guard on, slowly

1. Set `TENANT_GUARD=log` in Production, redeploy. It records, and changes nothing.
2. Use the app normally for a day (all main pages, an import, an invoice). Read the Vercel function logs for lines starting `[tenant-guard]`. Each is a query that did not name the company. In the rehearsal on a copy of live data there were about 30 and all were scoped another way (an id list); expect the same. Anything surprising: stop and look.
3. Run the gate again: `node scripts/verifyTenantStamps.js --target=live` must say it is safe.
4. Set `TENANT_GUARD=enforce`, redeploy, and repeat the main-page check. Nothing the owner uses should be missing (compare counts).
- **Undo:** set `TENANT_GUARD=off` (or delete it) and redeploy. No data is touched either way.

## 5. After the release

- [ ] Vercel Production also has the mail settings: `SMPT_HOST`, `SMPT_PORT`, `SMPT_MAIL`, `SMPT_PASSWORD` (the same four as in `backend/config/.env`). Without them the trial and payment reminder emails fail quietly and retry next day.
- [ ] The 06:00 job `/api/v2/tenant/billing-notices` is listed under Cron Jobs. It emails company owners when a trial has 7 days left, when it ends, 3 days before a subscription is due, and when it is overdue; once per date, never to the first customer.
- [ ] The daily purge job: Vercel, project, Cron Jobs, shows `/api/v2/tenant/purge-due`. It only acts on companies that asked to be deleted, so it will report "purged: 0" for now. A 404 means `CRON_SECRET` is missing; a 401 means it does not match.
- [ ] Sign in as a throwaway platform admin and open the admin console (once built) to confirm your company shows as `legacy`.
- [ ] Delete leftover test files from the Blob store if you want a clean start (Vercel, Storage, Browse).
- [ ] Tick off in `docs/plan/MASTER_PLAN.md`: tenant isolation live, file storage live, export and deletion live.

## Things that are deliberately not on this list

- **Public sign-up stays closed** until the lawyer has returned the Terms and Privacy comments, the POTRAZ application is filed, and the beta tenants have been through steps 2 to 4 with you watching.
- New companies created after this release start a 30-day trial automatically. Your existing company never does.


## Added after the checklist was written
- The live backfill has been run (2026-11-04). `verifyTenantStamps --target=live` reports 0 unstamped on all 10 collections.
- Auto-deletion: a company read-only for 30 days is emailed and scheduled for deletion with the usual 30-day cooling-off; paying (or the daily job noticing it can write again) cancels it. Never applies to legacy companies or to deletions an owner asked for.
- Subscription reminder emails quote EcoCash `+263 778 115 084` (`PAYMENT_ECOCASH_NUMBER` overrides it). Not VAT registered: nothing VAT-related is shown.
