const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || "test-activation";
process.env.NODE_ENV = "test";

const app = require("../app");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const { billingState, bandForTrucks, newTenantBilling, BANDS } = require("../config/plans");
const { clearBillingCache } = require("../services/billing");

jest.setTimeout(120000);
const DAY = 86400000;
const days = (n) => new Date(Date.now() + n * DAY);

describe("plans and states (pure)", () => {
  test("a company with no billing record is legacy: writable, unlimited", () => {
    expect(billingState(undefined)).toMatchObject({ state: "legacy", writable: true, limits: null });
    expect(billingState({})).toMatchObject({ state: "legacy", writable: true });
  });

  test("bands follow the truck count and stop at 25", () => {
    expect([1, 2, 3, 10, 11, 25].map(bandForTrucks)).toEqual(["starter", "starter", "fleet", "fleet", "pro", "pro"]);
    expect(bandForTrucks(26)).toBeNull();
  });

  test("trial lengths come from the band, and a trial ends into read-only", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(newTenantBilling(now, "starter").trialEndsAt - now).toBe(30 * DAY);
    expect(newTenantBilling(now, "fleet").trialEndsAt - now).toBe(60 * DAY);
    expect(newTenantBilling(now, "pro").trialEndsAt - now).toBe(90 * DAY);
    const b = newTenantBilling(now);
    expect(billingState(b, new Date(now.getTime() + 29 * DAY))).toMatchObject({ state: "trial", writable: true });
    expect(billingState(b, new Date(now.getTime() + 31 * DAY))).toMatchObject({ state: "read_only", writable: false, readOnlyReason: "trial_ended" });
  });

  test("paid: writable until paidUntil plus 7 days of grace, then read-only", () => {
    const b = { band: "fleet", status: "active", paidUntil: new Date("2026-12-31T00:00:00Z") };
    expect(billingState(b, new Date("2026-12-20T00:00:00Z")).writable).toBe(true);
    expect(billingState(b, new Date("2027-01-05T00:00:00Z")).writable).toBe(true);
    expect(billingState(b, new Date("2027-01-10T00:00:00Z"))).toMatchObject({ writable: false, readOnlyReason: "payment_overdue" });
  });

  test("suspended and cancelled never write", () => {
    expect(billingState({ band: "pro", status: "suspended" }).writable).toBe(false);
    expect(billingState({ band: "pro", status: "cancelled" })).toMatchObject({ writable: false, readOnlyReason: "cancelled" });
  });

  test("prices are only in the config", () => {
    expect([BANDS.starter.priceUsd, BANDS.fleet.priceUsd, BANDS.pro.priceUsd]).toEqual([9, 29, 59]);
  });
});

describe("billing over HTTP", () => {
  let mongod;
  const company = (extra = {}) =>
    Deliverer.create({ companyName: "Co" + Math.random(), address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"], ...extra });
  const cookieFor = async (companyId, role = "Deliverer Admin") => {
    const u = await User.create({ name: "P", email: `${Math.random()}@x.test`, password: "password123", phoneNumber: "5", role, address: "S", city: "H", companyId });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const addCustomer = (ck) => request(app).post("/api/v2/customer/create-customer").set("Cookie", ck).send({ name: "Acme " + Math.random(), address: "1 Road" });
  const addVehicle = (ck, reg) =>
    request(app).post("/api/v2/vehicle/create-vehicle").set("Cookie", ck).field("make", "Isuzu").field("regNumber", reg).field("size", "small");
  const drain = (r, cb) => {
    r.on("data", () => {});
    r.on("end", () => cb(null, Buffer.alloc(0)));
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    clearBillingCache();
  });

  test("a legacy company (no billing record) is never blocked", async () => {
    const ck = await cookieFor((await company())._id);
    expect((await addCustomer(ck)).status).toBe(201);
  });

  test("in its trial a company writes; after it, it can read and export but not write", async () => {
    const c = await company({ billing: { band: "starter", status: "trial", trialEndsAt: days(5) } });
    const ck = await cookieFor(c._id);
    expect((await addCustomer(ck)).status).toBe(201);

    await Deliverer.updateOne({ _id: c._id }, { "billing.trialEndsAt": days(-1) });
    clearBillingCache(c._id);
    const blocked = await addCustomer(ck);
    expect(blocked.status).toBe(402);
    expect(blocked.body.message).toMatch(/free trial has ended/);
    expect((await request(app).get("/api/v2/customer/get-all-customers-page").set("Cookie", ck)).status).toBe(200);
    expect((await request(app).get("/api/v2/tenant/export").set("Cookie", ck).buffer(true).parse(drain)).status).toBe(200);
    // leaving is still possible: the request reaches its handler (bad name), billing does not stop it
    expect((await request(app).post("/api/v2/tenant/deletion").set("Cookie", ck).send({ confirmName: "wrong" })).status).toBe(400);
  });

  test("/tenant/me tells the app the state", async () => {
    const c = await company({ billing: { band: "fleet", status: "trial", trialEndsAt: days(10) } });
    const me = await request(app).get("/api/v2/tenant/me").set("Cookie", await cookieFor(c._id));
    expect(me.body.billing).toMatchObject({ state: "trial", band: "fleet", priceUsd: 29, writable: true, daysLeft: 10 });
    expect(JSON.stringify(me.body.billing)).not.toMatch(/note/);
  });

  test("adding trucks moves up a band without a second trial, and stops at 25", async () => {
    const c = await company({ billing: { band: "starter", status: "trial", trialEndsAt: days(20) } });
    const ck = await cookieFor(c._id);
    for (const reg of ["A1", "B2", "C3"]) expect((await addVehicle(ck, reg)).status).toBe(201);
    const after = await Deliverer.findById(c._id).lean();
    expect(after.billing.band).toBe("fleet");
    expect(new Date(after.billing.trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 19 * DAY);
    await Deliverer.updateOne({ _id: c._id }, { vehicle_ids: Array.from({ length: 25 }, () => new mongoose.Types.ObjectId()) });
    const full = await addVehicle(ck, "Z26");
    expect(full.status).toBe(402);
    expect(full.body.message).toMatch(/up to 25 trucks/);
  });

  test("only platform admins set plans; changes are audited; a legacy company can be put on a plan", async () => {
    const c = await company();
    const owner = await cookieFor(c._id);
    const platform = await cookieFor(undefined, "Site Admin");
    const body = { companyId: String(c._id), band: "pro", status: "active", paidUntil: days(30).toISOString(), note: "paid by EcoCash" };
    expect((await request(app).put("/api/v2/tenant/billing").set("Cookie", owner).send(body)).status).toBe(403);
    expect((await request(app).put("/api/v2/tenant/billing").send(body)).status).toBe(401);

    const res = await request(app).put("/api/v2/tenant/billing").set("Cookie", platform).send(body);
    expect(res.status).toBe(200);
    expect(res.body.billing).toMatchObject({ state: "active", band: "pro", priceUsd: 59 });
    const audit = await mongoose.connection.collection("auditlogs").find({ action: "billing.update" }).toArray();
    expect(audit).toHaveLength(1);
    expect(String(audit[0].companyId)).toBe(String(c._id));
    expect(audit[0].before && audit[0].before.band).toBeFalsy(); // was legacy

    expect((await request(app).put("/api/v2/tenant/billing").set("Cookie", platform).send({ companyId: String(c._id), band: "gold" })).status).toBe(400);
    expect((await request(app).put("/api/v2/tenant/billing").set("Cookie", platform).send({ companyId: String(c._id), status: "suspended" })).status).toBe(200);
    clearBillingCache(c._id);
    expect((await addCustomer(owner)).status).toBe(403);
  });

  test("extending an ended trial counts from today", async () => {
    const c = await company({ billing: { band: "starter", status: "trial", trialEndsAt: days(-3) } });
    const platform = await cookieFor(undefined, "Super Admin");
    const res = await request(app).put("/api/v2/tenant/billing").set("Cookie", platform).send({ companyId: String(c._id), extendTrialDays: 14 });
    expect(res.body.billing.state).toBe("trial");
    expect(res.body.billing.daysLeft).toBe(14);
  });

  test("one company's state never affects another", async () => {
    const a = await company({ billing: { band: "starter", status: "suspended" } });
    const b = await company({ billing: { band: "starter", status: "trial", trialEndsAt: days(5) } });
    expect((await addCustomer(await cookieFor(a._id))).status).toBe(403);
    expect((await addCustomer(await cookieFor(b._id))).status).toBe(201);
  });
});
