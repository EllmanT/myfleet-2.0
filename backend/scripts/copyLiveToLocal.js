/*
 * Makes a READ-ONLY copy of the live database into a local scratch database, so migrations
 * (backfillTenantId, splitSharedCustomers, verifyTenantStamps) can be rehearsed on real data.
 *
 *   node scripts/copyLiveToLocal.js --to=mongodb://127.0.0.1:27018/myfleet-rehearsal
 *
 * Safety:
 *   - the source is MONGO_URI_LIVE from config/.env and is only ever read (find / count); this
 *     script has no code path that writes to it
 *   - the destination must be on this machine (localhost / 127.0.0.1); anything else is refused
 *   - the destination database is emptied first, so it is always an exact copy
 *   - the copy contains real customer and driver data: keep it local, never commit it, and
 *     delete it when the rehearsal is finished
 */
const path = require("path");
const { MongoClient } = require("mongodb");

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
  const source = process.env.MONGO_URI_LIVE;
  const to = arg("to");
  if (!source) throw new Error("MONGO_URI_LIVE is not set in config/.env");
  if (!to) throw new Error("Give the destination: --to=mongodb://127.0.0.1:27018/<name>");
  const dest = new URL(to);
  if (!["127.0.0.1", "localhost"].includes(dest.hostname)) {
    throw new Error("The destination must be on this machine (127.0.0.1 or localhost)");
  }
  if (to === source) throw new Error("Destination and source are the same");

  const src = await MongoClient.connect(source, { serverSelectionTimeoutMS: 15000 });
  const dst = await MongoClient.connect(to, { serverSelectionTimeoutMS: 15000 });
  try {
    const srcDb = src.db();
    const dstDb = dst.db();
    await dstDb.dropDatabase();
    const collections = (await srcDb.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith("system."));
    const summary = [];
    for (const name of collections) {
      const cursor = srcDb.collection(name).find({});
      let batch = [];
      let count = 0;
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= 500) {
          await dstDb.collection(name).insertMany(batch, { ordered: false });
          count += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await dstDb.collection(name).insertMany(batch, { ordered: false });
        count += batch.length;
      }
      summary.push([name, count]);
    }
    console.log(`Copied ${summary.length} collections from "${srcDb.databaseName}" into "${dstDb.databaseName}":`);
    for (const [name, count] of summary) console.log(`  ${name.padEnd(28)} ${count}`);
  } finally {
    await src.close();
    await dst.close();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
