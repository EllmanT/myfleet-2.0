const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { backfill } = require("../scripts/backfillTenantId");

const oid = () => new mongoose.Types.ObjectId();

describe("backfillTenantId", () => {
  let mongod;
  let db;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    db = mongoose.connection.db;
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await db.dropDatabase();
  });

  async function seed() {
    const [a, b] = [oid(), oid()];
    const [custA, custB, custShared] = [oid(), oid(), oid()];
    const [vehA, vehB] = [oid(), oid()];
    const [jobListed, jobViaVehicle] = [oid(), oid()];
    await db.collection("deliverers").insertMany([
      { _id: a, companyName: "A", customer_ids: [custA, custShared], vehicle_ids: [vehA], job_ids: [jobListed], driver_ids: [], contractor_ids: [] },
      { _id: b, companyName: "B", customer_ids: [custB, custShared], vehicle_ids: [vehB], job_ids: [], driver_ids: [], contractor_ids: [] },
    ]);
    await db.collection("customers").insertMany([
      { _id: custA, name: "A cust" }, { _id: custB, name: "B cust" }, { _id: custShared, name: "Shared" }, { _id: oid(), name: "Orphan" },
    ]);
    await db.collection("vehicles").insertMany([
      { _id: vehA, regNumber: "AAA1111", companyId: String(a) },
      { _id: vehB, regNumber: "BBB2222", companyId: String(b) },
    ]);
    await db.collection("jobs").insertMany([
      { _id: jobListed, vehicleId: vehA },
      { _id: jobViaVehicle, vehicleId: vehB },
    ]);
    await db.collection("vehiclestats").insertOne({ vehicleId: String(vehA), year: 2026 });
    return { a, b, custA, custB, custShared, vehA, vehB, jobListed, jobViaVehicle };
  }

  test("dry run reports but writes nothing", async () => {
    await seed();
    const report = await backfill(db, { apply: false });
    expect(report.collections.customers.wouldStamp).toBe(2);
    expect(await db.collection("customers").countDocuments({ tenantId: { $exists: true } })).toBe(0);
  });

  test("apply stamps by ownership, leaves conflicts and orphans alone", async () => {
    const s = await seed();
    const report = await backfill(db, { apply: true });

    const cust = async (id) => (await db.collection("customers").findOne({ _id: id })).tenantId;
    expect(String(await cust(s.custA))).toBe(String(s.a));
    expect(String(await cust(s.custB))).toBe(String(s.b));
    // claimed by both companies -> not stamped, and reported
    expect(await cust(s.custShared)).toBeUndefined();
    expect(report.conflicts.map((c) => c.id)).toContain(String(s.custShared));

    const veh = await db.collection("vehicles").findOne({ _id: s.vehB });
    expect(String(veh.tenantId)).toBe(String(s.b));

    // a job not on any list is owned through its vehicle
    const viaVehicle = await db.collection("jobs").findOne({ _id: s.jobViaVehicle });
    expect(String(viaVehicle.tenantId)).toBe(String(s.b));

    const stat = await db.collection("vehiclestats").findOne({});
    expect(String(stat.tenantId)).toBe(String(s.a));
    expect(report.orphans.customers).toBe(2); // shared + the unowned one
  });

  test("is idempotent and never overwrites an existing tenantId", async () => {
    const s = await seed();
    const other = oid();
    await db.collection("customers").updateOne({ _id: s.custA }, { $set: { tenantId: other } });
    await backfill(db, { apply: true });
    const second = await backfill(db, { apply: true });
    expect(String((await db.collection("customers").findOne({ _id: s.custA })).tenantId)).toBe(String(other));
    expect(second.collections.customers.stamped).toBe(0);
  });
});
