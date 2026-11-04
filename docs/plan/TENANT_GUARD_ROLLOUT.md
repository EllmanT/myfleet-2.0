# Tenant guard: how to roll it out

The guard (`backend/services/tenantGuard.js`) checks every database call made while handling a signed-in request against that request's company. It is the safety net under the per-route ownership checks. It is controlled by one environment variable, `TENANT_GUARD`:

| Value | What it does |
|---|---|
| `off` (default) | Nothing. Safe everywhere. |
| `log` | Records each query on a company-owned collection that does not name the company. Nothing is changed or blocked. Warnings appear in the server log as `[tenant-guard] ...`. |
| `enforce` | Adds the company to every such query and to every save; refuses a save for another company. A forgotten filter can only return the caller's own rows. |

Platform admins ("Super Admin", "Site Admin") and anything running outside a request (scripts, seeds) are never touched. A deliberate cross-company task uses `runUnscoped()` from `services/tenantContext.js`, with a comment saying why.

## Order of steps

1. **Today:** leave it `off` in production. It is installed and costs nothing.
2. **On staging (a restored copy of production):** set `TENANT_GUARD=log` and click through every page as the owner and as a second test company. Collect the `[tenant-guard]` lines. A line is a query that is scoped by something other than the company (an id list, the old `companyId` string). Each one is either fixed to name the company or accepted with a reason. The automatic route test already lists the current set (24 sites, all scoped by other means).
3. **Backfill:** run `backfillTenantId.js`, then `splitSharedCustomers.js`, on the restored copy first (see `REMAINING_WORK_PLAN.md` section 4).
4. **Gate:** `node scripts/verifyTenantStamps.js --target=local` must exit 0 (nothing unstamped). Enforce hides any record that has no owner, so this must pass first.
5. **Staging, enforce:** set `TENANT_GUARD=enforce`, repeat the click-through. Nothing the owner uses should be missing.
6. **Production:** after the live backfill and the same gate check, set `TENANT_GUARD=enforce`. To roll back, set it to `off` (an environment change, no deploy of code needed beyond Vercel's redeploy).

## Rehearsal on a copy of live data (4 Nov 2026)

`scripts/copyLiveToLocal.js` makes a read-only copy of live into a local scratch database (it refuses any destination that is not this machine). Results on the real data (1 company, 7,920 jobs, 761 customers):

- `backfillTenantId.js` stamped all jobs, vehicles, drivers and contractors with no conflicts.
- It left **184 customers** (never linked to the company, used by no job) and **7 statistics rows** (2023 stats of vehicles and drivers that no longer exist, and contractor stats with a blank owner) with no owner. Enforce would have hidden them, so the gate correctly said "NOT SAFE".
- New option `--adopt-leftovers-into=<companyId>` gives those to the company. It refuses unless there is exactly one company in the database. After it, `verifyTenantStamps.js` reports every record stamped.
- `splitSharedCustomers.js` found nothing to split (one company, no shared customers).
- With the copy loaded, 48 list endpoints were called as the real admin with the guard off and then enforcing: identical answers, apart from float rounding order, a timestamp and list ordering.

Commands used (against the copy, not live):

```
OFFLINE_DB_URL=mongodb://127.0.0.1:27018/myfleet-rehearsal node scripts/backfillTenantId.js --target=local --apply --adopt-leftovers-into=<companyId>
OFFLINE_DB_URL=... node scripts/verifyTenantStamps.js --target=local
```

For live, the same with `--target=live --apply --confirm-live` after a backup. As the live copy was taken on 4 Nov and live keeps changing, run the dry run on live first and compare.

## What it does not cover

- `User` and `Deliverer` are the owners themselves. Their routes guard them. (`rate` and `ContractorStats` are covered through `deliverer` and `delivererId`.)
- Inside `$lookup` stages of an aggregate. Log mode reports these as `lookup-not-covered` so each can be reviewed.
- `insertMany` and raw collection access (`Model.collection`). Use `save()` or `create()` inside a request.

## Tests

- `tests/tenantGuard.test.js`: both modes, ObjectId and string company fields, aggregates, saves, and the cases where it must stay out of the way.
- `tests/tenantIsolation.test.js` and `tests/tenantIsolationEnforced.test.js`: every route probed as a second company, in off mode and in enforce mode.
- `tests/verifyTenantStamps.test.js`: the gate script.
