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

jest.setTimeout(120000);

describe("rebuild-stats works on one company", () => {
  let mongod;
  let a;
  let b;
  let db;
  let adminCookie;
  let ownerCookie;
  const vehA = new mongoose.Types.ObjectId();
  const vehB = new mongoose.Types.ObjectId();

  const company = (companyName) =>
    Deliverer.create({ companyName, address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"] });
  const cookieFor = async (companyId, email, role) => {
    const u = await User.create({ name: "P", email, password: "password123", phoneNumber: "5", role, address: "S", city: "H", companyId });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const rebuild = (cookie, body) => request(app).post("/api/v2/overallStats/rebuild-stats").set("Cookie", cookie).send(body);

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    db = mongoose.connection.db;
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await db.dropDatabase();
    a = await company("A");
    b = await company("B");
    adminCookie = await cookieFor(undefined, "site@x.test", "Site Admin");
    ownerCookie = await cookieFor(a._id, "a@x.test", "Deliverer Admin");

    const jobsA = await db.collection("jobs").insertMany([
      { tenantId: a._id, vehicleId: vehA, orderDate: new Date("2026-03-05"), cost: "100", distance: 10 },
      { tenantId: a._id, vehicleId: vehA, orderDate: new Date("2026-03-09"), cost: "50", distance: 5 },
    ]);
    const jobsB = await db.collection("jobs").insertMany([
      { tenantId: b._id, vehicleId: vehB, orderDate: new Date("2026-03-05"), cost: "999", distance: 99 },
    ]);
    await Deliverer.updateOne({ _id: a._id }, { job_ids: Object.values(jobsA.insertedIds), vehicle_ids: [vehA] });
    await Deliverer.updateOne({ _id: b._id }, { job_ids: Object.values(jobsB.insertedIds), vehicle_ids: [vehB] });

    // stale, wrong statistics for both companies
    await db.collection("overallstats").insertMany([
      { companyId: a._id, year: 2026, yearlyRevenue: 1, yearlyJobs: 1 },
      { companyId: b._id, year: 2026, yearlyRevenue: 12345, yearlyJobs: 77 },
    ]);
    await db.collection("vehiclestats").insertMany([
      { tenantId: b._id, vehicleId: String(vehB), year: 2026, yearlyRevenue: 12345 },
    ]);
  });

  test("it rebuilds the named company from its own jobs", async () => {
    const res = await rebuild(adminCookie, { companyId: String(a._id) });
    expect(res.status).toBe(200);
    const overall = await db.collection("overallstats").findOne({ companyId: a._id });
    expect(overall.yearlyRevenue).toBe(150);
    expect(overall.yearlyJobs).toBe(2);
    const vehicle = await db.collection("vehiclestats").findOne({ vehicleId: String(vehA) });
    expect(vehicle.yearlyRevenue).toBe(150);
    expect(String(vehicle.tenantId)).toBe(String(a._id));
  });

  test("the other company's statistics are not read, changed or dropped", async () => {
    await rebuild(adminCookie, { companyId: String(a._id) });
    const theirs = await db.collection("overallstats").findOne({ companyId: b._id });
    expect(theirs.yearlyRevenue).toBe(12345);
    expect(theirs.yearlyJobs).toBe(77);
    expect(await db.collection("vehiclestats").countDocuments({ vehicleId: String(vehB) })).toBe(1);
    // and A's numbers contain nothing of B's 999
    const overall = await db.collection("overallstats").findOne({ companyId: a._id });
    expect(JSON.stringify(overall)).not.toMatch(/999/);
  });

  test("running it twice gives the same result, not doubled", async () => {
    await rebuild(adminCookie, { companyId: String(a._id) });
    await rebuild(adminCookie, { companyId: String(a._id) });
    expect(await db.collection("overallstats").countDocuments({ companyId: a._id })).toBe(1);
    expect(await db.collection("vehiclestats").countDocuments({ vehicleId: String(vehA) })).toBe(1);
  });

  test("a company must be named, must exist, and only platform admins may ask", async () => {
    expect((await rebuild(adminCookie, {})).status).toBe(400);
    expect((await rebuild(adminCookie, { companyId: "nope" })).status).toBe(400);
    expect((await rebuild(adminCookie, { companyId: String(new mongoose.Types.ObjectId()) })).status).toBe(404);
    expect((await rebuild(ownerCookie, { companyId: String(a._id) })).status).toBe(403);
    expect((await request(app).post("/api/v2/overallStats/rebuild-stats").send({ companyId: String(a._id) })).status).toBe(401);
    // nothing was touched by the refusals
    expect((await db.collection("overallstats").findOne({ companyId: a._id })).yearlyRevenue).toBe(1);
  });
});
