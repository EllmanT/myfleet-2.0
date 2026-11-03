const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Vehicle = require("../model/vehicle");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || "test-activation";
process.env.NODE_ENV = "test";
const app = require("../app");

const makeCompany = (companyName) =>
  Deliverer.create({
    companyName,
    address: "Address",
    city: "Harare",
    goodsType: ["general"],
    vehiclesType: ["small"],
    deliveryType: ["standard"],
  });

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

const cookie = (token) => ["token=" + token];

describe("Phase 0 security", () => {
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

  test("create endpoints reject unauthenticated callers", async () => {
    const company = await makeCompany("A");
    for (const path of [
      "/api/v2/vehicle/create-vehicle",
      "/api/v2/driver/create-driver",
      "/api/v2/customer/create-customer",
      "/api/v2/contractor/create-contractor",
      "/api/v2/deliverer/create-deliverer",
    ]) {
      const res = await request(app)
        .post(path)
        .send({ companyId: company._id.toString(), regNumber: "ABC1234" });
      expect(res.status).toBe(401);
    }
    expect(await Vehicle.countDocuments()).toBe(0);
  });

  test("create-vehicle ignores a spoofed companyId and uses the session company", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "a@test.com",
    });

    const res = await request(app)
      .post("/api/v2/vehicle/create-vehicle")
      .set("Cookie", cookie(token))
      .send({ make: "DAF", regNumber: "AFE5848", size: "horse", companyId: b._id.toString() });

    expect(res.status).toBe(201);
    const refreshedA = await Deliverer.findById(a._id);
    const refreshedB = await Deliverer.findById(b._id);
    expect(refreshedA.vehicle_ids).toHaveLength(1);
    expect(refreshedB.vehicle_ids).toHaveLength(0);
  });

  test("a company admin cannot update or delete another company's vehicle", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const vehicleB = await Vehicle.create({
      make: "Iveco",
      regNumber: "BBB1111",
      size: "largeVehicle",
      companyId: String(b._id),
    });
    b.vehicle_ids.push(vehicleB._id);
    await b.save();
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "a2@test.com",
    });

    const upd = await request(app)
      .put("/api/v2/vehicle/update-vehicle")
      .set("Cookie", cookie(token))
      .send({ id: vehicleB._id.toString(), make: "Hacked", size: "smallVehicle", regNumber: "X" });
    expect(upd.status).toBe(404);

    const del = await request(app)
      .delete(`/api/v2/vehicle/delete-vehicle/${vehicleB._id}`)
      .set("Cookie", cookie(token));
    expect(del.status).toBe(404);

    const still = await Vehicle.findById(vehicleB._id);
    expect(still.make).toBe("Iveco");
  });

  test("a company admin can still update their own vehicle", async () => {
    const a = await makeCompany("A");
    const vehicle = await Vehicle.create({
      make: "DAF",
      regNumber: "AAA1111",
      size: "horse",
      companyId: String(a._id),
    });
    a.vehicle_ids.push(vehicle._id);
    await a.save();
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "a3@test.com",
    });

    const res = await request(app)
      .put("/api/v2/vehicle/update-vehicle")
      .set("Cookie", cookie(token))
      .send({ id: vehicle._id.toString(), make: "DAF XF", size: "horse", regNumber: "AAA1111" });
    expect(res.status).toBe(201);
  });

  test("tenantId wins over the id lists: a record stamped for another company is never ours", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    // Listed on A's vehicle_ids by mistake, but stamped as B's.
    const stolen = await Vehicle.create({ make: "X", regNumber: "STL0001", size: "horse", companyId: String(b._id), tenantId: b._id });
    a.vehicle_ids.push(stolen._id);
    await a.save();
    // Stamped as A's but not on any list yet.
    const mine = await Vehicle.create({ make: "Y", regNumber: "MIN0001", size: "horse", companyId: String(a._id), tenantId: a._id });
    const { token } = await makeUser({ role: "Deliverer Admin", companyId: a._id, email: "tenant@test.com" });

    const denied = await request(app)
      .delete("/api/v2/vehicle/delete-vehicle/" + stolen._id)
      .set("Cookie", cookie(token));
    expect(denied.status).toBe(404);
    expect(await Vehicle.findById(stolen._id)).toBeTruthy();

    const allowed = await request(app)
      .put("/api/v2/vehicle/update-vehicle")
      .set("Cookie", cookie(token))
      .send({ id: mine._id.toString(), make: "Y2", size: "horse", regNumber: "MIN0001" });
    expect(allowed.status).toBe(201);
  });

  test("update-admin: cannot escalate to Super Admin or edit another company's user", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "boss@test.com",
    });
    const { user: other } = await makeUser({
      role: "Deliverer Admin",
      companyId: b._id,
      email: "other@test.com",
    });
    const { user: mine } = await makeUser({
      role: "Contractor Admin",
      companyId: a._id,
      email: "mine@test.com",
    });

    const foreign = await request(app)
      .put("/api/v2/user/update-admin")
      .set("Cookie", cookie(token))
      .send({ adminId: other._id.toString(), name: "x", email: "other@test.com", phoneNumber: "1", city: "c", address: "a", role: "Deliverer Admin" });
    expect(foreign.status).toBe(404);

    const escalate = await request(app)
      .put("/api/v2/user/update-admin")
      .set("Cookie", cookie(token))
      .send({ adminId: mine._id.toString(), name: "x", email: "mine@test.com", phoneNumber: "1", city: "c", address: "a", role: "Super Admin" });
    expect(escalate.status).toBe(403);
    expect((await User.findById(mine._id)).role).toBe("Contractor Admin");
  });

  test("delete-admin: cannot delete another company's user or yourself", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const { user: self, token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "boss2@test.com",
    });
    const { user: other } = await makeUser({
      role: "Deliverer Admin",
      companyId: b._id,
      email: "victim@test.com",
    });

    const foreign = await request(app)
      .delete(`/api/v2/user/delete-admin/${other._id}`)
      .set("Cookie", cookie(token));
    expect(foreign.status).toBe(404);
    expect(await User.findById(other._id)).toBeTruthy();

    const own = await request(app)
      .delete(`/api/v2/user/delete-admin/${self._id}`)
      .set("Cookie", cookie(token));
    expect(own.status).toBe(400);
  });

  test("rebuild-stats is for platform admins only", async () => {
    const a = await makeCompany("A");
    const { token } = await makeUser({
      role: "Deliverer Admin",
      companyId: a._id,
      email: "boss3@test.com",
    });
    const res = await request(app)
      .post("/api/v2/overallStats/rebuild-stats")
      .set("Cookie", cookie(token));
    expect(res.status).toBe(403);
  });

  test("public create-user ignores role and companyId, and the password is never returned", async () => {
    const a = await makeCompany("A");
    const res = await request(app)
      .post("/api/v2/user/create-user")
      .send({
        name: "Mallory",
        email: "mallory@test.com",
        phoneNumber: "1",
        address: "a",
        city: "c",
        password: "password123",
        role: "Super Admin",
        companyId: a._id.toString(),
      });
    // The activation email can't be sent in tests; what matters is that the
    // token the endpoint would mail carries no role or company.
    expect([201, 500]).toContain(res.status);

    const token = jwt.sign(
      { name: "Mallory", email: "mallory@test.com", phoneNumber: "1", address: "a", city: "c", password: "password123", role: "Super Admin", companyId: a._id.toString() },
      process.env.ACTIVATION_SECRET
    );
    const act = await request(app)
      .post("/api/v2/user/activation")
      .send({ activation_token: token });
    expect(act.status).toBe(201);
    expect(act.body.user.password).toBeUndefined();
    const created = await User.findOne({ email: "mallory@test.com" });
    expect(created.role).toBe("deliverer");
    expect(created.companyId).toBeUndefined();
  });

  test("login uses one message for unknown email and wrong password, and returns no hash", async () => {
    const a = await makeCompany("A");
    await makeUser({ role: "Deliverer Admin", companyId: a._id, email: "real@test.com" });

    const unknown = await request(app)
      .post("/api/v2/user/login-user")
      .send({ email: "nobody@test.com", password: "password123" });
    const wrong = await request(app)
      .post("/api/v2/user/login-user")
      .send({ email: "real@test.com", password: "nope-nope" });
    expect(unknown.status).toBe(400);
    expect(wrong.status).toBe(400);
    expect(unknown.body.message).toBe(wrong.body.message);

    const ok = await request(app)
      .post("/api/v2/user/login-user")
      .send({ email: "real@test.com", password: "password123" });
    expect(ok.status).toBe(201);
    expect(ok.body.user.password).toBeUndefined();
  });

  test("a garbage or stale token gets 401, not 500", async () => {
    const res = await request(app)
      .get("/api/v2/user/get-user")
      .set("Cookie", cookie("not-a-real-token"));
    expect(res.status).toBe(401);

    const ghost = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET_KEY);
    const res2 = await request(app)
      .get("/api/v2/user/get-user")
      .set("Cookie", cookie(ghost));
    expect(res2.status).toBe(401);
  });
});
