/*
 * Trial state, read-only after the trial, and plan limits (users and trucks).
 * Each test builds its own tenant, so nothing here disturbs the shared A/B world.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant, uniq } = require("../support/tenants");
const { ctl, daysFromNow } = require("../support/control");
const { Api } = require("../support/api");
const { PASSWORD } = require("../support/env");

const trial = (days) => ({ band: "starter", status: "trial", trialEndsAt: daysFromNow(days) });
const newVehicle = (api, t, tag) => api.post("/api/v2/vehicle/create-vehicle", { make: "DAF", regNumber: `${tag}${uniq()}`.toUpperCase(), size: "horse", companyId: t.companyId });
const newAdminBody = (role = "Deliverer Manager") => ({
  name: "New Person",
  email: `p.${uniq()}@e2e.test`,
  phoneNumber: "0771",
  address: "a",
  city: "c",
  role,
  password: PASSWORD,
});

test.describe("trial state", () => {
  test("@smoke @full a company on day one of its trial can write, and the plan says so", async () => {
    const t = await createTenant("Trial");
    const api = await t.api();
    const me = await api.get("/api/v2/tenant/me");
    expect(me.body.billing).toMatchObject({ state: "trial", band: "starter", writable: true, readOnlyReason: null });
    expect(me.body.billing.daysLeft).toBeGreaterThanOrEqual(29);
    expect(me.body.billing.limits).toEqual({ trucks: 2, users: 3, aiPagesPerMonth: 50 });
    expect((await newVehicle(api, t, "TR")).status).toBe(201);
  });

  test("@full the app shows no trial banner early, and a clear one in the last days", async ({ signedIn }) => {
    const early = await createTenant("TrialEarly");
    const p1 = await signedIn(early);
    await p1.goto("/del-dashboard");
    await expect(p1.getByText(early.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(p1.getByRole("status").filter({ hasText: /free trial/i })).toHaveCount(0);

    const late = await createTenant("TrialLate", { billing: trial(3) });
    const p2 = await signedIn(late);
    await p2.goto("/del-dashboard");
    await expect(p2.getByRole("status").filter({ hasText: /free trial ends in 3 days/i })).toBeVisible({ timeout: 20_000 });
    await expect(p2.getByText(/will not be charged automatically/i)).toBeVisible();
  });
});

test.describe("read-only after the trial", () => {
  test("@smoke @full when the trial ends, every write is refused with a clear 402 and reads still work", async () => {
    const t = await createTenant("Ended", { billing: trial(-1) });
    const api = await t.api();

    const me = await api.get("/api/v2/tenant/me");
    expect(me.body.billing).toMatchObject({ state: "read_only", writable: false, readOnlyReason: "trial_ended" });

    const create = await newVehicle(api, t, "RO");
    expect(create.status).toBe(402);
    expect(create.body.message).toMatch(/free trial has ended/i);
    expect(create.body.message).toMatch(/data is safe/i);

    // other kinds of write are refused the same way
    expect((await api.post("/api/v2/invoice/create-invoice", { customerName: "X", lines: [{ description: "x", quantity: 1, unitPrice: 1 }] })).status).toBe(402);
    expect((await api.post("/api/v2/customer/create-customer", { name: "C", address: "a", city: "c", companyId: t.companyId })).status).toBe(402);
    expect((await api.put("/api/v2/tenant/modules", { modules: { fuel: true } })).status).toBe(402);

    // reads and the data export keep working: the owner can always take their data away
    expect((await api.get("/api/v2/vehicle/get-all-vehicles-company")).status).toBeLessThan(300);
    expect((await api.get("/api/v2/user/get-user")).status).toBe(200);
    const exp = await api.get("/api/v2/tenant/export", { raw: true });
    expect(exp.status).toBe(200);
    expect(exp.buffer.slice(0, 2).toString()).toBe("PK");
  });

  test("@smoke @full data entered before the trial ended stays readable and cannot be edited or deleted", async () => {
    const t = await createTenant("EndedData");
    const api = await t.api();
    await api.createVehicle(t.companyId, { regNumber: `KEEP${t.id.toUpperCase()}` });
    const [veh] = (await ctl("/ctl/find", { collection: "vehicles", filter: { tenantId: t.companyId } })).docs;

    await ctl("/ctl/billing", { companyId: t.companyId, billing: trial(-2) });

    const list = await api.get("/api/v2/vehicle/get-all-vehicles-company");
    expect(list.text).toContain(`KEEP${t.id.toUpperCase()}`);
    const upd = await api.put("/api/v2/vehicle/update-vehicle", { id: veh._id, make: "CHANGED", size: "horse", regNumber: veh.regNumber });
    expect(upd.status).toBe(402);
    expect((await api.del(`/api/v2/vehicle/delete-vehicle/${veh._id}`)).status).toBe(402);
    const [still] = (await ctl("/ctl/find", { collection: "vehicles", filter: { _id: veh._id } })).docs;
    expect(still.make).toBe(veh.make);
  });

  test("@smoke @full the app tells the user changes are paused and why", async ({ signedIn }) => {
    const t = await createTenant("EndedUi", { billing: trial(-1) });
    const page = await signedIn(t);
    await page.goto("/del-dashboard");
    const banner = page.getByRole("status").filter({ hasText: /free trial has ended/i });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText(/still view and download/i);
  });

  test("@full a platform admin extending the trial makes the company writable again straight away", async ({ world }) => {
    const t = await createTenant("Revived", { billing: trial(-1) });
    const owner = await t.api();
    expect((await newVehicle(owner, t, "RV")).status).toBe(402);

    const platform = await Api.login(world.platform.email, world.platform.password);
    const r = await platform.put("/api/v2/tenant/billing", { companyId: t.companyId, extendTrialDays: 14 });
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({ state: "trial", writable: true });
    expect((await newVehicle(owner, t, "RV")).status).toBe(201);
  });

  test("@full payment overdue: a 7-day grace period, then read-only; paying restores writing", async ({ world }) => {
    const grace = await createTenant("Grace", { billing: { band: "starter", status: "active", paidUntil: daysFromNow(-3) } });
    expect((await newVehicle(await grace.api(), grace, "GR")).status).toBe(201);

    const late = await createTenant("Late", { billing: { band: "starter", status: "active", paidUntil: daysFromNow(-10) } });
    const api = await late.api();
    const blocked = await newVehicle(api, late, "LT");
    expect(blocked.status).toBe(402);
    expect(blocked.body.message).toMatch(/payment is overdue/i);

    const platform = await Api.login(world.platform.email, world.platform.password);
    const paid = await platform.put("/api/v2/tenant/billing", { companyId: late.companyId, status: "active", paidUntil: daysFromNow(30) });
    expect(paid.status).toBe(200);
    expect((await newVehicle(api, late, "LT")).status).toBe(201);
  });

  test("@full suspended and cancelled companies cannot write but can still download their data", async ({ world }) => {
    const t = await createTenant("Suspended");
    const platform = await Api.login(world.platform.email, world.platform.password);
    await platform.put("/api/v2/tenant/billing", { companyId: t.companyId, status: "suspended" });
    const api = await t.api();
    const w = await newVehicle(api, t, "SU");
    expect(w.status).toBe(403);
    expect(w.body.message).toMatch(/suspended/i);
    expect((await api.get("/api/v2/tenant/export", { raw: true })).status).toBe(200);

    await platform.put("/api/v2/tenant/billing", { companyId: t.companyId, status: "cancelled" });
    expect((await newVehicle(api, t, "SU")).status).toBe(402);
    expect((await api.get("/api/v2/tenant/export", { raw: true })).status).toBe(200);
  });

  test("@full a company with no billing record (an existing customer) is never locked out", async () => {
    const t = await createTenant("Legacy", { billing: null });
    const api = await t.api();
    const me = await api.get("/api/v2/tenant/me");
    expect(me.body.billing.state).toBe("legacy");
    expect(me.body.billing.writable).toBe(true);
    for (let i = 0; i < 4; i++) expect((await newVehicle(api, t, "LG")).status).toBe(201); // beyond the 2-truck starter band
  });
});

test.describe("plan limits", () => {
  test("@smoke @full the user allowance is enforced: a starter company holds 3 logins and the 4th is refused", async () => {
    const t = await createTenant("Users", { users: [{ role: "Deliverer Admin", key: "admin" }] });
    const api = await t.api();
    expect((await api.post("/api/v2/user/create-admin", newAdminBody())).status).toBe(201); // 2
    expect((await api.post("/api/v2/user/create-admin", newAdminBody())).status).toBe(201); // 3
    const fourth = await api.post("/api/v2/user/create-admin", newAdminBody());
    expect(fourth.status).toBe(402);
    expect(fourth.body.message).toMatch(/plan includes 3 users/i);
    expect(fourth.body.message).toMatch(/nothing has been changed/i);
    expect((await ctl("/ctl/count", { collection: "users", filter: { companyId: t.companyId } })).count).toBe(3);
  });

  test("@full a bigger band raises the allowance, and a legacy company has no limit", async ({ world }) => {
    const t = await createTenant("UsersFleet", { billing: { band: "fleet", status: "trial", trialEndsAt: daysFromNow(30) } });
    const api = await t.api();
    for (let i = 0; i < 4; i++) expect((await api.post("/api/v2/user/create-admin", newAdminBody())).status).toBe(201); // 5 users
    void world;
    const legacy = await createTenant("UsersLegacy", { billing: null });
    const l = await legacy.api();
    for (let i = 0; i < 5; i++) expect((await l.post("/api/v2/user/create-admin", newAdminBody())).status).toBe(201);
  });

  test("@full the truck count moves the company up a band, and the largest band is a hard stop", async () => {
    const t = await createTenant("Trucks");
    const api = await t.api();
    expect((await newVehicle(api, t, "TK")).status).toBe(201);
    expect((await newVehicle(api, t, "TK")).status).toBe(201);
    expect((await api.get("/api/v2/tenant/me")).body.billing.band).toBe("starter");
    expect((await newVehicle(api, t, "TK")).status).toBe(201); // 3rd truck: moves to the fleet band
    expect((await api.get("/api/v2/tenant/me")).body.billing.band).toBe("fleet");

    const big = await createTenant("TrucksPro", { billing: { band: "pro", status: "trial", trialEndsAt: daysFromNow(30) } });
    const b = await big.api();
    for (let i = 0; i < 25; i++) {
      const r = await newVehicle(b, big, "BG");
      expect(r.status, `truck ${i + 1}: ${r.text}`).toBe(201);
    }
    const over = await newVehicle(b, big, "BG");
    expect(over.status).toBe(402);
    expect(over.body.message).toMatch(/up to 25 trucks/i);
  });
});
