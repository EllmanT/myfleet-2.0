/*
 * Shared Playwright fixtures.
 *   world       worker-scoped: tenants A and B, each with seeded data, plus a platform admin.
 *               Treated as READ-ONLY by specs (isolation specs prove nothing about A changes).
 *               Specs that change state create their own tenant with createTenant().
 *   signedIn    opens a browser page already signed in as a tenant user (storageState cookie).
 */
const base = require("@playwright/test");
const { createTenant, seedTenantData, storageStateFor, storageStateForCredentials, uniq } = require("./tenants");
const { ctl } = require("./control");
const { PASSWORD } = require("./env");

const test = base.test.extend({
  world: [
    async ({}, use) => {
      const A = await createTenant("Alpha", {
        users: [
          { role: "Deliverer Admin", key: "admin" },
          { role: "Deliverer Manager", key: "manager" },
        ],
      });
      const B = await createTenant("Bravo", {
        users: [
          { role: "Deliverer Admin", key: "admin" },
          { role: "Deliverer Manager", key: "manager" },
        ],
      });
      const dataA = await seedTenantData(A);
      const dataB = await seedTenantData(B);
      const id = uniq();
      const platform = { email: `platform.${id}@e2e.test`, password: PASSWORD };
      await ctl("/ctl/platform-admin", { ...platform, role: "Super Admin" });
      await use({ A, B, dataA, dataB, platform });
    },
    { scope: "worker" },
  ],

  // Usage: const page = await signedIn(tenant, "admin")
  signedIn: async ({ browser }, use) => {
    const contexts = [];
    await use(async (tenant, key = "admin") => {
      const storageState = await storageStateFor(tenant, key);
      const context = await browser.newContext({ storageState });
      contexts.push(context);
      return context.newPage();
    });
    for (const c of contexts) await c.close();
  },

  // Usage: const page = await signedInAs(email, password)
  signedInAs: async ({ browser }, use) => {
    const contexts = [];
    await use(async (email, password) => {
      const storageState = await storageStateForCredentials(email, password);
      const context = await browser.newContext({ storageState });
      contexts.push(context);
      return context.newPage();
    });
    for (const c of contexts) await c.close();
  },
});

module.exports = { test, expect: base.expect };
