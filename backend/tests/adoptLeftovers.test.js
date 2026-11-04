const { MongoClient, ObjectId } = require("mongodb");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { adoptLeftovers } = require("../scripts/backfillTenantId");

jest.setTimeout(120000);

describe("adopting leftover records into the only company", () => {
  let mongod;
  let client;
  let db;
  const company = new ObjectId();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("t");
  }, 60000);
  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });
  beforeEach(async () => {
    await db.dropDatabase();
    await db.collection("deliverers").insertOne({ _id: company, companyName: "Only Co" });
    await db.collection("customers").insertMany([{ name: "orphan" }, { name: "owned", tenantId: company }]);
    await db.collection("vehiclestats").insertOne({ vehicleId: "gone", year: 2023 });
    await db.collection("contractorstats").insertMany([
      { contractorId: "c1", delivererId: "", year: 2023 },
      { contractorId: "c2", delivererId: "someone", year: 2023 },
    ]);
  });

  test("a dry run counts and changes nothing", async () => {
    const r = await adoptLeftovers(db, String(company), { apply: false });
    expect(r.customers).toBe(1);
    expect(r.vehiclestats).toBe(1);
    expect(r.contractorstats).toBe(1);
    expect(await db.collection("customers").countDocuments({ tenantId: { $exists: false } })).toBe(1);
  });

  test("applying stamps only the unowned ones and never overwrites an owner", async () => {
    await adoptLeftovers(db, String(company), { apply: true });
    expect(await db.collection("customers").countDocuments({ tenantId: company })).toBe(2);
    expect((await db.collection("vehiclestats").findOne({})).tenantId).toEqual(company);
    expect((await db.collection("contractorstats").findOne({ contractorId: "c1" })).delivererId).toBe(String(company));
    expect((await db.collection("contractorstats").findOne({ contractorId: "c2" })).delivererId).toBe("someone");
    const again = await adoptLeftovers(db, String(company), { apply: true });
    expect(Object.values(again).every((n) => n === 0)).toBe(true);
  });

  test("with more than one company it refuses, and so does naming the wrong company", async () => {
    await expect(adoptLeftovers(db, String(new ObjectId()), { apply: true })).rejects.toThrow(/not the company/);
    await db.collection("deliverers").insertOne({ _id: new ObjectId(), companyName: "Second" });
    await expect(adoptLeftovers(db, String(company), { apply: true })).rejects.toThrow(/exactly one company/);
    expect(await db.collection("customers").countDocuments({ tenantId: { $exists: false } })).toBe(1);
  });
});
