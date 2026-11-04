const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { verifyTenantStamps } = require("../scripts/verifyTenantStamps");
const { backfill } = require("../scripts/backfillTenantId");

process.env.NODE_ENV = "test";
jest.setTimeout(120000);

const oid = () => new mongoose.Types.ObjectId();

describe("verifyTenantStamps", () => {
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

  const find = (report, model) => report.find((r) => r.model === model);

  test("reports unstamped records, and an empty database is clean", async () => {
    expect((await verifyTenantStamps(mongoose)).every((r) => r.unstamped === 0)).toBe(true);

    const company = oid();
    await db.collection("customers").insertMany([
      { name: "stamped", tenantId: company },
      { name: "old record" },
    ]);
    await db.collection("expenses").insertOne({ companyId: null });
    const report = await verifyTenantStamps(mongoose);
    expect(find(report, "Customer")).toMatchObject({ total: 2, unstamped: 1, field: "tenantId" });
    expect(find(report, "Expense")).toMatchObject({ unstamped: 1, field: "companyId" });
  });

  test("passes once the backfill has stamped everything it can claim", async () => {
    const vehicle = oid();
    const company = oid();
    await db.collection("vehicles").insertOne({ _id: vehicle, companyId: String(company) });
    await db.collection("deliverers").insertOne({ _id: company, companyName: "A", vehicle_ids: [vehicle] });
    expect(find(await verifyTenantStamps(mongoose), "Vehicle").unstamped).toBe(1);

    await backfill(db, { apply: true });
    expect(find(await verifyTenantStamps(mongoose), "Vehicle").unstamped).toBe(0);
  });
});
