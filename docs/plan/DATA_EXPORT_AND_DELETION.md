# Data export and company deletion

## What other products do (research, 4 Nov 2026)

| Product | What we found | Confidence |
|---|---|---|
| QuickBooks Online | Cancelled paid accounts keep **read-only access for one year**, and can export to Excel in that time. Cancelled trials: 90 days. After a declined card: 14 days of full access, then suspended. Intuit advises exporting *before* cancelling. | Official Intuit help page |
| Xero | No official figure found. Third-party pages say 30 days and 7 years and disagree. | Weak; ask Xero or read their privacy policy |
| Stripe | Support page tells you to export to CSV before closing. | Official |
| Shopify | Third-party guides disagree (30 days, 90 days, up to 2 years). Common point: export CSVs from the admin before closing. | Weak |
| Samsara, Fleetio | No public post-termination policy found. Samsara lets customers set data retention per category and warns that shortening it deletes data permanently. | Partial |
| Typical SaaS contracts | Keep data about 30-90 days after termination so the customer can fetch it, then delete within about 30 days. | Sample clauses only |

Patterns that repeat everywhere:
1. **Self-serve export at any time, in spreadsheet form**, not "email support".
2. **A window after leaving** in which the data is still reachable (read-only or cooling-off) before anything is destroyed.
3. **Deletion is a request that matures**, not a button that destroys on click.
4. **Customers are told to take their own copy first.**

## The law that matters here

- **Zimbabwe Cyber and Data Protection Act, 2021:** commentary says the erasure right (s.14) is narrow (false or misleading data) and that portability is not expressly provided. We could not read the statute itself (the site blocked the fetch), so a lawyer should confirm. Offering full export and deletion goes beyond what the Act appears to require, which is the safe side.
- **ZIMRA record keeping:** ZIMRA's guidance says books, invoices, ledgers and consignment notes must be kept at least **six years** (Income Tax Act s.37B, VAT Act s.57). The duty is on the *business*. So the export is how a customer keeps its records, and the deletion screen tells them to.

## What is built

- **Export** `GET /api/v2/tenant/export` (company admins). One ZIP: `csv/` (Excel), `json/` (full fidelity, for moving to another system), `documents/` (driver IDs and licences), `manifest.json`, `README.txt`. Own company only, secrets left out, spreadsheet-formula text defused, streamed. Button: Modules page, "Your data".
- **Deletion** `POST /api/v2/tenant/deletion` (needs the exact company name), `DELETE` to cancel, status in `GET /tenant/me`. Nothing is removed for `DELETION_GRACE_DAYS` (default **30**). Everyone can keep working and exporting meanwhile.
- **Purge** `GET /api/v2/tenant/purge-due`, run daily at 02:00 UTC by the Vercel cron in `vercel.json`. Removes records, stored files, and the company's users; keeps only a note in the `deletedcompanies` collection (id, name, dates, row counts).

## Needs you

1. Set **`CRON_SECRET`** (any long random string) in Vercel for Production. Without it the purge endpoint answers 404 and nothing is ever purged, which is the safe default.
2. Decide the **grace period**. 30 days is a default taken from common practice. QuickBooks gives a year of read-only access, but they are billing-based. Change it with `DELETION_GRACE_DAYS`.
3. Have the lawyer check the two statements above and the privacy notice wording (export, 30-day deletion, six-year duty stays with the customer).
4. Backups: MongoDB Atlas backups will still hold deleted data until they age out. The privacy notice should say so, with the Atlas retention you choose.

## Not done

- A post-cancellation **read-only** state (needs billing).
- Deleting a single **user** on request, or a driver's personal data on their own request. Today an admin deletes the driver record.
- The deletion section is not yet checked in a real browser.
