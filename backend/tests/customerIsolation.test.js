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
const Customer = require("../model/customer");
const Vehicle = require("../model/vehicle");
const Contractor = require("../model/contractor");
const { ownCustomerFilter } = require("../services/customerScope");

jest.setTimeout(120000);

const company = (companyName) =>
  Deliverer.create({
    companyName,
    address: "Street",
    city: "Harare",
    goodsType: ["general"],
    vehiclesType: ["small"],
    deliveryType: ["standard"],
  });

async function admin(companyId, email) {
  const user = await User.create({
    name: "Admin",
    email,
    password: "password123",
    phoneNumber: "555",
    role: "Deliverer Admin",
    address: "Street",
    city: "Harare",
    companyId,
  });
  return ["token=" + jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
}

describe("customers are per company", () => {
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
  });

  test("two companies can each have a customer with the same name, and never share the record", async () => {
    const a = await company("A");
    const b = await company("B");
    const cookieA = await admin(a._id, "a@x.test");
    const cookieB = await admin(b._id, "b@x.test");

    const mk = (cookie, phone) =>
      request(app).post("/api/v2/customer/create-customer").set("Cookie", cookie).send({
        name: "Limpopo Retail Group",
        phoneNumber: phone,
        address: "1 Main Road",
        city: "Harare",
      });

    expect((await mk(cookieA, "AAA-111")).status).toBe(201);
    expect((await mk(cookieB, "BBB-222")).status).toBe(201);

    // two separate records, each stamped for its own company
    const all = await Customer.find({ name: "Limpopo Retail Group" }).lean();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((c) => String(c.tenantId)))).toEqual(new Set([String(a._id), String(b._id)]));

    // B sees only B's, A sees only A's
    const listB = await request(app).get("/api/v2/customer/get-all-customers-page").set("Cookie", cookieB);
    expect(JSON.stringify(listB.body)).toContain("BBB-222");
    expect(JSON.stringify(listB.body)).not.toContain("AAA-111");
    const listA = await request(app).get("/api/v2/customer/get-all-customers-page").set("Cookie", cookieA);
    expect(JSON.stringify(listA.body)).toContain("AAA-111");
    expect(JSON.stringify(listA.body)).not.toContain("BBB-222");

    // B deleting theirs leaves A's alone
    const bRecord = all.find((c) => String(c.tenantId) === String(b._id));
    const del = await request(app)
      .delete(`/api/v2/customer/delete-customer/${bRecord._id}`)
      .set("Cookie", cookieB);
    expect(del.status).toBeLessThan(300);
    expect(await Customer.countDocuments({ name: "Limpopo Retail Group", tenantId: a._id })).toBe(1);
  });

  test("adding the same customer twice in one company is still refused", async () => {
    const a = await company("A");
    const cookieA = await admin(a._id, "a@x.test");
    const body = { name: "Same Co", phoneNumber: "1", address: "x", city: "Harare" };
    expect((await request(app).post("/api/v2/customer/create-customer").set("Cookie", cookieA).send(body)).status).toBe(201);
    expect((await request(app).post("/api/v2/customer/create-customer").set("Cookie", cookieA).send(body)).status).toBe(409);
  });

  test("two companies can each register a truck with the same plate, as separate vehicles", async () => {
    const a = await company("A");
    const b = await company("B");
    const cookieA = await admin(a._id, "a@x.test");
    const cookieB = await admin(b._id, "b@x.test");
    const mk = (cookie) =>
      request(app).post("/api/v2/vehicle/create-vehicle").set("Cookie", cookie).send({ make: "DAF", regNumber: "AFE5848", size: "horse" });

    expect((await mk(cookieA)).status).toBe(201);
    expect((await mk(cookieB)).status).toBe(201);
    const vehicles = await Vehicle.find({ regNumber: "AFE5848" }).lean();
    expect(vehicles).toHaveLength(2);
    expect(new Set(vehicles.map((v) => String(v.tenantId)))).toEqual(new Set([String(a._id), String(b._id)]));
    expect((await Deliverer.findById(b._id)).vehicle_ids.map(String)).toEqual([String(vehicles.find((v) => String(v.tenantId) === String(b._id))._id)]);
    // the same company adding the same plate twice is still refused
    expect((await mk(cookieA)).status).toBe(500);
  });

  test("two companies can each add a contractor with the same name, as separate records", async () => {
    const a = await company("A");
    const b = await company("B");
    const cookieA = await admin(a._id, "a@x.test");
    const cookieB = await admin(b._id, "b@x.test");
    const mk = (cookie) =>
      request(app)
        .post("/api/v2/contractor/create-contractor")
        .set("Cookie", cookie)
        .field("companyName", "Zambezi Building Supplies")
        .field("address", "1 Road")
        .field("city", "Harare")
        .field("contact", "0771")
        .field("goodsTypes", "general")
        .field("vehiclesTypes", "small")
        .field("deliveryTypes", "standard")
        .field("prefix", "ZB")
        .field("lastOrder", "0")
        .field("vrates", "[]");

    expect((await mk(cookieA)).status).toBeLessThan(300);
    expect((await mk(cookieB)).status).toBeLessThan(300);
    const contractors = await Contractor.find({ companyName: "Zambezi Building Supplies" }).lean();
    expect(contractors).toHaveLength(2);
    expect(new Set(contractors.map((c) => String(c.tenantId)))).toEqual(new Set([String(a._id), String(b._id)]));
  });

  test("the filter finds legacy unstamped customers only through the company's own list", () => {
    const tenant = new mongoose.Types.ObjectId();
    const mine = new mongoose.Types.ObjectId();
    expect(ownCustomerFilter(tenant, [mine])).toEqual({
      $or: [{ tenantId: tenant }, { tenantId: null, _id: { $in: [mine] } }],
    });
    // no tenant and nothing linked matches nothing, never everything
    expect(ownCustomerFilter(undefined, [])).toEqual({ _id: { $in: [] } });
  });
});
