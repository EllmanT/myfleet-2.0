/*
 * Stamps `tenantId` on every tenant-owned document, using what the app already
 * knows about ownership: the id lists on each Deliverer (vehicle_ids, driver_ids,
 * customer_ids, contractor_ids, job_ids), the companyId strings on vehicles and
 * drivers, and the references between jobs, vehicles, drivers and stats.
 *
 * Safe by design:
 *   - dry run unless --apply is given; a dry run only reports what it would do
 *   - only fills a MISSING tenantId; never overwrites one, never deletes anything
 *   - a record claimed by two different companies is reported as a conflict and
 *     left untouched, so a human decides
 *   - the target is always explicit; there is no NODE_ENV guessing
 *   - idempotent: running it twice changes nothing the second time
 *
 * Usage (run from backend/):
 *   node scripts/backfillTenantId.js --target=local                 # dry run
 *   node scripts/backfillTenantId.js --target=local --apply
 *   node scripts/backfillTenantId.js --target=live --apply --confirm-live
 *
 * Take a backup of live before the first live --apply.
 */
const path = require("path");
const { MongoClient } = require("mongodb");

// owner collection -> how a document is claimed by a company
const IDS = (field) => (company) => company[field] || [];

async function computeAssignments(db) {
  const companies = await db.collection("deliverers").find({}).toArray();
  const claims = {
    customers: new Map(),
    contractors: new Map(),
    vehicles: new Map(),
    drivers: new Map(),
    jobs: new Map(),
  };
  const conflicts = [];

  const claim = (collection, id, companyId, why) => {
    const key = String(id);
    const map = claims[collection];
    const existing = map.get(key);
    if (existing && existing.companyId !== String(companyId)) {
      conflicts.push({ collection, id: key, a: existing.companyId, b: String(companyId), why });
      existing.conflict = true;
      return;
    }
    if (!existing) map.set(key, { companyId: String(companyId), conflict: false, rawId: id });
  };

  for (const company of companies) {
    const cid = company._id;
    IDS("customer_ids")(company).forEach((id) => claim("customers", id, cid, "customer_ids"));
    IDS("contractor_ids")(company).forEach((id) => claim("contractors", id, cid, "contractor_ids"));
    IDS("vehicle_ids")(company).forEach((id) => claim("vehicles", id, cid, "vehicle_ids"));
    IDS("driver_ids")(company).forEach((id) => claim("drivers", id, cid, "driver_ids"));
    IDS("job_ids")(company).forEach((id) => claim("jobs", id, cid, "job_ids"));
  }

  // vehicles/drivers also carry a companyId string
  const validCompany = new Set(companies.map((c) => String(c._id)));
  for (const collection of ["vehicles", "drivers"]) {
    const docs = await db.collection(collection).find({}, { projection: { companyId: 1 } }).toArray();
    docs.forEach((d) => {
      if (d.companyId && validCompany.has(String(d.companyId))) {
        claim(collection, d._id, d.companyId, "companyId");
      }
    });
  }

  // jobs not listed on any company are owned by whoever owns their vehicle
  const vehicleOwner = (id) => {
    const c = claims.vehicles.get(String(id));
    return c && !c.conflict ? c.companyId : null;
  };
  const jobs = await db
    .collection("jobs")
    .find({}, { projection: { vehicleId: 1, tenantId: 1 } })
    .toArray();
  jobs.forEach((job) => {
    if (!claims.jobs.has(String(job._id)) && job.vehicleId) {
      const owner = vehicleOwner(job.vehicleId);
      if (owner) claim("jobs", job._id, owner, "via vehicle");
    }
  });

  return { companies, claims, conflicts };
}

async function backfill(db, { apply }) {
  const { companies, claims, conflicts } = await computeAssignments(db);
  const report = { collections: {}, conflicts };
  const toObjectId = (hex) => companies.find((c) => String(c._id) === hex)._id;

  for (const [collection, map] of Object.entries(claims)) {
    const coll = db.collection(collection);
    const byCompany = new Map();
    for (const [id, info] of map) {
      if (info.conflict) continue;
      if (!byCompany.has(info.companyId)) byCompany.set(info.companyId, []);
      byCompany.get(info.companyId).push(info.rawId);
    }

    let updated = 0;
    for (const [companyHex, ids] of byCompany) {
      const filter = {
        _id: { $in: ids },
        tenantId: { $exists: false },
      };
      if (apply) {
        const res = await coll.updateMany(filter, { $set: { tenantId: toObjectId(companyHex) } });
        updated += res.modifiedCount;
      } else {
        updated += await coll.countDocuments(filter);
      }
    }

    const total = await coll.countDocuments({});
    const stamped = await coll.countDocuments({ tenantId: { $exists: true } });
    report.collections[collection] = {
      total,
      alreadyStamped: apply ? stamped - updated : stamped,
      [apply ? "stamped" : "wouldStamp"]: updated,
    };
  }

  // Derived stats follow their vehicle / driver.
  for (const [statsColl, refField, ownerColl] of [
    ["vehiclestats", "vehicleId", "vehicles"],
    ["driverstats", "driverId", "drivers"],
  ]) {
    const coll = db.collection(statsColl);
    let updated = 0;
    const docs = await coll
      .find({ tenantId: { $exists: false } }, { projection: { [refField]: 1 } })
      .toArray();
    for (const doc of docs) {
      const owner = claims[ownerColl].get(String(doc[refField]));
      if (!owner || owner.conflict) continue;
      updated += 1;
      if (apply) {
        await coll.updateOne({ _id: doc._id }, { $set: { tenantId: toObjectId(owner.companyId) } });
      }
    }
    report.collections[statsColl] = { [apply ? "stamped" : "wouldStamp"]: updated, unowned: docs.length - updated };
  }

  // Anything still without an owner after a run is an orphan worth a look.
  report.orphans = {};
  for (const collection of Object.keys(claims)) {
    const coll = db.collection(collection);
    const remaining = await coll.countDocuments({ tenantId: { $exists: false } });
    const stillClaimable = apply ? 0 : report.collections[collection].wouldStamp;
    report.orphans[collection] = Math.max(0, remaining - stillClaimable);
  }

  return report;
}

// What the normal backfill cannot place: records that no company lists (old imports, statistics
// of vehicles that were later deleted). With exactly ONE company in the database they can only
// belong to it. With more than one this refuses, because guessing would hand one company
// another's records.
async function adoptLeftovers(db, companyHex, { apply }) {
  const companies = await db.collection("deliverers").find({}, { projection: { _id: 1 } }).toArray();
  if (companies.length !== 1) {
    throw new Error(`Adopting leftovers is only allowed when there is exactly one company (found ${companies.length})`);
  }
  if (String(companies[0]._id) !== String(companyHex)) {
    throw new Error("That is not the company in this database");
  }
  const tenantId = companies[0]._id;
  const plan = [
    ["customers", { tenantId: { $exists: false } }, { tenantId }],
    ["contractors", { tenantId: { $exists: false } }, { tenantId }],
    ["vehicles", { tenantId: { $exists: false } }, { tenantId }],
    ["drivers", { tenantId: { $exists: false } }, { tenantId }],
    ["jobs", { tenantId: { $exists: false } }, { tenantId }],
    ["vehiclestats", { tenantId: { $exists: false } }, { tenantId }],
    ["driverstats", { tenantId: { $exists: false } }, { tenantId }],
    ["contractorstats", { $or: [{ delivererId: "" }, { delivererId: { $exists: false } }, { delivererId: null }] }, { delivererId: String(tenantId) }],
  ];
  const report = {};
  for (const [name, filter, set] of plan) {
    const coll = db.collection(name);
    report[name] = apply ? (await coll.updateMany(filter, { $set: set })).modifiedCount : await coll.countDocuments(filter);
  }
  return report;
}

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];

  const target = opt("target");
  if (!["local", "live"].includes(target)) throw new Error("Pass --target=local or --target=live");
  const apply = flag("apply");
  if (target === "live" && apply && !flag("confirm-live")) {
    throw new Error("Writing to live needs --apply --confirm-live");
  }
  const uri = target === "live" ? process.env.MONGO_URI_LIVE : process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error(`No connection string configured for ${target}`);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    console.log(`Target: ${target} | database: ${db.databaseName} | mode: ${apply ? "APPLY" : "DRY RUN"}`);
    const report = await backfill(db, { apply });
    console.log(JSON.stringify(report, null, 2));
    const adopt = opt("adopt-leftovers-into");
    if (adopt) {
      const adopted = await adoptLeftovers(db, adopt, { apply });
      console.log(`
Leftovers ${apply ? "adopted" : "that would be adopted"} by company ${adopt}:`);
      console.log(JSON.stringify(adopted, null, 2));
    }
    if (report.conflicts.length) {
      console.log(`\n${report.conflicts.length} record(s) are claimed by more than one company and were NOT stamped.`);
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { computeAssignments, backfill, adoptLeftovers };
