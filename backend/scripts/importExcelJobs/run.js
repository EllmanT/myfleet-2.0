/**
 * Real import: for every (vehicle, year-month) pair actually present in the
 * parsed Excel/PDF source files, replaces the matching jobs in the LOCAL DB,
 * then refreshes job_ids relationships. Months with no source file (e.g. the
 * current in-progress month) are never touched. Local DB only — live Mongo
 * is untouched (see HANDOFF.md §5/§7 for the mirror-to-live step).
 */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient, Decimal128 } = require("mongodb");
const { loadReferenceData, finalizeJobDraft } = require("./resolveEntities");
const { collectAllRows } = require("./collectAllRows");
const { rebuildJobRelationships } = require("../seed/rebuildJobRelationships");
const { logger, timedStep } = require("../seed/logger");

dotenv.config({ path: path.resolve(__dirname, "..", "..", "config", ".env") });

function parseDbName(uri) {
  const parsed = new URL(uri);
  return parsed.pathname.replace(/^\/+/, "").split("?")[0] || "myfleet";
}

/**
 * Builds one {vehicleId, monthStart, monthEnd} bucket per distinct
 * (vehicle, year-month) pair actually present in the parsed source data.
 * Only these exact vehicle+month combinations get wiped and replaced —
 * any month with no corresponding source file (the current in-progress
 * month, a future month, etc.) is structurally never touched, with no
 * date cutoff to remember to update by hand.
 */
function buildReplaceBuckets(jobDrafts) {
  const buckets = new Map();
  for (const draft of jobDrafts) {
    const y = draft.orderDate.getUTCFullYear();
    const m = draft.orderDate.getUTCMonth();
    const key = `${draft.vehicleId.toString()}|${y}-${m}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        vehicleId: draft.vehicleId,
        monthStart: new Date(Date.UTC(y, m, 1)),
        monthEnd: new Date(Date.UTC(y, m + 1, 1)),
      });
    }
  }
  return Array.from(buckets.values());
}

async function main() {
  const uri = process.env.MONGO_URI_LOCAL || process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error("Missing MONGO_URI_LOCAL/OFFLINE_DB_URL");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(parseDbName(uri));

    const refData = await timedStep("load:referenceData", () => loadReferenceData(db));
    const { jobDrafts, pendingNewCustomers, unresolved } = await timedStep(
      "parse:sourceFiles",
      async () => collectAllRows(refData)
    );

    if (unresolved.length) {
      logger.error("Aborting: unresolved rows found", { count: unresolved.length });
      for (const u of unresolved) {
        logger.error("unresolved row", u);
      }
      process.exit(1);
    }

    await timedStep(
      "customers:create",
      async () => {
        if (!pendingNewCustomers.size) return;
        const now = new Date();
        const docs = Array.from(pendingNewCustomers.values()).map((c) => ({
          name: c.name,
          createdAt: now,
          updatedAt: now,
        }));
        const result = await db.collection("customers").insertMany(docs, { ordered: false });
        let i = 0;
        for (const [key] of pendingNewCustomers) {
          refData.customerIdByName.set(key, result.insertedIds[i]);
          i += 1;
        }
      },
      { count: pendingNewCustomers.size }
    );

    const finalJobs = jobDrafts.map((draft) => {
      const job = finalizeJobDraft(draft, refData);
      job.cost = Decimal128.fromString(job.cost.toFixed(2));
      return job;
    });

    const replaceBuckets = buildReplaceBuckets(finalJobs);
    const deleteResult = await timedStep(
      "jobs:wipe",
      () =>
        replaceBuckets.length
          ? db.collection("jobs").deleteMany({
              $or: replaceBuckets.map((b) => ({
                vehicleId: b.vehicleId,
                orderDate: { $gte: b.monthStart, $lt: b.monthEnd },
              })),
            })
          : Promise.resolve({ deletedCount: 0 }),
      { vehicleMonthBuckets: replaceBuckets.length }
    );

    await timedStep(
      "jobs:insert",
      () => db.collection("jobs").insertMany(finalJobs, { ordered: false }),
      { count: finalJobs.length }
    );

    const relationshipResult = await rebuildJobRelationships(db);

    const regByVehicleId = new Map(
      Array.from(refData.vehicleIdByReg.entries()).map(([reg, id]) => [id.toString(), reg])
    );

    const perVehicleMonth = new Map();
    for (const job of finalJobs) {
      const monthKey = `${job.orderDate.getUTCFullYear()}-${String(
        job.orderDate.getUTCMonth() + 1
      ).padStart(2, "0")}`;
      const reg = regByVehicleId.get(job.vehicleId.toString()) || job.vehicleId.toString();
      const key = `${reg}|${monthKey}`;
      if (!perVehicleMonth.has(key)) {
        perVehicleMonth.set(key, { count: 0, distance: 0, cost: 0 });
      }
      const agg = perVehicleMonth.get(key);
      agg.count += 1;
      agg.distance += job.distance;
      agg.cost += parseFloat(job.cost.toString());
    }

    const totalDistance = finalJobs.reduce((s, j) => s + j.distance, 0);
    const totalCost = finalJobs.reduce((s, j) => s + parseFloat(j.cost.toString()), 0);

    logger.info("=== Import summary ===", {
      jobsDeleted: deleteResult.deletedCount,
      jobsInserted: finalJobs.length,
      customersCreated: pendingNewCustomers.size,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      ...relationshipResult,
    });

    console.log("\nPer vehicle/month:");
    for (const [key, agg] of Array.from(perVehicleMonth.entries()).sort()) {
      const [reg, month] = key.split("|");
      console.log(
        `  ${reg} ${month}: ${agg.count} jobs, ${Math.round(agg.distance * 100) / 100}km, $${Math.round(agg.cost * 100) / 100}`
      );
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
}

module.exports = { main };
