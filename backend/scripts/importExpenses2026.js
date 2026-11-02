/*
 * Loads the 2026 fuel estimates, express-trip receipts and monthly salaries
 * (backend/scripts/data/expenses2026.json) into the NEW `expenses` collection only.
 *
 * Safe by design:
 *   - never drops or deletes anything; re-running updates the same rows (matched by importKey)
 *   - dry run unless --apply is given
 *   - the target is always explicit; there is no NODE_ENV guessing
 *
 * Usage (run from backend/):
 *   node scripts/importExpenses2026.js --target=local                 # dry run on the local DB
 *   node scripts/importExpenses2026.js --target=local --apply
 *   node scripts/importExpenses2026.js --target=live  --apply --confirm-live
 *
 * Take a backup of live before the first live --apply.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
const { MongoClient } = require("mongodb");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];

async function main() {
  const target = opt("target");
  if (!["local", "live"].includes(target)) throw new Error("Pass --target=local or --target=live");
  const apply = flag("apply");
  if (target === "live" && apply && !flag("confirm-live")) {
    throw new Error("Writing to live needs --apply --confirm-live");
  }
  const uri = target === "live" ? process.env.MONGO_URI_LIVE : process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error(`No connection string configured for ${target}`);

  const records = require("./data/expenses2026.json");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(); // database name comes from the URI
    console.log(`Target: ${target} | database: ${db.databaseName} | mode: ${apply ? "APPLY" : "DRY RUN"}`);

    const deliverers = await db.collection("deliverers").find({}, { projection: { _id: 1, companyName: 1 } }).toArray();
    const companyArg = opt("company");
    const company = companyArg ? deliverers.find((d) => String(d._id) === companyArg) : deliverers.length === 1 ? deliverers[0] : null;
    if (!company) {
      throw new Error(`Cannot pick one company (found ${deliverers.length}). Re-run with --company=<id>.`);
    }
    const vehicles = await db.collection("vehicles").find({}, { projection: { regNumber: 1 } }).toArray();
    const vid = Object.fromEntries(vehicles.map((v) => [v.regNumber, v._id]));

    const now = new Date();
    const ops = records.map((r) => {
      if (r.vehicleReg && !vid[r.vehicleReg]) throw new Error(`Vehicle ${r.vehicleReg} not found in ${target}`);
      const { vehicleReg, ...rest } = r;
      const doc = {
        ...rest,
        companyId: company._id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        source: "import-2026",
        countsInProfit: r.countsInProfit !== false,
        retainedInBusiness: !!r.retainedInBusiness,
        updatedAt: now,
      };
      if (vehicleReg) doc.vehicleId = vid[vehicleReg];
      return {
        updateOne: {
          filter: { companyId: company._id, importKey: r.importKey },
          update: { $set: doc, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      };
    });

    const existing = await db.collection("expenses").countDocuments({ companyId: company._id, source: "import-2026" });
    console.log(`Company: ${company.companyName} | rows in file: ${ops.length} | already imported: ${existing}`);
    if (!apply) {
      console.log("Dry run only. Nothing written. Add --apply to write.");
      return;
    }
    const res = await db.collection("expenses").bulkWrite(ops, { ordered: false });
    console.log(`Done. inserted: ${res.upsertedCount}, updated: ${res.modifiedCount}, unchanged: ${res.matchedCount - res.modifiedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
