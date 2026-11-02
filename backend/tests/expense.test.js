const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Vehicle = require("../model/vehicle");
const Job = require("../model/job");
const Expense = require("../model/expense");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
const app = require("../app");

const oid = () => new mongoose.Types.ObjectId();

async function setup(role = "Deliverer Admin") {
  const company = await Deliverer.create({
    companyName: "Co",
    address: "A",
    city: "Harare",
    goodsType: ["g"],
    vehiclesType: ["v"],
    deliveryType: ["d"],
  });
  const user = await User.create({
    name: "U",
    email: `${role.replace(/\s/g, "")}@t.com`,
    password: "password123",
    phoneNumber: "1",
    role,
    address: "A",
    city: "Harare",
    companyId: company._id,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });
  const vehicle = await Vehicle.create({
    make: "DAF",
    regNumber: "AFE5848",
    size: "mediumVehicle",
    companyId: String(company._id),
  });
  return { company, user, token, vehicle };
}

const post = (token, body) =>
  request(app).post("/api/v2/expense/create-expense").set("Cookie", [`token=${token}`]).send(body);

describe("expense API", () => {
  let mongod;
  // Set EXPENSE_TEST_URI to a throwaway local database when the in-memory server cannot start.
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

  test("non-admin roles cannot read or write finance data", async () => {
    const { token } = await setup("Contractor Admin");
    expect((await post(token, { category: "fuel", date: "2026-03-01", amount: 10 })).status).toBe(403);
    const res = await request(app).get("/api/v2/expense/get-expenses").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(403);
  });

  test("rejects bad amount, bad category and a vehicle from another company", async () => {
    const { token } = await setup();
    expect((await post(token, { category: "fuel", date: "2026-03-01", amount: -5 })).status).toBe(400);
    expect((await post(token, { category: "nonsense", date: "2026-03-01", amount: 5 })).status).toBe(400);
    expect((await post(token, { category: "fuel", date: "2026-03-01", amount: 5, vehicleId: oid().toString() })).status).toBe(404);
  });

  test("profitability: revenue minus counted expenses; private fuel excluded; retained salary tracked", async () => {
    const { token, vehicle, company } = await setup();
    await Job.create({
      jobNumber: "J1", from: oid(), customer: oid(), distance: 20, cost: "100.00",
      mileageOut: "1", mileageIn: "21", orderDate: new Date("2026-03-05"), description: "d",
      deliveryType: "local", contractorId: oid(), vehicleId: vehicle._id, driverId: oid(),
    });
    await post(token, { category: "fuel", date: "2026-03-10", amount: 30, vehicleId: vehicle._id, litres: 15 });
    await post(token, { category: "driver_salary", date: "2026-03-31", amount: 20, payee: "Chris" });
    await post(token, { category: "family_salary", date: "2026-03-31", amount: 10, payee: "Father", retainedInBusiness: true });
    await post(token, { category: "private_fuel", date: "2026-03-12", amount: 99, vehicleId: vehicle._id, litres: 50 });
    await post(token, { type: "income", category: "cash_hire", date: "2026-03-15", amount: 25 });

    const res = await request(app).get("/api/v2/expense/profitability?year=2026").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(200);
    const m = res.body.months[2];
    expect(m.jobRevenue).toBe(100);
    expect(m.otherIncome).toBe(25);
    expect(m.totalExpenses).toBe(60); // 30 + 20 + 10, private fuel not counted
    expect(m.profit).toBe(65); // 125 - 60
    expect(m.cashProfit).toBe(75); // father's 10 stays in the business
    expect(m.privateFuel).toBe(99);
    expect(res.body.vehicles[0].expenses.fuel).toBe(30);
    expect(String(company._id)).toBeTruthy();
  });

  test("private fuel is never counted even if the client asks for it", async () => {
    const { token } = await setup();
    const res = await post(token, { category: "private_fuel", date: "2026-03-12", amount: 10, countsInProfit: true });
    expect(res.status).toBe(201);
    expect(res.body.expense.countsInProfit).toBe(false);
    expect(await Expense.countDocuments({ countsInProfit: false })).toBe(1);
  });

  test("an expense in another company is invisible and cannot be deleted", async () => {
    const a = await setup();
    const created = await post(a.token, { category: "other", date: "2026-03-01", amount: 5 });
    await mongoose.connection.db.collection("users").deleteMany({});
    const b = await setup("Super Admin");
    const del = await request(app)
      .delete(`/api/v2/expense/delete-expense/${created.body.expense._id}`)
      .set("Cookie", [`token=${b.token}`]);
    expect(del.status).toBe(404);
  });
});
