const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Vehicle = require("../model/vehicle");
const Expense = require("../model/expense");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
const app = require("../app");

async function setup(role = "Deliverer Admin") {
  const company = await Deliverer.create({
    companyName: "Co", address: "A", city: "Harare", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"],
  });
  const user = await User.create({
    name: "U", email: `${role.replace(/\s/g, "")}${Math.random()}@t.com`, password: "password123",
    phoneNumber: "1", role, address: "A", city: "Harare", companyId: company._id,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });
  const vehicle = await Vehicle.create({ make: "Toyota Dyna", regNumber: "AFO0724", size: "smallVehicle", companyId: String(company._id) });
  return { company, user, token, vehicle };
}

const fillBody = (vehicle, day, odometer, litres, extra = {}) => ({
  vehicleId: vehicle._id.toString(),
  driverName: "Chris",
  filledAt: `2026-09-${day}T08:00:00Z`,
  odometer,
  litres,
  amount: litres * 1.95,
  fullTank: true,
  photoPosted: true,
  ...extra,
});
const post = (token, body) => request(app).post("/api/v2/fuel/create-fill").set("Cookie", [`token=${token}`]).send(body);
const get = (token, url) => request(app).get(url).set("Cookie", [`token=${token}`]);

describe("fuel log API", () => {
  let mongod;
  beforeAll(async () => {
    if (process.env.EXPENSE_TEST_URI) {
      await mongoose.connect(process.env.EXPENSE_TEST_URI);
    } else {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
    }
  });
  afterAll(async () => {
    if (process.env.EXPENSE_TEST_URI) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  test("non-admin roles are refused", async () => {
    const { token, vehicle } = await setup("Contractor Admin");
    expect((await post(token, fillBody(vehicle, "01", 1000, 20))).status).toBe(403);
    expect((await get(token, "/api/v2/fuel/weekly")).status).toBe(403);
  });

  test("rejects a bad odometer or a truck from another company", async () => {
    const { token, vehicle } = await setup();
    expect((await post(token, fillBody(vehicle, "01", -5, 20))).status).toBe(400);
    expect((await post(token, { ...fillBody(vehicle, "01", 1000, 20), vehicleId: new mongoose.Types.ObjectId().toString() })).status).toBe(404);
  });

  test("weekly check measures km per litre and writes the WhatsApp text", async () => {
    const { token, vehicle } = await setup();
    await post(token, fillBody(vehicle, "06", 1000, 30));
    await post(token, fillBody(vehicle, "13", 1096, 10)); // 9.6 km/L = normal for a Dyna
    const res = await get(token, "/api/v2/fuel/weekly?date=2026-09-10");
    expect(res.status).toBe(200);
    const v = res.body.vehicles[0];
    expect(v.kmpl).toBe(9.6);
    expect(v.status).toBe("ok");
    expect(res.body.text).toMatch(/Toyota Dyna AFO0724: 10 L/);
  });

  test("a big overuse is marked REVIEW", async () => {
    const { token, vehicle } = await setup();
    await post(token, fillBody(vehicle, "06", 1000, 30));
    await post(token, fillBody(vehicle, "13", 1100, 25)); // 4 km/L
    const res = await get(token, "/api/v2/fuel/weekly?date=2026-09-10");
    expect(res.body.vehicles[0].status).toBe("review");
  });

  test("real fill-ups replace the estimated fuel for that truck and month in profit", async () => {
    const { token, vehicle, company } = await setup();
    await Expense.create({
      companyId: company._id, type: "expense", date: new Date("2026-09-30"), category: "fuel",
      amount: 500, vehicleId: vehicle._id, isEstimate: true,
    });
    await Expense.create({
      companyId: company._id, type: "expense", date: new Date("2026-08-31"), category: "fuel",
      amount: 300, vehicleId: vehicle._id, isEstimate: true,
    });
    await post(token, fillBody(vehicle, "06", 1000, 20)); // amount 39
    await post(token, fillBody(vehicle, "07", 1010, 10, { purpose: "private" })); // 19.5 private
    const res = await get(token, "/api/v2/expense/profitability?year=2026");
    expect(res.status).toBe(200);
    const sep = res.body.months[8];
    expect(sep.expenses.fuel).toBeCloseTo(39); // estimate of 500 ignored
    expect(sep.privateFuel).toBeCloseTo(19.5);
    expect(res.body.months[7].expenses.fuel).toBe(300); // August has no fills, keeps its estimate
  });
});
