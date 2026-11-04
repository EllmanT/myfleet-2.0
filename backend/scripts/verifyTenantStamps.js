/*
 * Read-only check: does every company-owned record carry its company?
 *
 * This is the gate before switching the query guard to enforce (TENANT_GUARD=enforce).
 * In enforce mode a record with no owner field is invisible to everyone, so any
 * unstamped record would seem to "disappear". This script lists them instead.
 *
 * Exit code 0 = nothing unstamped (safe to enforce), 1 = unstamped records found.
 * It never writes anything.
 *
 * Usage (run from backend/):
 *   node scripts/verifyTenantStamps.js --target=local
 *   node scripts/verifyTenantStamps.js --target=live
 */
const path = require("path");
const fs = require("fs");

async function verifyTenantStamps(mongoose) {
  // load every model so each one's collection name is known
  const modelDir = path.join(__dirname, "..", "model");
  fs.readdirSync(modelDir)
    .filter((f) => f.endsWith(".js"))
    .forEach((f) => require(path.join(modelDir, f)));

  const { GUARDED } = require("../services/tenantGuard");
  const db = mongoose.connection.db;
  const report = [];
  for (const [modelName, field] of Object.entries(GUARDED)) {
    if (!mongoose.modelNames().includes(modelName)) continue;
    const collection = mongoose.model(modelName).collection.name;
    const coll = db.collection(collection);
    const total = await coll.countDocuments({});
    // matches a missing field, null, or an empty string
    const unstamped = await coll.countDocuments({ $or: [{ [field]: null }, { [field]: "" }] });
    report.push({ model: modelName, collection, field, total, unstamped });
  }
  return report;
}

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
  const mongoose = require("mongoose");
  const args = process.argv.slice(2);
  const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
  const target = opt("target");
  if (!["local", "live"].includes(target)) throw new Error("Pass --target=local or --target=live");
  const uri = target === "live" ? process.env.MONGO_URI_LIVE : process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error(`No connection string configured for ${target}`);

  await mongoose.connect(uri);
  try {
    console.log(`Target: ${target} | database: ${mongoose.connection.db.databaseName} | read-only`);
    const report = await verifyTenantStamps(mongoose);
    console.table(report.filter((r) => r.total > 0));
    const bad = report.filter((r) => r.unstamped > 0);
    if (bad.length) {
      console.log(
        `\nNOT SAFE to enforce: ${bad.map((r) => `${r.model} (${r.unstamped})`).join(", ")} have no owner. ` +
          "Run backfillTenantId.js (and splitSharedCustomers.js), then check again."
      );
      process.exitCode = 1;
    } else {
      console.log("\nEvery company-owned record is stamped. Safe to set TENANT_GUARD=enforce.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { verifyTenantStamps };
