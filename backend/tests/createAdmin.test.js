const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Deliverer = require("../model/deliverer");
const User = require("../model/user");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
const app = require("../app");

async function makeDeliverer(companyName) {
  return Deliverer.create({
    companyName,
    address: "Address",
    city: "Harare",
    goodsType: ["general"],
    vehiclesType: ["small"],
    deliveryType: ["standard"],
  });
}

async function makeUser({ role, companyId, email }) {
  const user = await User.create({
    name: `${role} User`,
    email,
    password: "password123",
    phoneNumber: "555",
    role,
    address: "Address",
    city: "Harare",
    companyId,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "1d",
  });
  return { user, token };
}

describe("POST /api/v2/user/create-admin", () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  test("deliverer admin's new admin is forced onto their own company, ignoring a spoofed companyId", async () => {
    const companyA = await makeDeliverer("Company A");
    const companyB = await makeDeliverer("Company B");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: companyA._id,
      email: "delivereradmin@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "New Admin",
        email: "newadmin@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Deliverer Admin",
        password: "password123",
        companyId: companyB._id.toString(), // attempt to assign to a different company
      });

    expect(res.status).toBe(201);

    const created = await User.findOne({ email: "newadmin@test.com" });
    expect(created).toBeTruthy();
    expect(String(created.companyId)).toBe(String(companyA._id));

    const refreshedA = await Deliverer.findById(companyA._id);
    const refreshedB = await Deliverer.findById(companyB._id);
    expect(refreshedA.admin_ids.map(String)).toContain(String(created._id));
    expect(refreshedB.admin_ids.map(String)).not.toContain(String(created._id));
  });

  test("deliverer admin cannot escalate a new admin to a global role", async () => {
    const companyA = await makeDeliverer("Company A");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: companyA._id,
      email: "delivereradmin2@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "Sneaky Admin",
        email: "sneaky@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Super Admin",
        password: "password123",
      });

    expect(res.status).toBe(403);
    expect(await User.findOne({ email: "sneaky@test.com" })).toBeNull();
  });

  test("super admin can pick any company via the dropdown value", async () => {
    const companyA = await makeDeliverer("Company A");
    const companyB = await makeDeliverer("Company B");
    const { token } = await makeUser({
      role: "Super Admin",
      companyId: undefined,
      email: "superadmin@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "New Site Admin",
        email: "newsiteadmin@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Site Admin",
        password: "password123",
        companyId: companyB._id.toString(),
      });

    expect(res.status).toBe(201);
    const created = await User.findOne({ email: "newsiteadmin@test.com" });
    expect(String(created.companyId)).toBe(String(companyB._id));

    const refreshedB = await Deliverer.findById(companyB._id);
    expect(refreshedB.admin_ids.map(String)).toContain(String(created._id));
  });

  test("rejects requests from roles that aren't deliverer/super/site admin", async () => {
    const companyA = await makeDeliverer("Company A");
    const { token } = await makeUser({
      role: "deliverer",
      companyId: companyA._id,
      email: "plain@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "New Admin",
        email: "shouldnotexist@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Deliverer Admin",
        password: "password123",
        companyId: companyA._id.toString(),
      });

    expect(res.status).toBe(403);
    expect(await User.findOne({ email: "shouldnotexist@test.com" })).toBeNull();
  });

  test("rejects unauthenticated requests", async () => {
    const companyA = await makeDeliverer("Company A");
    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .send({
        name: "New Admin",
        email: "noauth@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Deliverer Admin",
        password: "password123",
        companyId: companyA._id.toString(),
      });

    expect(res.status).toBe(401);
  });

  test("rejects a password shorter than 8 characters", async () => {
    const companyA = await makeDeliverer("Company A");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: companyA._id,
      email: "delivereradmin3@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "New Admin",
        email: "shortpw@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Deliverer Admin",
        password: "short",
      });

    expect(res.status).toBe(400);
  });

  test("rejects a duplicate email", async () => {
    const companyA = await makeDeliverer("Company A");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: companyA._id,
      email: "delivereradmin4@test.com",
    });

    const res = await request(app)
      .post("/api/v2/user/create-admin")
      .set("Cookie", [`token=${token}`])
      .send({
        name: "Duplicate",
        email: "delivereradmin4@test.com",
        phoneNumber: "111",
        address: "Somewhere",
        city: "Harare",
        role: "Deliverer Admin",
        password: "password123",
      });

    expect(res.status).toBe(400);
  });
});
