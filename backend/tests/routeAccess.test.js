/*
 * Access sweeps over EVERY route (discovered from the router, so new routes are covered):
 *   1. signed-out callers get 401 everywhere except the routes that are public by design
 *   2. a company whose trial ended / that is suspended cannot write through any route
 *   3. company roles below "Deliverer Admin" cannot reach money, billing, user-management,
 *      tenant-admin or platform-admin routes
 *   4. the cron endpoints need the CRON_SECRET
 *   5. company users never receive the platform's private billing note
 */
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
const { clearBillingCache } = require("../services/billing");
const { listRoutes, fillParams } = require("./helpers/routes");

jest.setTimeout(300000);
const DAY = 86400000;
const days = (n) => new Date(Date.now() + n * DAY);

// Public by design: they authenticate by other means (credentials, a token, the cron secret).
const PUBLIC = [
  /\/api\/health$/,
  /\/user\/login-user$/,
  /\/user\/create-user$/,
  /\/user\/activation$/,
  /\/user\/forgot-password$/,
  /\/user\/reset-password$/,
  /\/user\/logout$/,
  /\/auth\/bootstrap$/,
  /\/tenant\/purge-due$/,
  /\/tenant\/billing-notices$/,
];
const isPublic = (r) => PUBLIC.some((rx) => rx.test(r.path));

// Writes that must keep working for a read-only company (see services/billing.js).
const ALWAYS_WRITABLE = [/^\/api\/v2\/tenant\/deletion$/, /^\/api\/v2\/auth\//];

const FINANCE = [/^\/api\/v2\/expense\//, /^\/api\/v2\/fuel\//, /^\/api\/v2\/invoice\//, /^\/api\/v2\/payment\//, /^\/api\/v2\/quotation\//];
const ADMIN_ONLY = [
  /^\/api\/v2\/admin\//,
  /^\/api\/v2\/tenant\/billing$/,
  /^\/api\/v2\/tenant\/modules$/,
  /^\/api\/v2\/tenant\/export$/,
  /^\/api\/v2\/tenant\/deletion$/,
  /^\/api\/v2\/user\/create-admin$/,
  /^\/api\/v2\/user\/update-admin$/,
  /^\/api\/v2\/user\/delete-admin\//,
  /^\/api\/v2\/overallStats\/rebuild-stats$/,
  /^\/api\/v2\/deliverer\/create-deliverer$/,
  /^\/api\/v2\/deliverer\/update-deliverer$/,
];

describe("route access sweeps", () => {
  let mongod;
  const company = (extra = {}) =>
    Deliverer.create({ companyName: "Co" + Math.random(), address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"], ...extra });
  const cookieFor = async (companyId, role = "Deliverer Admin") => {
    const u = await User.create({ name: "P", email: `${Math.random()}@x.test`, password: "password123", phoneNumber: "5", role, address: "S", city: "H", companyId });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const call = (route, cookie, body) => {
    let req = request(app)[route.method.toLowerCase()](fillParams(route.path));
    if (cookie) req = req.set("Cookie", cookie);
    if (route.method !== "GET") req = req.send(body || {});
    return req;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 120000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    clearBillingCache();
  });

  test("route discovery finds the whole API", () => {
    expect(listRoutes(app).length).toBeGreaterThan(100);
  });

  test("signed-out callers get 401 on every non-public route", async () => {
    const bad = [];
    for (const route of listRoutes(app).filter((r) => !isPublic(r))) {
      const res = await call(route, null);
      if (res.status !== 401) bad.push(`${route.method} ${route.path} -> ${res.status}`);
    }
    expect(bad).toEqual([]);
  });

  test("logout clears the session cookie, works signed out, and is allowed for a read-only company", async () => {
    const res = await request(app).post("/api/v2/user/logout");
    expect(res.status).toBe(200);
    expect(String(res.headers["set-cookie"])).toMatch(/token=;/);
    const c = await company({ billing: { band: "starter", status: "suspended" } });
    const ro = await request(app).post("/api/v2/user/logout").set("Cookie", await cookieFor(c._id));
    expect(ro.status).toBe(200);
  });

  test("a forged or expired cookie is not accepted anywhere", async () => {
    const forged = ["token=" + jwt.sign({ id: new mongoose.Types.ObjectId() }, "not-the-secret")];
    const unknownUser = ["token=" + jwt.sign({ id: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET_KEY)];
    const bad = [];
    for (const route of listRoutes(app).filter((r) => !isPublic(r))) {
      for (const ck of [forged, unknownUser]) {
        const res = await call(route, ck);
        if (res.status !== 401) bad.push(`${route.method} ${route.path} -> ${res.status}`);
      }
    }
    expect(bad).toEqual([]);
  });

  describe.each([
    ["trial ended", { band: "starter", status: "trial", trialEndsAt: days(-2) }, 402],
    ["payment overdue", { band: "fleet", status: "active", paidUntil: days(-30) }, 402],
    ["suspended", { band: "fleet", status: "suspended" }, 403],
    ["cancelled", { band: "fleet", status: "cancelled" }, 402],
  ])("read-only company (%s)", (_label, billing, expected) => {
    test("every write route refuses it; reads still work", async () => {
      const c = await company({ billing });
      const ck = await cookieFor(c._id);
      const bad = [];
      const writes = listRoutes(app).filter(
        (r) => r.method !== "GET" && !isPublic(r) && !ALWAYS_WRITABLE.some((rx) => rx.test(r.path))
      );
      expect(writes.length).toBeGreaterThan(50);
      for (const route of writes) {
        const res = await call(route, ck);
        if (res.status !== expected) bad.push(`${route.method} ${route.path} -> ${res.status}`);
      }
      expect(bad).toEqual([]);
      expect((await request(app).get("/api/v2/customer/get-all-customers-page").set("Cookie", ck)).status).toBe(200);
      expect((await request(app).get("/api/v2/tenant/me").set("Cookie", ck)).status).toBe(200);
    });
  });

  test("a platform admin is not blocked by any company's read-only state", async () => {
    const c = await company({ billing: { band: "starter", status: "suspended" } });
    const platform = await cookieFor(undefined, "Super Admin");
    const res = await request(app)
      .put("/api/v2/tenant/billing")
      .set("Cookie", platform)
      .send({ companyId: String(c._id), status: "active", paidUntil: days(30).toISOString() });
    expect(res.status).toBe(200);
  });

  describe.each(["Deliverer Manager", "Contractor Manager", "Contractor Admin", "deliverer"])("company user with role %s", (role) => {
    test("cannot reach finance routes", async () => {
      const ck = await cookieFor((await company())._id, role);
      const bad = [];
      for (const route of listRoutes(app).filter((r) => FINANCE.some((rx) => rx.test(r.path)))) {
        const res = await call(route, ck);
        if (res.status !== 403) bad.push(`${route.method} ${route.path} -> ${res.status}`);
      }
      expect(bad).toEqual([]);
    });

    test("cannot reach billing, user-management, tenant-admin or platform routes", async () => {
      const ck = await cookieFor((await company())._id, role);
      const bad = [];
      for (const route of listRoutes(app).filter((r) => ADMIN_ONLY.some((rx) => rx.test(r.path)))) {
        const res = await call(route, ck);
        if (res.status !== 403) bad.push(`${route.method} ${route.path} -> ${res.status}`);
      }
      expect(bad).toEqual([]);
    });
  });

  test("a company's own admin cannot reach platform-only routes or set billing", async () => {
    const owner = await cookieFor((await company())._id, "Deliverer Admin");
    const platformOnly = [/^\/api\/v2\/admin\//, /^\/api\/v2\/tenant\/billing$/, /^\/api\/v2\/overallStats\/rebuild-stats$/, /^\/api\/v2\/deliverer\/create-deliverer$/];
    const bad = [];
    for (const route of listRoutes(app).filter((r) => platformOnly.some((rx) => rx.test(r.path)))) {
      const res = await call(route, owner);
      if (res.status !== 403) bad.push(`${route.method} ${route.path} -> ${res.status}`);
    }
    expect(bad).toEqual([]);
  });

  test("a Site Admin cannot reach finance data (money is for company admins)", async () => {
    const site = await cookieFor(undefined, "Site Admin");
    const res = await request(app).get("/api/v2/invoice/get-invoices").set("Cookie", site);
    expect(res.status).toBe(403);
  });

  describe("cron endpoints", () => {
    const original = process.env.CRON_SECRET;
    afterEach(() => {
      process.env.CRON_SECRET = original;
    });

    test.each(["/api/v2/tenant/purge-due", "/api/v2/tenant/billing-notices"])("%s does nothing without a configured secret", async (path) => {
      process.env.CRON_SECRET = "";
      expect((await request(app).get(path)).status).toBe(404);
      expect((await request(app).get(path).set("Authorization", "Bearer ")).status).toBe(404);
      expect((await request(app).get(path).set("Authorization", "Bearer undefined")).status).toBe(404);
    });

    test.each(["/api/v2/tenant/purge-due", "/api/v2/tenant/billing-notices"])("%s needs the exact secret", async (path) => {
      process.env.CRON_SECRET = "s3cret-value";
      const owner = await cookieFor((await company())._id, "Deliverer Admin");
      const platform = await cookieFor(undefined, "Super Admin");
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set("Authorization", "Bearer wrong")).status).toBe(401);
      expect((await request(app).get(path).set("Authorization", "s3cret-value")).status).toBe(401); // no Bearer prefix
      expect((await request(app).get(path).set("Authorization", "Bearer s3cret-value-extra")).status).toBe(401);
      expect((await request(app).get(path).set("Cookie", owner)).status).toBe(401); // a login is not a cron key
      expect((await request(app).get(path).set("Cookie", platform)).status).toBe(401);
      expect((await request(app).get(path).query({ secret: "s3cret-value" })).status).toBe(401); // not via the URL
      expect((await request(app).get(path).set("Authorization", "Bearer s3cret-value")).status).toBe(200);
    });

    test("the cron endpoints are GET only", async () => {
      process.env.CRON_SECRET = "s3cret-value";
      for (const path of ["/api/v2/tenant/purge-due", "/api/v2/tenant/billing-notices"]) {
        const res = await request(app).post(path).set("Authorization", "Bearer s3cret-value");
        expect([404, 405]).toContain(res.status);
      }
    });
  });

  describe("private billing note", () => {
    const withNote = () =>
      company({ billing: { band: "fleet", status: "trial", trialEndsAt: days(10), note: "PRIVATE-PLATFORM-NOTE", notices: { trial: "x" } } });

    test("company users never receive it", async () => {
      const c = await withNote();
      const ck = await cookieFor(c._id, "Deliverer Admin");
      for (const path of [
        "/api/v2/deliverer/get-deliverer-info",
        "/api/v2/deliverer/get-all-deliverers-page",
        "/api/v2/tenant/me",
        "/api/v2/user/get-user",
        "/api/v2/tenant/setup",
      ]) {
        const res = await request(app).get(path).set("Cookie", ck);
        expect(res.status).toBeLessThan(300);
        expect(JSON.stringify(res.body)).not.toContain("PRIVATE-PLATFORM-NOTE");
      }
    });

    test("platform admins still see it in the console", async () => {
      await withNote();
      const platform = await cookieFor(undefined, "Site Admin");
      const res = await request(app).get("/api/v2/admin/companies").set("Cookie", platform);
      expect(JSON.stringify(res.body)).toContain("PRIVATE-PLATFORM-NOTE");
    });
  });
});
