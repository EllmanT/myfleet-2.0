const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Customer = require("../model/customer");
const { escapeRegex } = require("../utils/escapeRegex");
const { stripOperators } = require("../middleware/security");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
const app = require("../app");

describe("input hardening helpers", () => {
  test("escapeRegex makes search text literal", () => {
    const BS = String.fromCharCode(92);
    expect(escapeRegex("a.b*(c)+")).toBe(
      ["a", BS, ".b", BS, "*", BS, "(c", BS, ")", BS, "+"].join("")
    );
    expect(new RegExp(escapeRegex("(a+)+$")).test("(a+)+$")).toBe(true);
    expect(new RegExp(escapeRegex("a.c")).test("abc")).toBe(false);
  });

  test("stripOperators removes $-keys and dotted keys, recursively", () => {
    const body = {
      email: { $ne: null },
      ok: "x",
      "a.b": 1,
      nested: { $gt: 1, keep: [{ $or: 1, v: 2 }] },
    };
    stripOperators(body);
    expect(body).toEqual({ email: {}, ok: "x", nested: { keep: [{ v: 2 }] } });
  });
});

describe("hardening over HTTP", () => {
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

  test("NoSQL operator in login body cannot bypass the password check", async () => {
    await User.create({
      name: "Real",
      email: "real@test.com",
      password: "password123",
      phoneNumber: "1",
      role: "Deliverer Admin",
      address: "a",
      city: "c",
    });
    const res = await request(app)
      .post("/api/v2/user/login-user")
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("security headers are set", async () => {
    const res = await request(app).get("/test");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("a search with regex metacharacters is treated as plain text", async () => {
    const company = await Deliverer.create({
      companyName: "A",
      address: "a",
      city: "c",
      goodsType: ["g"],
      vehiclesType: ["v"],
      deliveryType: ["d"],
    });
    const cust = await Customer.create({
      name: "Acme (Pty)",
      city: "c",
      address: "a",
      phoneNumber: "1",
    });
    company.customer_ids.push(cust._id);
    await company.save();
    const user = await User.create({
      name: "U",
      email: "u@test.com",
      password: "password123",
      phoneNumber: "1",
      role: "Deliverer Admin",
      address: "a",
      city: "c",
      companyId: company._id,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY);

    const res = await request(app)
      .get("/api/v2/customer/get-all-customers-page")
      .query({ search: "(Pty)" })
      .set("Cookie", ["token=" + token]);
    expect(res.status).toBe(200);
  });
});
