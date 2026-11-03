/*
 * Gives every company its own copy of any customer record that more than one
 * company shares (A2). Before per-company customers, a customer was matched by
 * name across all companies, so two companies could be linked to one record.
 *
 * For each shared customer the company that uses it most keeps the original; every
 * other company gets a clone, and ONLY that company's references are repointed:
 *   - its Deliverer.customer_ids entry
 *   - its Contractors' customers entries
 *   - its jobs' `from` and `customer`
 * Invoices, quotations and trips store customer NAMES, not ids, so they need no change.
 *
 * Safe by design (same rules as backfillTenantId.js):
 *   - dry run unless --apply; the target is always explicit; live also needs --confirm-live
 *   - never deletes a customer and never edits a customer's own fields
 *   - a shared customer used by a job whose owner cannot be determined is reported
 *     and left untouched, so a person decides (the script never guesses)
 *   - idempotent: after a run nothing is shared, so a second run changes nothing
 *   - writes the old-to-new id map as JSON (--map=<file>), which is the record for rollback
 *
 * Usage (run from backend/, ideally after backfillTenantId.js):
 *   node scripts/splitSharedCustomers.js --target=local --map=customer-split-map.json
 *   node scripts/splitSharedCustomers.js --target=local --apply --map=customer-split-map.json
 *   node scripts/splitSharedCustomers.js --target=live --apply --confirm-live --map=...
 *
 * Take a backup of live and rehearse on a restored copy first (see REMAINING_WORK_PLAN.md section 4).
 */
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { computeAssignments } = require("./backfillTenantId");

async function splitSharedCustomers(db, { apply }) {
  const { companies, claims } = await computeAssignments(db);
  const customers = db.collection("customers");
  const jobs = db.collection("jobs");

  // which companies list each customer
  const listedBy = new Map();
  for (const company of companies) {
    for (const id of company.customer_ids || []) {
      const key = String(id);
      if (!listedBy.has(key)) listedBy.set(key, new Set());
      listedBy.get(key).add(String(company._id));
    }
  }
  const shared = [...listedBy].filter(([, set]) => set.size > 1);

  const report = { shared: shared.length, split: [], unresolved: [], map: [] };
  if (!shared.length) return report;
  // Build ids with the same class as the documents we read, so this works with
  // whichever driver version supplied them.
  const ObjectId = companies.flatMap((c) => c.customer_ids || [])[0].constructor;

  for (const [customerHex, companySet] of shared) {
    const customerId = new ObjectId(customerHex);
    const original = await customers.findOne({ _id: customerId });
    if (!original) {
      report.unresolved.push({ customer: customerHex, reason: "listed by companies but the record does not exist" });
      continue;
    }

    // every job that uses this customer, and who owns it
    const users = await jobs
      .find({ $or: [{ from: customerId }, { customer: customerId }] }, { projection: { _id: 1, tenantId: 1 } })
      .toArray();
    const jobsByCompany = new Map();
    let unknownOwner = 0;
    for (const job of users) {
      const claim = claims.jobs.get(String(job._id));
      const owner = job.tenantId ? String(job.tenantId) : claim && !claim.conflict ? claim.companyId : null;
      if (!owner || !companySet.has(owner)) {
        unknownOwner += 1;
        continue;
      }
      if (!jobsByCompany.has(owner)) jobsByCompany.set(owner, []);
      jobsByCompany.get(owner).push(job._id);
    }
    if (unknownOwner) {
      report.unresolved.push({
        customer: customerHex,
        name: original.name,
        reason: `${unknownOwner} job(s) using it have no single clear owning company`,
      });
      continue;
    }

    // the company with the most jobs keeps the original; ties go to the lowest company id
    const ordered = [...companySet].sort(
      (a, b) => (jobsByCompany.get(b)?.length || 0) - (jobsByCompany.get(a)?.length || 0) || a.localeCompare(b)
    );
    const keeper = ordered[0];
    const entry = { customer: customerHex, name: original.name, keeper, clones: [] };

    for (const companyHex of ordered.slice(1)) {
      const companyId = new ObjectId(companyHex);
      const jobIds = jobsByCompany.get(companyHex) || [];
      let cloneId = new ObjectId();
      if (apply) {
        const { _id, ...fields } = original;
        await customers.insertOne({ ...fields, _id: cloneId, tenantId: companyId });
        await db.collection("deliverers").updateOne(
          { _id: companyId },
          { $pull: { customer_ids: customerId } }
        );
        await db.collection("deliverers").updateOne(
          { _id: companyId },
          { $addToSet: { customer_ids: cloneId } }
        );
        // this company's contractors
        const company = companies.find((c) => String(c._id) === companyHex);
        const contractorIds = company.contractor_ids || [];
        if (contractorIds.length) {
          await db.collection("contractors").updateMany(
            { _id: { $in: contractorIds }, customers: customerId },
            { $addToSet: { customers: cloneId } }
          );
          await db.collection("contractors").updateMany(
            { _id: { $in: contractorIds } },
            { $pull: { customers: customerId } }
          );
        }
        if (jobIds.length) {
          await jobs.updateMany({ _id: { $in: jobIds }, from: customerId }, { $set: { from: cloneId } });
          await jobs.updateMany({ _id: { $in: jobIds }, customer: customerId }, { $set: { customer: cloneId } });
        }
      }
      entry.clones.push({ company: companyHex, newCustomer: String(cloneId), jobsRepointed: jobIds.length });
      report.map.push({ old: customerHex, new: String(cloneId), company: companyHex });
    }

    // the keeper's original gets its owner stamp if it has none
    if (apply) {
      await customers.updateOne({ _id: customerId, tenantId: { $exists: false } }, { $set: { tenantId: new ObjectId(keeper) } });
    }
    report.split.push(entry);
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
    const report = await splitSharedCustomers(db, { apply });
    console.log(JSON.stringify({ ...report, map: `${report.map.length} entries` }, null, 2));
    if (apply && opt("map")) {
      fs.writeFileSync(opt("map"), JSON.stringify(report.map, null, 2));
      console.log(`Old-to-new map written to ${opt("map")}`);
    }
    if (report.unresolved.length) {
      console.log(`\n${report.unresolved.length} shared customer(s) were left untouched and need a person to decide.`);
      process.exitCode = 2;
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

module.exports = { splitSharedCustomers };
