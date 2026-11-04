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
const AiUsage = require("../model/aiUsage");

jest.setTimeout(120000);
const DAY = 86400000;
const days = (n) => new Date(Date.now() + n * DAY);

describe("platform admin console API", () => {
  let mongod;
  let a;
  let b;
  let c;
  let platform;
  let owner;

  const company = (name, extra = {}) =>
    Deliverer.create({ companyName: name, address: "S", city: "Harare", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"], ...extra });
  const cookieFor = async (companyId, role, email) => {
    const u = await User.create({ name: "P", email, password: "password123", phoneNumber: "5", role, address: "S", city: "H", companyId });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const get = (path, cookie) => request(app).get(path).set("Cookie", cookie);

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
    a = await company("Alpha Haulage"); // legacy
    b = await company("Bravo Freight", { billing: { band: "fleet", status: "trial", trialEndsAt: days(3) } });
    c = await company("Charlie Cargo", { billing: { band: "pro", status: "active", paidUntil: days(20) }, vehicle_ids: [new mongoose.Types.ObjectId()] });
    platform = await cookieFor(undefined, "Site Admin", "site@x.test");
    owner = await cookieFor(a._id, "Deliverer Admin", "owner@alpha.test");
    await cookieFor(b._id, "Deliverer Admin", "owner@bravo.test");
    await AiUsage.create({ tenantId: b._id, month: new Date().toISOString().slice(0, 7), pages: 12, calls: 4 });
  });

  test("everything is closed to company users and signed-out visitors", async () => {
    for (const path of ["/api/v2/admin/companies", "/api/v2/admin/summary", `/api/v2/admin/companies/${a._id}/audit`]) {
      expect((await get(path, owner)).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
    }
    expect((await request(app).post(`/api/v2/admin/companies/${b._id}/deletion`).set("Cookie", owner)).status).toBe(403);
    expect((await request(app).delete(`/api/v2/admin/companies/${b._id}/deletion`).set("Cookie", owner)).status).toBe(403);
  });

  test("the list shows every company with its state, people, size and AI use", async () => {
    const res = await get("/api/v2/admin/companies", platform);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.companies.map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual(["Alpha Haulage", "Bravo Freight", "Charlie Cargo"]);
    expect(byName["Alpha Haulage"].billing.state).toBe("legacy");
    expect(byName["Alpha Haulage"].ownerEmail).toBe("owner@alpha.test");
    expect(byName["Bravo Freight"]).toMatchObject({ aiPagesThisMonth: 12, aiCallsThisMonth: 4, users: 1 });
    expect(byName["Bravo Freight"].billing).toMatchObject({ state: "trial", band: "fleet", daysLeft: 3 });
    expect(byName["Charlie Cargo"]).toMatchObject({ vehicles: 1 });
  });

  test("search narrows by name, owner email or city", async () => {
    const byName = await get("/api/v2/admin/companies?search=bravo", platform);
    expect(byName.body.companies.map((r) => r.name)).toEqual(["Bravo Freight"]);
    const byEmail = await get("/api/v2/admin/companies?search=owner@alpha", platform);
    expect(byEmail.body.companies.map((r) => r.name)).toEqual(["Alpha Haulage"]);
    expect((await get("/api/v2/admin/companies?search=zzz", platform)).body.companies).toHaveLength(0);
  });

  test("the summary counts states, list-price income, trials ending soon and AI use", async () => {
    const { summary } = (await get("/api/v2/admin/summary", platform)).body;
    expect(summary.companies).toBe(3);
    expect(summary.byState).toEqual({ legacy: 1, trial: 1, active: 1 });
    expect(summary.monthlyUsd).toBe(59); // only the active pro company
    expect(summary.trialsEndingWithin7Days).toBe(1);
    expect(summary.aiPagesThisMonth).toBe(12);
  });

  test("scheduling and cancelling deletion works for any company and is audited", async () => {
    const sched = await request(app).post(`/api/v2/admin/companies/${b._id}/deletion`).set("Cookie", platform);
    expect(sched.status).toBe(200);
    expect(sched.body.deletion).toMatchObject({ pending: true, daysLeft: 30 });
    expect((await Deliverer.findById(b._id).lean()).deletionScheduledFor).toBeTruthy();
    expect((await Deliverer.findById(a._id).lean()).deletionScheduledFor).toBeUndefined(); // others untouched

    const audit = await get(`/api/v2/admin/companies/${b._id}/audit`, platform);
    expect(audit.body.entries[0]).toMatchObject({ action: "deletion.schedule", by: "site@x.test" });

    const cancel = await request(app).delete(`/api/v2/admin/companies/${b._id}/deletion`).set("Cookie", platform);
    expect(cancel.body.deletion.pending).toBe(false);
    expect((await Deliverer.findById(b._id).lean()).deletionScheduledFor).toBeUndefined();
    const after = await get(`/api/v2/admin/companies/${b._id}/audit`, platform);
    expect(after.body.entries.map((e) => e.action)).toEqual(["deletion.cancel", "deletion.schedule"]);
  });

  test("plan changes made through the billing endpoint show up in the list and the audit trail", async () => {
    await request(app).put("/api/v2/tenant/billing").set("Cookie", platform).send({ companyId: String(b._id), status: "active", paidUntil: days(30).toISOString(), note: "EcoCash ref 123" });
    const row = (await get("/api/v2/admin/companies?search=bravo", platform)).body.companies[0];
    expect(row.billing.state).toBe("active");
    expect(row.note).toBe("EcoCash ref 123");
    const trail = (await get(`/api/v2/admin/companies/${b._id}/audit`, platform)).body.entries;
    expect(trail[0].action).toBe("billing.update");
  });

  test("bad ids are a clean 404", async () => {
    expect((await get("/api/v2/admin/companies/not-an-id/audit", platform)).status).toBe(404);
    expect((await request(app).post(`/api/v2/admin/companies/${new mongoose.Types.ObjectId()}/deletion`).set("Cookie", platform)).status).toBe(404);
  });
});

describe("signing in as a platform admin without a company", () => {
  let mongod;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("get-user works for a Site Admin with no company, and still fails for an ordinary user with none", async () => {
    await mongoose.connection.db.dropDatabase();
    const mk = (role, email) => User.create({ name: "P", email, password: "password123", phoneNumber: "5", role, address: "S", city: "H" });
    const ck = (u) => ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
    const platform = await mk("Site Admin", "p@x.test");
    const ordinary = await mk("Deliverer Admin", "o@x.test");
    const ok = await request(app).get("/api/v2/user/get-user").set("Cookie", ck(platform));
    expect(ok.status).toBe(200);
    expect(ok.body.delivererName).toBe("");
    expect((await request(app).get("/api/v2/user/get-user").set("Cookie", ck(ordinary))).status).toBe(400);
  });
});
