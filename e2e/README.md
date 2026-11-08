# MyFleet end-to-end tests (Playwright)

Browser and API tests that run the real backend and the real React build against a throwaway
in-memory MongoDB. They never touch Atlas, Clerk, Vercel (Blob or cron), email or the AI provider.

## Run it

One-time setup (from the repo root):

```
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix e2e
npx --prefix e2e playwright install chromium     # CI also needs --with-deps
```

Then:

```
npm run test:e2e           # everything  (about 1.5 minutes once warm)
npm run test:e2e:smoke     # only tests tagged @smoke (about 40 seconds)
cd e2e && npx playwright test tests/isolation.api.spec.js      # one file
cd e2e && npx playwright test -g "trial ended" --headed        # by name, watch it
cd e2e && npx playwright show-report                           # after a CI-style html run
```

What happens on `playwright test` (see `playwright.config.js` > `webServer`):

1. `scripts/build-web.js` builds `frontend/` into `e2e/.web-build` **without a Clerk key** (so the
   app uses its email/password cookie login) and fails if a `pk_test_` / `pk_live_` key ends up in
   the bundle. It is skipped when a build exists; `E2E_REBUILD=1` forces a rebuild (do this after
   changing frontend code). `frontend/build` is never touched.
2. `stack/start.js` starts mongodb-memory-server, loads `backend/app.js` unchanged, serves the build
   and the API on `http://localhost:5057`, and opens a localhost-only control API on port 5058.
3. Specs run (2 workers locally and in CI, 1 retry in CI only).

First run costs: the frontend build takes about 6 minutes, and mongodb-memory-server downloads a
~780 MB `mongod` binary into `backend/node_modules/.cache/mongodb-memory-server` (CI caches it;
note that `npm ci` in `backend/` deletes that cache).

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `E2E_PORT` | `5057` | web + API port; control API uses `E2E_PORT + 1` |
| `E2E_WORKERS` | `2` | Playwright workers |
| `E2E_REBUILD` | unset | `1` rebuilds the web bundle |
| `E2E_VERBOSE` | unset | `1` shows the server's log output |
| `E2E_CONTROL_TOKEN` | fixed local string | shared secret for the control API (localhost only) |
| `TENANT_GUARD` | `enforce` | the tenant query guard mode; production should run `enforce`, so the suite does too |
| `CI` | unset | enables retries and the HTML report |

No other variable matters: everything else the backend reads is set or blanked by `stack/start.js`.

## Why this cannot touch production

Production sign-in is Clerk-only. There is no test bypass in `backend/` or `frontend/`; nothing in
the application source was changed or needs to be. Instead:

- **Browser tests use the cookie login that already exists** (`/api/v2/user/login-user`, the
  email/password path kept beside Clerk). The e2e web build simply has no Clerk key.
- **The Clerk server path** (Bearer session -> `/auth/bootstrap` -> company and user creation, org
  switching) is exercised through a stub of `@clerk/express` (`stack/clerk-stub.js`) that
  `stack/start.js` injects with a `Module._load` hook inside the throwaway e2e process only. A
  "session token" in that world is `e2e-clerk.<base64 JSON>`, unsigned. It exists only in the e2e
  process, so there is no environment variable, flag or header that could switch anything on in a
  real deployment: the code that accepts such tokens is simply not part of the deployed app.
- `stack/start.js` hard-fails if `NODE_ENV` looks like production, forces `NODE_ENV=test`, blanks
  every variable named in `backend/config/.env` plus anything starting with `DB_URL`, `MONGO`,
  `CLERK`, `BLOB`, `VERCEL`, `SMPT`, `ANTHROPIC`, `CRON`, `STRIPE` (so dotenv cannot refill them),
  and refuses to start unless the database URI is a local `mongodb://127.0.0.1:<port>` address.
- The control API (`/ctl/*`) lives on `127.0.0.1` and needs a token; it can create tenants, bend the
  billing clock, run the purge and read the throwaway database. It is also e2e-only code.
- NODE_ENV=test switches off the rate limiters (existing behaviour in `middleware/security.js`).

## Layout

```
e2e/
  playwright.config.js        webServer = build + stack; chromium only
  stack/start.js              throwaway stack + control API (the safety checks live here)
  stack/clerk-stub.js         test double for @clerk/express (e2e process only)
  scripts/build-web.js        Clerk-less React build into .web-build
  support/
    env.js control.js         ports, tokens, client for /ctl/*
    api.js                    HTTP client acting as one signed-in user (same cookie as the browser)
    tenants.js                createTenant(), seedTenantData(), storageState helpers
    fixtures.js               `world` (tenants A and B + platform admin), `signedIn`, `signedInAs`
    jwt.js zip.js             forge expired/tampered cookies; read export ZIPs (via fflate from backend/)
  tests/
    isolation.api.spec.js     B attacks A with real ids (the most important file)
    isolation.ui.spec.js      B browses the app and A's data never shows
    auth.spec.js              login, logout, session expiry, Clerk-session edge cases
    onboarding.spec.js        sign-up -> bootstrap -> trial company; legacy email sign-up
    billing.spec.js           trial state, read-only after trial, overdue, suspended, user/truck limits
    platform-admin.spec.js    admin console UI + create-admin rules
    export.spec.js            company export ZIP
    deletion.spec.js          delete flow, cooling-off, cancel, purge
```

### Tags

- `@smoke` - the fast set that must pass on every change (about 27 tests, 40 seconds).
- `@full` - everything. Every test carries `@full`; `@smoke` tests carry both, so
  `--grep @smoke` runs the quick set and a plain run executes all.

## How data is arranged

- `createTenant(label, { billing, users, modules })` makes a company and its users straight in the
  throwaway DB through the control API (the production sign-up path needs Clerk). `billing` omitted
  = fresh 30-day trial, `null` = legacy company with no limits, or any billing object.
- `seedTenantData(tenant)` then fills it through the **real API**: a vehicle, two customers, a
  contractor, a driver with licence and ID uploads (private files), a job and an invoice. All names
  contain a per-tenant marker (`tenant.id` upper-cased), so any leak is a string search away.
- The shared `world` fixture (tenants A and B, worker-scoped) is **read-only by convention**. Any
  test that changes state creates its own tenant. Billing changes made through the control API
  clear the server's 30-second billing cache; `PUT /tenant/billing` does it too.

## Adding a test

```js
const { test, expect } = require("../support/fixtures");
const { createTenant } = require("../support/tenants");

test("@smoke @full something about a tenant", async ({ signedIn }) => {
  const t = await createTenant("Thing");           // own tenant: free to change
  const api = await t.api();                       // HTTP as that admin
  const page = await signedIn(t);                  // browser already signed in
  await page.goto("/del-modules");
  ...
});
```

Rules of thumb: arrange through the API, assert in the UI only what a user can see; give every
tenant unique names (the helpers do); locate toasts with `page.locator('[role="status"]')`, not
`getByRole` (MUI marks the page aria-hidden behind a dialog); never share mutable data between
tests.

## Known limits and findings

- **Clerk's own widgets are not tested** (hosted sign-in / sign-up screens, social login, email
  codes, the real `signOut`). They need Clerk's servers. Their server-side half is covered with the
  stub. To test the widgets for real you would use a Clerk development instance with Testing Tokens
  and a separate, explicitly opt-in project; that was deliberately not built here because it needs
  real Clerk credentials.
- **Cookie-mode logout is dead code** (`test.fixme` in `auth.spec.js`): the menu's "Logout" item
  only re-opens the menu (`Navbar.jsx` passes `handleClick`) and no `/api/v2/user/logout` route
  exists (billing.js even whitelists that path). Production uses Clerk's `signOut`, so this only
  matters if the cookie login is kept as a fallback. A requested change, not made here: add the
  route (clear the `token` cookie) and wire the menu item to it; then un-fixme the test.
- Several list endpoints answer `201` for a `GET` (e.g. `get-all-vehicles-company`). Harmless, but
  tests assert `< 300` rather than `200` for that reason.
- `sendToken` always sets `secure: true`. Fine on https and on `http://localhost` in Chromium (which
  is how this suite signs in); a plain-http non-localhost deployment would never keep the session.
- Email is not sent anywhere: `create-user` fails with "SMTP is not configured" by design, so the
  legacy sign-up test mints the activation token itself (`ACTIVATION_SECRET` is a known e2e value).
- Billing reminder e-mails and the AI import are not covered (they need SMTP / the AI provider).
- Chromium only. The Playwright version is pinned to 1.62.0, which matches the browser build already
  installed on the author's machine; `npx playwright install chromium` fetches it elsewhere.
- Requested source changes: none are required. Optional nicety: a `/user/logout` route (above).
