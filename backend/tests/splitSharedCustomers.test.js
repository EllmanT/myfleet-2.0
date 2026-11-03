const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { splitSharedCustomers } = require("../scripts/splitSharedCustomers");

process.env.NODE_ENV = "test";
jest.setTimeout(120000);

const oid = () => new mongoose.Types.ObjectId();

describe("splitSharedCustomers", () => {
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

  // Two companies that both list one customer; A has 2 jobs with it, B has 1.
  async function sharedFixture({ orphanJob = false } = {}) {
    const shared = oid();
    const other = oid();
    const [aId, bId, vA, vB] = [oid(), oid(), oid(), oid()];
    const contractorB = oid();
    await db.collection("customers").insertMany([
      { _id: shared, name: "Limpopo Retail", phoneNumber: "123", address: "1 Road" },
      { _id: other, name: "Only A Customer" },
    ]);
    await db.collection("contractors").insertOne({ _id: contractorB, companyName: "CB", customers: [shared] });
    await db.collection("vehicles").insertMany([
      { _id: vA, companyId: String(aId) },
      { _id: vB, companyId: String(bId) },
    ]);
    const jobA1 = oid(), jobA2 = oid(), jobB1 = oid();
    await db.collection("jobs").insertMany([
      { _id: jobA1, vehicleId: vA, from: shared, customer: other },
      { _id: jobA2, vehicleId: vA, from: other, customer: shared },
      { _id: jobB1, vehicleId: vB, from: shared, customer: shared },
    ]);
    if (orphanJob) await db.collection("jobs").insertOne({ _id: oid(), from: shared, customer: other }); // no vehicle, no owner
    await db.collection("deliverers").insertMany([
      { _id: aId, companyName: "A", customer_ids: [shared, other], vehicle_ids: [vA], job_ids: [jobA1, jobA2] },
      { _id: bId, companyName: "B", customer_ids: [shared], vehicle_ids: [vB], contractor_ids: [contractorB], job_ids: [jobB1] },
    ]);
    return { shared, other, aId, bId, jobA1, jobA2, jobB1, contractorB };
  }

  test("dry run reports the split and changes nothing", async () => {
    const f = await sharedFixture();
    const report = await splitSharedCustomers(db, { apply: false });
    expect(report.shared).toBe(1);
    expect(report.split[0].keeper).toBe(String(f.aId)); // A uses it more
    expect(report.split[0].clones).toHaveLength(1);
    expect(await db.collection("customers").countDocuments()).toBe(2);
    expect((await db.collection("deliverers").findOne({ _id: f.bId })).customer_ids.map(String)).toEqual([String(f.shared)]);
  });

  test("apply gives B its own copy and repoints only B's references", async () => {
    const f = await sharedFixture();
    const report = await splitSharedCustomers(db, { apply: true });
    expect(report.map).toHaveLength(1);
    const cloneId = report.map[0].new;

    // a real second record exists, owned by B, with the same details
    const clone = await db.collection("customers").findOne({ _id: new mongoose.Types.ObjectId(cloneId) });
    expect(clone).toMatchObject({ name: "Limpopo Retail", phoneNumber: "123", address: "1 Road" });
    expect(String(clone.tenantId)).toBe(String(f.bId));
    // the original stays with A and is stamped
    expect(String((await db.collection("customers").findOne({ _id: f.shared })).tenantId)).toBe(String(f.aId));

    // B's list, contractor and job point at the clone; A's still point at the original
    const b = await db.collection("deliverers").findOne({ _id: f.bId });
    expect(b.customer_ids.map(String)).toEqual([cloneId]);
    expect((await db.collection("contractors").findOne({ _id: f.contractorB })).customers.map(String)).toEqual([cloneId]);
    const jobB = await db.collection("jobs").findOne({ _id: f.jobB1 });
    expect([String(jobB.from), String(jobB.customer)]).toEqual([cloneId, cloneId]);
    const a = await db.collection("deliverers").findOne({ _id: f.aId });
    expect(a.customer_ids.map(String)).toEqual([String(f.shared), String(f.other)]);
    const jobA = await db.collection("jobs").findOne({ _id: f.jobA1 });
    expect(String(jobA.from)).toBe(String(f.shared));

    // nothing was deleted
    expect(await db.collection("customers").countDocuments()).toBe(3);
  });

  test("running it again changes nothing", async () => {
    await sharedFixture();
    await splitSharedCustomers(db, { apply: true });
    const before = await db.collection("customers").countDocuments();
    const again = await splitSharedCustomers(db, { apply: true });
    expect(again.shared).toBe(0);
    expect(await db.collection("customers").countDocuments()).toBe(before);
  });

  test("a shared customer used by a job with no clear owner is left alone and reported", async () => {
    const f = await sharedFixture({ orphanJob: true });
    const report = await splitSharedCustomers(db, { apply: true });
    expect(report.split).toHaveLength(0);
    expect(report.unresolved).toHaveLength(1);
    expect(await db.collection("customers").countDocuments()).toBe(2);
    expect((await db.collection("deliverers").findOne({ _id: f.bId })).customer_ids.map(String)).toEqual([String(f.shared)]);
  });
});
