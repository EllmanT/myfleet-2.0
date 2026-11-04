const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

// The guard must be installed before any model is compiled.
const guard = require("../services/tenantGuard");
guard.install();
const { runAsTenant, runUnscoped } = require("../services/tenantContext");

const Job = require("../model/job");
const Customer = require("../model/customer");
const VehicleExpense = require("../model/vehicleExpense");
const OverallStats = require("../model/overallStats");
const Rate = require("../model/rate");
const ContractorStats = require("../model/contractorStats");

jest.setTimeout(120000);

const oid = () => new mongoose.Types.ObjectId();

describe("tenant guard", () => {
  let mongod;
  const A = oid();
  const B = oid();

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
    guard.resetViolations();
    process.env.TENANT_GUARD = "off";
    // raw inserts bypass Mongoose, so the guard never sees the setup
    await Customer.collection.insertMany([
      { _id: oid(), name: "A1", tenantId: A },
      { _id: oid(), name: "A2", tenantId: A },
      { _id: oid(), name: "B1", tenantId: B },
    ]);
    await VehicleExpense.collection.insertMany([
      { vehicleId: "v1", companyId: String(A), expenseData: [] },
      { vehicleId: "v2", companyId: String(B), expenseData: [] },
    ]);
    await OverallStats.collection.insertMany([
      { companyId: A, year: 2026 },
      { companyId: B, year: 2026 },
    ]);
  });
  afterAll(() => {
    delete process.env.TENANT_GUARD;
  });

  describe("log mode", () => {
    beforeEach(() => {
      process.env.TENANT_GUARD = "log";
    });

    test("records a query that does not name the company, and changes nothing", async () => {
      const found = await runAsTenant(A, () => Customer.find({}), "GET /customers");
      expect(found).toHaveLength(3); // log mode never filters
      expect(guard.getViolations()).toEqual([
        expect.objectContaining({ kind: "unscoped", model: "Customer", op: "find", route: "GET /customers" }),
      ]);
    });

    test("a query that names the company is fine, a by-id lookup is reported separately", async () => {
      await runAsTenant(A, async () => {
        await Customer.find({ tenantId: A });
        await Customer.find({ $or: [{ tenantId: A }, { _id: { $in: [oid()] } }] });
        await Customer.findById(oid());
      });
      expect(guard.getViolations().map((v) => v.kind)).toEqual(["by-id"]);
    });

    test("aggregates and saves are reported too", async () => {
      await runAsTenant(A, async () => {
        await Customer.aggregate([{ $match: { name: "A1" } }]);
        await Customer.aggregate([{ $match: { tenantId: A } }]); // fine
        await new Customer({ name: "Unstamped" }).save();
      });
      const kinds = guard.getViolations().map((v) => `${v.kind}:${v.op}`).sort();
      expect(kinds).toEqual(["unscoped:aggregate", "unstamped-save:save"]);
    });

    test("platform admins, scripts and unscoped tasks are never reported", async () => {
      await Customer.find({}); // outside any request
      await runUnscoped(() => Customer.find({}));
      expect(guard.getViolations()).toEqual([]);
    });

    test("collections the guard does not cover are ignored", async () => {
      const Deliverer = require("../model/deliverer");
      await runAsTenant(A, () => Deliverer.find({}));
      expect(guard.getViolations()).toEqual([]);
    });
  });

  describe("enforce mode", () => {
    beforeEach(() => {
      process.env.TENANT_GUARD = "enforce";
    });

    test("a forgotten filter returns only the caller's rows", async () => {
      const mine = await runAsTenant(A, () => Customer.find({}));
      expect(mine.map((c) => c.name).sort()).toEqual(["A1", "A2"]);
      expect(await runAsTenant(A, () => Customer.countDocuments({}))).toBe(2);
      expect(await runAsTenant(A, () => Customer.findOne({ name: "B1" }))).toBeNull();
    });

    test("asking for another company's rows by id or by tenantId returns nothing", async () => {
      const b1 = await Customer.collection.findOne({ name: "B1" });
      expect(await runAsTenant(A, () => Customer.findById(b1._id))).toBeNull();
      expect(await runAsTenant(A, () => Customer.find({ tenantId: B }))).toHaveLength(0);
    });

    test("updates and deletes only reach the caller's rows", async () => {
      await runAsTenant(A, () => Customer.updateMany({}, { $set: { city: "Changed" } }));
      expect(await Customer.collection.countDocuments({ city: "Changed" })).toBe(2);
      expect((await Customer.collection.findOne({ name: "B1" })).city).toBeUndefined();

      await runAsTenant(A, () => Customer.deleteMany({}));
      expect(await Customer.collection.countDocuments({})).toBe(1); // only B1 is left
    });

    test("works for models whose owner field is a string companyId", async () => {
      const rows = await runAsTenant(A, () => VehicleExpense.find({}));
      expect(rows.map((r) => r.vehicleId)).toEqual(["v1"]);
    });

    test("works for models whose owner field is an ObjectId companyId", async () => {
      const rows = await runAsTenant(B, () => OverallStats.find({}));
      expect(rows).toHaveLength(1);
      expect(String(rows[0].companyId)).toBe(String(B));
    });

    test("aggregates get the company added in front", async () => {
      const out = await runAsTenant(A, () => Customer.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]));
      expect(out[0].n).toBe(2);
      const stats = await runAsTenant(B, () => OverallStats.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]));
      expect(stats[0].n).toBe(1);
    });

    test("saves are stamped, and a save for another company is refused", async () => {
      const saved = await runAsTenant(A, () => new Customer({ name: "New" }).save());
      expect(String(saved.tenantId)).toBe(String(A));
      await expect(runAsTenant(A, () => new Customer({ name: "Sneaky", tenantId: B }).save())).rejects.toThrow(
        /different company/
      );
      expect(await Customer.collection.countDocuments({ name: "Sneaky" })).toBe(0);
    });

    test("a signed-in user with no company sees nothing", async () => {
      expect(await runAsTenant(null, () => Customer.find({}))).toHaveLength(0);
      await expect(runAsTenant(null, () => new Customer({ name: "X" }).save())).rejects.toThrow(/no company/);
    });

    test("platform admins, scripts and unscoped tasks still see everything", async () => {
      expect(await Customer.find({})).toHaveLength(3);
      expect(await runUnscoped(() => Customer.find({}))).toHaveLength(3);
    });
  });

  test("off mode changes nothing even inside a request", async () => {
    process.env.TENANT_GUARD = "off";
    expect(await runAsTenant(A, () => Customer.find({}))).toHaveLength(3);
    expect(guard.getViolations()).toEqual([]);
  });

  test("jobs use the same guard", async () => {
    process.env.TENANT_GUARD = "enforce";
    await Job.collection.insertMany([
      { _id: oid(), tenantId: A, jobNumber: "J1" },
      { _id: oid(), tenantId: B, jobNumber: "J2" },
    ]);
    const rows = await runAsTenant(A, () => Job.find({}));
    expect(rows.map((j) => j.jobNumber)).toEqual(["J1"]);
  });

  describe("rates and contractor statistics", () => {
    beforeEach(async () => {
      await Rate.collection.insertMany([
        { contractor: oid(), deliverer: A, rateTypes: [] },
        { contractor: oid(), deliverer: B, rateTypes: [] },
      ]);
      await ContractorStats.collection.insertMany([
        { contractorId: "c1", delivererId: String(A), year: 2026 },
        { contractorId: "c2", delivererId: String(B), year: 2026 },
      ]);
    });

    test("enforce: a query that forgets the company only sees its own", async () => {
      process.env.TENANT_GUARD = "enforce";
      const rates = await runAsTenant(A, () => Rate.find({}).lean());
      const stats = await runAsTenant(A, () => ContractorStats.find({}).lean());
      expect(rates).toHaveLength(1);
      expect(String(rates[0].deliverer)).toBe(String(A));
      expect(stats.map((s) => s.contractorId)).toEqual(["c1"]);
    });

    test("log: the forgotten filter is reported, nothing is changed", async () => {
      process.env.TENANT_GUARD = "log";
      const rates = await runAsTenant(A, () => Rate.find({}).lean());
      expect(rates).toHaveLength(2);
      expect(guard.getViolations()).toEqual([expect.objectContaining({ kind: "unscoped", model: "rate", op: "find" })]);
    });
  });
});
