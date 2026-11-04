const { AsyncLocalStorage } = require("node:async_hooks");

// Who the current request acts for. Set once authentication succeeds, and read by
// the query guard (services/tenantGuard.js) for every database call the request makes.
const storage = new AsyncLocalStorage();

const GLOBAL_ROLES = ["Super Admin", "Site Admin"];

// Called by isAuthenticated. enterWith keeps the value for the rest of this
// request's async chain, including everything the route handler awaits.
function enterRequest(user, label) {
  if (!user) return;
  storage.enterWith({
    tenantId: user.companyId ? String(user.companyId) : null,
    global: GLOBAL_ROLES.includes(user.role),
    label: label || "",
  });
}

const current = () => storage.getStore() || null;

// Run something for a named company, e.g. a background job or a test. The callback is
// awaited inside the context, so a Mongoose query it returns still runs as that company.
const runAsTenant = (tenantId, fn, label = "") =>
  storage.run({ tenantId: tenantId ? String(tenantId) : null, global: false, label }, async () => await fn());

// Run something that is allowed to cross companies on purpose (platform tasks).
// Every use should have a comment saying why.
const runUnscoped = (fn, label = "unscoped") =>
  storage.run({ tenantId: null, global: true, label }, async () => await fn());

module.exports = { enterRequest, current, runAsTenant, runUnscoped, GLOBAL_ROLES };
