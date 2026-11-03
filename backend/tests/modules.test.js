const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const { resolveModules, applyModuleChanges, NEW_TENANT_MODULES } = require("../config/modules");
const { clearModuleCache } = require("../middleware/moduleAccess");
const app = require("../app");

const company = (extra = {}) =>
  Deliverer.create({
    companyName: "Co " + Math.random().toString(36).slice(2, 7),
    address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"],
    ...extra,
  });

async function userFor(companyId, role = "Deliverer Admin") {
  const u = await User.create({
    name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123",
    phoneNumber: "1", role, address: "a", city: "c", companyId,
  });
  return "token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY);
}

describe("module registry", () => {
  test("legacy companies (no settings) keep every available module on", () => {
    const m = resolveModules(undefined);
    expect(m.expenses && m.fuel && m.analytics).toBe(true);
    expect(m.invoices).toBe(false); // not built yet
  });
  test("new tenants start lean", () => {
    expect(NEW_TENANT_MODULES).toMatchObject({ expenses: false, fuel: false, analytics: true });
  });
  test("changes are validated", () => {
    expect(applyModuleChanges({}, { nope: true }).ok).toBe(false);
    expect(applyModuleChanges({}, { fuel: "yes" }).ok).toBe(false);
    expect(applyModuleChanges({}, { invoices: true }).ok).toBe(false);
    const ok = applyModuleChanges(NEW_TENANT_MODULES, { fuel: true });
    expect(ok.ok).toBe(true);
    expect(ok.next.fuel).toBe(true);
    expect(ok.next.analytics).toBe(true);
  });
});

describe("module toggles over HTTP", () => {
  let mongod;
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
    clearModuleCache();
  });

  test("/tenant/me reports a legacy company with everything available on", async () => {
    const c = await company();
    const res = await request(app).get("/api/v2/tenant/me").set("Cookie", [await userFor(c._id)]);
    expect(res.status).toBe(200);
    expect(res.body.modules).toMatchObject({ expenses: true, fuel: true, analytics: true, invoices: false });
    expect(res.body.plan).toBe("free");
    expect(res.body.registry.length).toBeGreaterThan(3);
  });

  test("a switched-off module is blocked on the server, and works again once enabled", async () => {
    const c = await company({ modules: { expenses: false, fuel: false, analytics: true } });
    const cookie = [await userFor(c._id)];

    const blocked = await request(app).get("/api/v2/fuel/get-fills").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MODULE_DISABLED");

    const on = await request(app).put("/api/v2/tenant/modules").set("Cookie", cookie).send({ modules: { fuel: true } });
    expect(on.status).toBe(200);
    expect(on.body.modules.fuel).toBe(true);

    const allowed = await request(app).get("/api/v2/fuel/get-fills").set("Cookie", cookie);
    expect(allowed.status).toBe(200);
  });

  test("only company admins change modules, and only their own company", async () => {
    const a = await company({ modules: { fuel: false } });
    const b = await company({ modules: { fuel: false } });

    const manager = await request(app).put("/api/v2/tenant/modules")
      .set("Cookie", [await userFor(a._id, "Deliverer Manager")]).send({ modules: { fuel: true } });
    expect(manager.status).toBe(403);

    // an admin naming another company is ignored: their own company is changed
    const admin = await request(app).put("/api/v2/tenant/modules")
      .set("Cookie", [await userFor(a._id)]).send({ companyId: String(b._id), modules: { fuel: true } });
    expect(admin.status).toBe(200);
    expect((await Deliverer.findById(a._id)).modules.fuel).toBe(true);
    expect((await Deliverer.findById(b._id)).modules.fuel).toBe(false);
  });

  test("unknown or unavailable modules are rejected", async () => {
    const c = await company({ modules: {} });
    const cookie = [await userFor(c._id)];
    const unknown = await request(app).put("/api/v2/tenant/modules").set("Cookie", cookie).send({ modules: { rockets: true } });
    expect(unknown.status).toBe(400);
    const future = await request(app).put("/api/v2/tenant/modules").set("Cookie", cookie).send({ modules: { invoices: true } });
    expect(future.status).toBe(400);
  });
});
