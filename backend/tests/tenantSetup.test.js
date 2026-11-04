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

describe("first-run checklist counts", () => {
  let mongod;
  let a;
  let b;
  let cookieA;
  let cookieB;
  const company = (companyName) =>
    Deliverer.create({ companyName, address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"] });
  const cookieFor = async (companyId, email) => {
    const u = await User.create({ name: "P", email, password: "password123", phoneNumber: "5", role: "Deliverer Admin", address: "S", city: "H", companyId });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const oid = () => new mongoose.Types.ObjectId();

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
    a = await company("A");
    b = await company("B");
    cookieA = await cookieFor(a._id, "a@x.test");
    cookieB = await cookieFor(b._id, "b@x.test");
  });

  test("a brand-new company has nothing done", async () => {
    const res = await request(app).get("/api/v2/tenant/setup").set("Cookie", cookieA);
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ vehicles: 0, drivers: 0, customers: 0, jobs: 0, invoices: 0 });
  });

  test("it counts the company's own records and no one else's", async () => {
    await Deliverer.updateOne({ _id: a._id }, { vehicle_ids: [oid(), oid()], driver_ids: [oid()], customer_ids: [oid()], job_ids: [oid()] });
    await mongoose.connection.collection("invoices").insertOne({ tenantId: a._id });
    await mongoose.connection.collection("invoices").insertOne({ tenantId: b._id });
    const a1 = await request(app).get("/api/v2/tenant/setup").set("Cookie", cookieA);
    expect(a1.body.counts).toEqual({ vehicles: 2, drivers: 1, customers: 1, jobs: 1, invoices: 1 });
    const b1 = await request(app).get("/api/v2/tenant/setup").set("Cookie", cookieB);
    expect(b1.body.counts).toEqual({ vehicles: 0, drivers: 0, customers: 0, jobs: 0, invoices: 1 });
  });

  test("signed-out visitors get nothing", async () => {
    expect((await request(app).get("/api/v2/tenant/setup")).status).toBe(401);
  });
});
