/*
 * Regression tests for list pagination (page/pageSize arrive as strings) and for deleting an
 * admin from outside the admin's company.
 */
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const app = require("../app");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Driver = require("../model/driver");
const Vehicle = require("../model/vehicle");

jest.setTimeout(120000);

describe("pagination and admin deletion", () => {
  let mongod;
  const company = (extra = {}) =>
    Deliverer.create({ companyName: "Co" + Math.random(), address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"], ...extra });
  const mkUser = (companyId, role, email = `${Math.random()}@x.test`) =>
    User.create({ name: "P " + email, email, password: "password123", phoneNumber: "5", role, address: "S", city: "H", companyId });
  const cookieOf = (u) => ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];

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
  });

  test("driver list pages are exactly pageSize long (1-based page)", async () => {
    const c = await company();
    const drivers = await Driver.create(
      Array.from({ length: 45 }, (_, i) => ({
        name: `Driver ${String(i).padStart(2, "0")}`,
        phoneNumber: "1",
        address: "a",
        city: "H",
        idNumber: `ID-${i}`,
        id: `f${i}`,
        companyId: String(c._id),
        tenantId: c._id,
      }))
    );
    await Deliverer.updateOne({ _id: c._id }, { driver_ids: drivers.map((d) => d._id) });
    const ck = cookieOf(await mkUser(c._id, "Deliverer Admin"));
    const sizes = [];
    const names = new Set();
    for (const page of [1, 2, 3]) {
      const res = await request(app).get(`/api/v2/driver/get-all-drivers-page?page=${page}&pageSize=20&sort=${encodeURIComponent(JSON.stringify({ field: "name", sort: "asc" }))}`).set("Cookie", ck);
      expect(res.status).toBe(200);
      expect(res.body.totalCount).toBe(45);
      sizes.push(res.body.pageDrivers.length);
      res.body.pageDrivers.forEach((d) => names.add(d.name));
    }
    expect(sizes).toEqual([20, 20, 5]);
    expect(names.size).toBe(45); // no row repeated across pages
  });

  test("vehicle list pages are exactly pageSize long", async () => {
    const c = await company();
    const vehicles = await Vehicle.create(
      Array.from({ length: 45 }, (_, i) => ({ make: "Isuzu", size: "small", regNumber: `REG-${String(i).padStart(2, "0")}`, companyId: String(c._id), tenantId: c._id }))
    );
    await Deliverer.updateOne({ _id: c._id }, { vehicle_ids: vehicles.map((v) => v._id) });
    const ck = cookieOf(await mkUser(c._id, "Deliverer Admin"));
    const sort = encodeURIComponent(JSON.stringify({ field: "regNumber", sort: "asc" }));
    const sizes = [];
    for (const page of [1, 2, 3]) {
      const res = await request(app).get(`/api/v2/vehicle/get-all-vehicles-page?page=${page}&pageSize=20&sort=${sort}`).set("Cookie", ck);
      expect(res.status).toBe(200);
      sizes.push((res.body.pageVehicles || res.body.vehicles || []).length);
    }
    expect(sizes).toEqual([20, 20, 5]);
  });

  test("admin list pages are exactly pageSize long (0-based page)", async () => {
    const c = await company();
    const owner = await mkUser(c._id, "Deliverer Admin");
    const others = [];
    for (let i = 0; i < 6; i++) others.push(await mkUser(c._id, "Deliverer Manager"));
    await Deliverer.updateOne({ _id: c._id }, { admin_ids: [owner._id, ...others.map((o) => o._id)] });
    const ck = cookieOf(owner);
    const sizes = [];
    for (const page of [0, 1, 2]) {
      const res = await request(app).get(`/api/v2/user/get-all-admins-page?page=${page}&pageSize=3`).set("Cookie", ck);
      expect(res.status).toBe(200);
      sizes.push(res.body.pageAdmins ? res.body.pageAdmins.length : 0);
    }
    expect(sizes).toEqual([3, 3, 1]);
  });

  test("a platform admin with no company can delete a company's admin, and that company's list is cleaned", async () => {
    const c = await company();
    const owner = await mkUser(c._id, "Deliverer Admin");
    const victim = await mkUser(c._id, "Deliverer Manager");
    await Deliverer.updateOne({ _id: c._id }, { admin_ids: [owner._id, victim._id] });
    const platform = cookieOf(await mkUser(undefined, "Super Admin"));
    const res = await request(app).delete(`/api/v2/user/delete-admin/${victim._id}`).set("Cookie", platform);
    expect(res.status).toBe(201);
    expect(await User.findById(victim._id)).toBeNull();
    const after = await Deliverer.findById(c._id).lean();
    expect(after.admin_ids.map(String)).toEqual([String(owner._id)]);
  });

  test("a platform admin who has a company of their own cleans the TARGET company's list, not their own", async () => {
    const mine = await company();
    const theirs = await company();
    const platformUser = await mkUser(mine._id, "Super Admin");
    const owner = await mkUser(theirs._id, "Deliverer Admin");
    const victim = await mkUser(theirs._id, "Deliverer Manager");
    await Deliverer.updateOne({ _id: theirs._id }, { admin_ids: [owner._id, victim._id] });
    await Deliverer.updateOne({ _id: mine._id }, { admin_ids: [platformUser._id, victim._id] }); // stray id in the wrong list
    const res = await request(app).delete(`/api/v2/user/delete-admin/${victim._id}`).set("Cookie", cookieOf(platformUser));
    expect(res.status).toBe(201);
    expect((await Deliverer.findById(theirs._id).lean()).admin_ids.map(String)).toEqual([String(owner._id)]);
  });

  test("a company admin still cannot delete another company's user", async () => {
    const a = await company();
    const b = await company();
    const aOwner = await mkUser(a._id, "Deliverer Admin");
    const bUser = await mkUser(b._id, "Deliverer Manager");
    const res = await request(app).delete(`/api/v2/user/delete-admin/${bUser._id}`).set("Cookie", cookieOf(aOwner));
    expect(res.status).toBe(404);
    expect(await User.findById(bUser._id)).toBeTruthy();
  });
});
