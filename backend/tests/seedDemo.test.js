const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Job = require("../model/job");
const Trip = require("../model/trip");
const Invoice = require("../model/invoice");
const Payment = require("../model/payment");
const Vehicle = require("../model/vehicle");
const { seedDemo, deleteDemo } = require("../scripts/seedDemoTenant");
const { paymentState } = require("../utils/invoiceMath");

const TODAY = new Date("2026-11-03T00:00:00Z");

jest.setTimeout(120000);

describe("seedDemoTenant", () => {
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

  test("builds a believable company with every kind of data", async () => {
    const out = await seedDemo(mongoose, { today: TODAY, seed: 7 });
    expect(out.counts.vehicles).toBe(3);
    expect(out.counts.trips).toBe(14);
    expect(out.counts.jobLegs).toBeGreaterThan(80);
    expect(out.counts.invoices).toBeGreaterThanOrEqual(5);
    expect(await Job.countDocuments({ tenantId: out.tenantId })).toBe(out.counts.jobLegs);

    const company = await Deliverer.findById(out.tenantId);
    expect(company.isDemo).toBe(true);
    expect(company.job_ids.length).toBe(out.counts.jobLegs);

    // a spread of invoice states for screenshots: paid, part paid, overdue and not yet due
    const states = (await Invoice.find({ tenantId: out.tenantId })).map((i) => paymentState(i, TODAY));
    expect(new Set(states.map((s) => s.paymentStatus))).toEqual(new Set(["paid", "partial", "unpaid"]));
    expect(states.some((s) => s.overdue)).toBe(true);
    expect(states.some((s) => s.paymentStatus === "unpaid" && !s.overdue)).toBe(true);
    expect(await Payment.countDocuments({ tenantId: out.tenantId })).toBeGreaterThan(2);
    expect((await Trip.find({ tenantId: out.tenantId, invoiceId: { $exists: false } })).length).toBeGreaterThan(0); // unbilled work to show
  });

  test("is repeatable: same seed and date give the same data, and re-running replaces it", async () => {
    const a = await seedDemo(mongoose, { today: TODAY, seed: 7 });
    const sums = async (t) => ({
      legs: await Job.countDocuments({ tenantId: t }),
      value: (await Trip.find({ tenantId: t })).reduce((s, x) => s + x.price, 0),
    });
    const first = await sums(a.tenantId);
    const b = await seedDemo(mongoose, { today: TODAY, seed: 7 });
    expect(await Deliverer.countDocuments({ isDemo: true })).toBe(1);
    expect(await sums(b.tenantId)).toEqual(first);
  });

  test("reset removes only the demo company and never touches a real one", async () => {
    const real = await Deliverer.create({ companyName: "Real Haulage", address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"] });
    await User.create({ name: "R", email: "r@real.com", password: "password123", phoneNumber: "1", role: "Deliverer Admin", address: "a", city: "c", companyId: real._id });
    await Vehicle.create({ make: "X", regNumber: "REA 0001", size: "horse", companyId: String(real._id), tenantId: real._id });

    await seedDemo(mongoose, { today: TODAY, seed: 7 });
    const res = await deleteDemo(mongoose);
    expect(res.companies).toBe(1);

    expect(await Deliverer.countDocuments({ isDemo: true })).toBe(0);
    expect(await Job.countDocuments()).toBe(0);
    expect(await Trip.countDocuments()).toBe(0);
    expect(await Invoice.countDocuments()).toBe(0);
    // the real company, its user and its truck are intact
    expect(await Deliverer.findById(real._id)).toBeTruthy();
    expect(await User.countDocuments({ companyId: real._id })).toBe(1);
    expect(await Vehicle.countDocuments({ tenantId: real._id })).toBe(1);
    expect(await User.countDocuments({ email: "demo@myfleet.app" })).toBe(0);
  });
});
