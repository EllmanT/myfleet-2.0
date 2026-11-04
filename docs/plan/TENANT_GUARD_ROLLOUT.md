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

## What it does not cover

- `User`, `Deliverer`, `rate` and `ContractorStats` have no company field of their own. Their routes guard them.
- Inside `$lookup` stages of an aggregate. Log mode reports these as `lookup-not-covered` so each can be reviewed.
- `insertMany` and raw collection access (`Model.collection`). Use `save()` or `create()` inside a request.

## Tests

- `tests/tenantGuard.test.js`: both modes, ObjectId and string company fields, aggregates, saves, and the cases where it must stay out of the way.
- `tests/tenantIsolation.test.js` and `tests/tenantIsolationEnforced.test.js`: every route probed as a second company, in off mode and in enforce mode.
- `tests/verifyTenantStamps.test.js`: the gate script.
