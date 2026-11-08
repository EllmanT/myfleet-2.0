/*
 * "Delete my company" must leave nothing of the company behind. This walks every model the app
 * defines: each collection that carries a company link must be emptied for the deleted company
 * and untouched for the other one.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const deletion = require("../services/companyDeletion");
const Deliverer = require("../model/deliverer");
const Rate = require("../model/rate");

jest.setTimeout(120000);

describe("company purge is complete", () => {
  let mongod;
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
  });

  const company = (name) =>
    Deliverer.create({ companyName: name, address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"] });

  test("the contractor rates (prices) of the deleted company are removed; the other company's stay", async () => {
    const a = await company("A Co");
    const b = await company("B Co");
    await Rate.create({ deliverer: a._id, contractor: new mongoose.Types.ObjectId(), rateTypes: [{ rateType: "std", smallVehicle: 5 }] });
    await Rate.create({ deliverer: b._id, contractor: new mongoose.Types.ObjectId(), rateTypes: [{ rateType: "std", smallVehicle: 7 }] });

    const res = await deletion.purgeCompany(a._id, { force: true });
    expect(res.ok).toBe(true);
    expect(await Rate.countDocuments({ deliverer: a._id })).toBe(0);
    expect(await Rate.countDocuments({ deliverer: b._id })).toBe(1);
  });

  test("every model file is either purged, an owner record, or deliberately listed here", () => {
    const { KINDS, DERIVED_KINDS } = require("../services/dataExport");
    const covered = new Set([...KINDS, ...DERIVED_KINDS].map((k) => k.model.toLowerCase()));
    // owners themselves / handled by hand in purgeCompany
    const handledElsewhere = new Set(["deliverer", "user", "contractorstats"]);
    const modelFiles = fs
      .readdirSync(path.join(__dirname, "..", "model"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => f.replace(/\.js$/, "").toLowerCase());
    const missing = modelFiles.filter((m) => !covered.has(m) && !handledElsewhere.has(m));
    // A new model must be added to KINDS (exported and purged) or DERIVED_KINDS (purged only).
    expect(missing).toEqual([]);
  });
});
