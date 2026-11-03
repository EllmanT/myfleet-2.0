/*
 * One-off: replaces the expenses index { companyId, importKey } that treated every
 * expense without an import key as a duplicate of the next one (so a company's
 * second manually entered expense failed) with a partial unique index that only
 * covers expenses that DO have an import key.
 *
 * Safe: dry run unless --apply; changes only that one index; no documents are touched.
 *
 *   node scripts/fixExpenseIndex.js --target=local            # shows what it would do
 *   node scripts/fixExpenseIndex.js --target=local --apply
 *   node scripts/fixExpenseIndex.js --target=live --apply --confirm-live
 */
const path = require("path");
const { MongoClient } = require("mongodb");

async function fixExpenseIndex(db, { apply }) {
  const coll = db.collection("expenses");
  let indexes = [];
  try {
    indexes = await coll.indexes();
  } catch (e) {
    return { status: "no expenses collection yet, nothing to do" };
  }
  const old = indexes.find((i) => i.name === "companyId_1_importKey_1");
  if (!old) return { status: "index not present (a new database creates the right one itself)" };
  if (old.partialFilterExpression) return { status: "already fixed" };
  if (!apply) return { status: "would drop the old index and create the partial one" };
  await coll.dropIndex("companyId_1_importKey_1");
  await coll.createIndex(
    { companyId: 1, importKey: 1 },
    { name: "companyId_1_importKey_1", unique: true, partialFilterExpression: { importKey: { $type: "string" } } }
  );
  return { status: "fixed" };
}

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
  const target = opt("target");
  if (!["local", "live"].includes(target)) throw new Error("Pass --target=local or --target=live");
  if (target === "live" && flag("apply") && !flag("confirm-live")) throw new Error("Writing to live needs --apply --confirm-live");
  const uri = target === "live" ? process.env.MONGO_URI_LIVE : process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error(`No connection string configured for ${target}`);
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    console.log(`Target: ${target} | database: ${db.databaseName} | mode: ${flag("apply") ? "APPLY" : "DRY RUN"}`);
    console.log(JSON.stringify(await fixExpenseIndex(db, { apply: flag("apply") })));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
module.exports = { fixExpenseIndex };
