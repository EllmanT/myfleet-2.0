/*
 * Vehicle and employee expenses (the older per-truck / per-driver cost screens) and the
 * statistics they feed. Totals must add up, deleting an expense must take it back out of the
 * totals, and nobody can reach another company's expenses.
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
const VehicleExpense = require("../model/vehicleExpense");
const OverallStats = require("../model/overallStats");
const VehicleStats = require("../model/vehicleStats");
const { seedAuthFixture, buildJobPayload } = require("./helpers/seedStatsFixtures");

jest.setTimeout(120000);
const num = (v) => parseFloat(v.toString());

describe("vehicle expenses and the statistics they feed", () => {
  let mongod;
  let fx;
  let ck;

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
    fx = await seedAuthFixture();
    ck = [`token=${fx.token}`];
    // a job in January 2026 creates the year's statistics rows
    const res = await request(app)
      .post("/api/v2/job/create-job")
      .set("Cookie", ck)
      .send([
        buildJobPayload({
          from: fx.fromCustomer._id,
          customer: fx.toCustomer._id,
          contractorId: fx.contractorA._id,
          vehicleId: fx.vehicleA._id,
          driverId: fx.driverA._id,
          cost: 500,
        }),
      ]);
    expect(res.status).toBe(201);
  });

  const addExpense = (cost, date = "2026-01-15") =>
    request(app)
      .post("/api/v2/expenses/vehicle/create-vehicle-expense")
      .set("Cookie", ck)
      .field("vehicleId", String(fx.vehicleA._id))
      .field("cost", String(cost))
      .field("description", "Tyres")
      .field("date", date);
  const stats = async () => {
    const o = await OverallStats.findOne({ companyId: String(fx.deliverer._id), year: 2026 });
    const v = await VehicleStats.findOne({ vehicleId: String(fx.vehicleA._id), year: 2026 });
    const jan = (d) => d.monthlyData.find((m) => m.month === "January");
    return {
      oExp: num(o.yearlyExpenses),
      oProfit: num(o.yearlyProfit),
      oJanExp: num(jan(o).totalExpenses),
      vExp: num(v.yearlyExpenses),
      vProfit: num(v.yearlyProfit),
      vJanExp: num(jan(v).totalExpenses),
    };
  };

  test("an expense is added to the yearly and monthly totals (numeric addition, not string joining)", async () => {
    const before = await stats();
    expect((await addExpense(50)).status).toBe(200);
    expect((await addExpense(25.5)).status).toBe(200);
    const after = await stats();
    expect(after.oExp - before.oExp).toBeCloseTo(75.5, 2);
    expect(after.vExp - before.vExp).toBeCloseTo(75.5, 2);
    expect(after.oJanExp - before.oJanExp).toBeCloseTo(75.5, 2);
    expect(after.vJanExp - before.vJanExp).toBeCloseTo(75.5, 2);
    expect(before.oProfit - after.oProfit).toBeCloseTo(75.5, 2);
    expect(before.vProfit - after.vProfit).toBeCloseTo(75.5, 2);
  });

  test("deleting an expense removes it from the totals again", async () => {
    const before = await stats();
    const created = await addExpense(40);
    expect(created.status).toBe(200);
    const doc = await VehicleExpense.findOne({ vehicleId: String(fx.vehicleA._id) });
    const expenseId = doc.expenseData[0]._id;
    const del = await request(app).delete(`/api/v2/expenses/vehicle/delete-vehicle-expense/${expenseId}`).set("Cookie", ck);
    expect(del.status).toBe(200);
    expect((await VehicleExpense.findOne({ vehicleId: String(fx.vehicleA._id) })).expenseData).toHaveLength(0);
    const after = await stats();
    expect(after.oExp).toBeCloseTo(before.oExp, 2);
    expect(after.vExp).toBeCloseTo(before.vExp, 2);
    expect(after.oJanExp).toBeCloseTo(before.oJanExp, 2);
    expect(after.vJanExp).toBeCloseTo(before.vJanExp, 2);
    expect(after.oProfit).toBeCloseTo(before.oProfit, 2);
    expect(after.vProfit).toBeCloseTo(before.vProfit, 2);
  });

  test("another company cannot add to, list or delete this company's vehicle expenses", async () => {
    expect((await addExpense(40)).status).toBe(200);
    const doc = await VehicleExpense.findOne({ vehicleId: String(fx.vehicleA._id) });
    const expenseId = doc.expenseData[0]._id;

    const other = await Deliverer.create({ companyName: "Other", address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"] });
    const u = await User.create({ name: "O", email: "o@x.test", password: "password123", phoneNumber: "5", role: "Deliverer Admin", address: "S", city: "H", companyId: other._id });
    const oc = ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];

    const before = await stats();
    expect((await request(app).delete(`/api/v2/expenses/vehicle/delete-vehicle-expense/${expenseId}`).set("Cookie", oc)).status).toBe(404);
    expect((await request(app).get(`/api/v2/expenses/vehicle/get-vehicle-expenses/${fx.vehicleA._id}`).set("Cookie", oc)).status).toBe(404);
    const add = await request(app)
      .post("/api/v2/expenses/vehicle/create-vehicle-expense")
      .set("Cookie", oc)
      .field("vehicleId", String(fx.vehicleA._id))
      .field("cost", "999")
      .field("description", "Injected")
      .field("date", "2026-01-15");
    expect(add.status).toBe(404);
    expect(await stats()).toEqual(before);
    expect((await VehicleExpense.findOne({ vehicleId: String(fx.vehicleA._id) })).expenseData).toHaveLength(1);
  });
});
