# Breach response plan (DRAFT, needs lawyer review)

One page. Read it before you need it. Working standard from our research: tell the regulator (POTRAZ) within **24 hours** of becoming aware and affected people within **72 hours**. A lawyer must confirm the exact periods; until then, act on the shorter ones.

## What counts
Anyone other than the right company seeing, changing, deleting or taking company data: a cross-company leak, a leaked key or password, a lost laptop with live access, a misconfigured storage store, an attacker in an account, a vendor telling us they were breached.

## Who decides
- **Incident lead:** the founder (Tapiwa). If unreachable for 2 hours, the named deputy: ______ (fill in).
- **Lawyer:** ______ (fill in a name and a phone number that works at night).
- Write down the time you first learned of it. The clocks start there.

## First hour: stop it
1. Rotate what may be exposed: `JWT_SECRET_KEY` (signs everyone out), `CRON_SECRET`, the Anthropic key, the Blob token, the MongoDB user password, Clerk secret key. Rotate in Vercel, then redeploy.
2. If the cause is a code path, set `TENANT_GUARD=enforce` (if not already) and disable the module in `config/modules.js`, or take the route down.
3. If an account was taken over, suspend the user and sign out all sessions.
4. Do **not** delete logs or data. Keep the evidence.

## Hours 1-24: understand it
Collect: Vercel function logs for the window, the `[tenant-guard]`, `[data-export]` and `[company-deletion]` lines, Atlas access logs (Atlas project, Activity Feed and database access history), Clerk audit log, Blob store access. Answer: which companies, which kinds of data, how many people, since when, is it still happening.

## Tell people
1. **POTRAZ** within 24 hours. Contact route: ______ (verify the current address and form on the POTRAZ site; do this now, not during an incident).
2. **Affected companies** (the data controllers for their jobs, customers, drivers) within 72 hours, by email and WhatsApp.
3. Affected individuals where the company asks us to, or where we are the controller (account holders).

Template (edit the brackets):
> On [date, time] we found that [what happened] affected [company]. The data involved was [kinds of data, number of records]. We have [what we did to stop it]. You should [what they should do, if anything]. We will update you by [time]. Contact: [name, phone].

## After
Write a short report: timeline, cause, what changed so it cannot repeat, and add a test that would have caught it. File it in this folder. Review this plan twice a year and after every incident.

## Drill
Once before beta, 30 minutes: pick "an admin's laptop is stolen with a logged-in browser". Walk the list above and note what you could not do (usually: a phone number you did not have). Record the date here: ______
