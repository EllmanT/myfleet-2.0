/*
 * Builders for the tenants the specs use. A tenant is a company plus users created through the
 * control API, then (optionally) filled with data through the REAL API so the arrange step
 * exercises the same create paths customers use.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ctl } = require("./control");
const { Api } = require("./api");
const { PASSWORD, BASE_URL } = require("./env");

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * @param {string} label    e.g. "Alpha"; made unique per call
 * @param {object} [opts]   { billing, modules, users: [{ role, key }] }
 *                          billing: omitted = new 30-day trial, null = legacy, or an object
 */
async function createTenant(label, opts = {}) {
  const id = uniq();
  const name = `${label} Haulage ${id}`;
  const userSpecs = opts.users || [{ role: "Deliverer Admin", key: "admin" }];
  const users = userSpecs.map((u) => ({
    role: u.role,
    key: u.key,
    email: `${u.key}.${id}@e2e.test`,
    password: PASSWORD,
    name: `${u.key} ${id}`,
  }));
  const made = await ctl("/ctl/tenant", {
    name,
    users,
    ...(opts.billing !== undefined ? { billing: opts.billing } : {}),
    ...(opts.modules ? { modules: opts.modules } : {}),
    ...(opts.clerkOrgId ? { clerkOrgId: opts.clerkOrgId } : {}),
  });
  const byKey = {};
  users.forEach((u, i) => {
    byKey[u.key] = { ...u, id: made.users[i].id };
  });
  const tenant = { id, name, companyId: made.companyId, users: byKey, admin: byKey.admin };
  tenant.api = (key = "admin") => Api.login(byKey[key].email, PASSWORD);
  return tenant;
}

// Fills a tenant with one of everything, with names that are unique to it so a leak is detectable
// by searching any response or page for tenant.marker.
async function seedTenantData(tenant, { api } = {}) {
  const a = api || (await tenant.api());
  const cid = tenant.companyId;
  const m = tenant.id.toUpperCase();
  const marker = `MARK${m}`;

  await a.createVehicle(cid, { regNumber: `${marker}V1`, make: "DAF" });
  await a.createCustomer(cid, { name: `${marker} Customer One` });
  await a.createCustomer(cid, { name: `${marker} Customer Two` });
  await a.createContractor(cid, { companyName: `${marker} Contractor`, prefix: "QQ" });
  await a.createDriver(cid, { name: `${marker} Driver`, idNumber: `ID-${m}` });

  const find = async (collection, filter) => (await ctl("/ctl/find", { collection, filter })).docs;
  const [vehicle] = await find("vehicles", { tenantId: cid, regNumber: `${marker}V1` });
  const customers = await find("customers", { tenantId: cid });
  const [contractor] = await find("contractors", { tenantId: cid });
  const [driver] = await find("drivers", { tenantId: cid });
  const one = customers.find((c) => c.name.endsWith("One"));
  const two = customers.find((c) => c.name.endsWith("Two"));
  if (!vehicle || !one || !two || !contractor || !driver) throw new Error("seedTenantData: arrange step incomplete");

  await a.createJob({
    jobNumber: `${marker}J1`,
    from: one._id,
    customer: two._id,
    description: `${marker} job description`,
    deliveryType: "standard",
    orderDate: new Date().toISOString(),
    contractorId: contractor._id,
    vehicleId: vehicle._id,
    driverId: driver._id,
    mileageOut: "100",
    mileageIn: "250",
    distance: 150,
    cost: "300.00",
  });
  const [job] = await find("jobs", { tenantId: cid });
  await a.createInvoice({ customerName: `${marker} Invoice Customer`, amount: 321 });
  const [invoice] = await find("invoices", { tenantId: cid });
  if (!job || !invoice) throw new Error("seedTenantData: job or invoice missing");

  return {
    marker,
    vehicle,
    customerOne: one,
    customerTwo: two,
    contractor,
    driver,
    job,
    invoice,
    // private file keys (driver licence and ID photos), served only through /api/v2/files/<key>
    fileKeys: [driver.license, driver.id],
  };
}

// Writes a Playwright storageState file holding the login cookie for one tenant user, so a
// browser context starts signed in without going through the login form.
async function storageStateFor(tenant, key = "admin") {
  const api = await tenant.api(key);
  const file = path.join(os.tmpdir(), `e2e-state-${tenant.id}-${key}.json`);
  fs.writeFileSync(file, JSON.stringify(stateWithToken(api.token)));
  return file;
}

// Same, for any email/password (platform admins have no tenant object).
async function storageStateForCredentials(email, password) {
  const api = await Api.login(email, password);
  const file = path.join(os.tmpdir(), `e2e-state-${uniq()}.json`);
  fs.writeFileSync(file, JSON.stringify(stateWithToken(api.token)));
  return file;
}

function stateWithToken(token, { expiresInSec = 86400 } = {}) {
  const host = new URL(BASE_URL).hostname;
  return {
    cookies: [
      {
        name: "token",
        value: token,
        domain: host,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + expiresInSec,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
    ],
    origins: [],
  };
}

module.exports = { createTenant, seedTenantData, storageStateFor, storageStateForCredentials, stateWithToken, uniq };
