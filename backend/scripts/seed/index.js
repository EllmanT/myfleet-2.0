/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const { getSeedConfig } = require("./config");
const { importCollections } = require("./importCollections");
const { rebuildStatsFromJobs } = require("./rebuildStatsFromJobs");
const { logger, timedStep } = require("./logger");
const { SeedError } = require("./errors");

dotenv.config({ path: path.resolve(__dirname, "..", "..", "config", ".env") });

const BASE_IMPORT_ORDER = [
  "users",
  "deliverers",
  "customers",
  "contractors",
  "drivers",
  "vehicles",
  "rates",
  "vehicleexpenses",
  "employeeexpenses",
];

const JOBS_IMPORT_ORDER = ["jobs"];

const parseDbName = (uri) => {
  const parsed = new URL(uri);
  const pathname = parsed.pathname.replace(/^\/+/, "");
  return pathname.split("?")[0] || "myfleet";
};

async function rebuildJobRelationships(db) {
  return timedStep("rebuild:job_ids", async () => {
    const jobs = await db
      .collection("jobs")
      .find(
        {},
        { projection: { _id: 1, contractorId: 1, driverId: 1, vehicleId: 1 } }
      )
      .toArray();

    const jobsByContractor = new Map();
    const jobsByDriver = new Map();
    const jobsByVehicle = new Map();
    const allJobIds = jobs.map((j) => j._id);

    for (const job of jobs) {
      if (job.contractorId) {
        const key = job.contractorId.toString();
        if (!jobsByContractor.has(key)) jobsByContractor.set(key, []);
        jobsByContractor.get(key).push(job._id);
      }
      if (job.driverId) {
        const key = job.driverId.toString();
        if (!jobsByDriver.has(key)) jobsByDriver.set(key, []);
        jobsByDriver.get(key).push(job._id);
      }
      if (job.vehicleId) {
        const key = job.vehicleId.toString();
        if (!jobsByVehicle.has(key)) jobsByVehicle.set(key, []);
        jobsByVehicle.get(key).push(job._id);
      }
    }

    await db.collection("contractors").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("drivers").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("vehicles").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("deliverers").updateMany({}, { $set: { job_ids: allJobIds } });

    const contractorOps = Array.from(jobsByContractor.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));
    const driverOps = Array.from(jobsByDriver.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));
    const vehicleOps = Array.from(jobsByVehicle.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));

    if (contractorOps.length) await db.collection("contractors").bulkWrite(contractorOps);
    if (driverOps.length) await db.collection("drivers").bulkWrite(driverOps);
    if (vehicleOps.length) await db.collection("vehicles").bulkWrite(vehicleOps);

    return {
      contractorsUpdated: contractorOps.length,
      driversUpdated: driverOps.length,
      vehiclesUpdated: vehicleOps.length,
      deliverersUpdated: await db.collection("deliverers").countDocuments(),
    };
  });
}

async function validateCollectionCounts(db, importResults, statsResults) {
  return timedStep("validate:counts", async () => {
    const failures = [];
    for (const row of [...importResults, ...statsResults]) {
      if (row.count < 0) {
        failures.push({ collection: row.collection || row.collectionName, reason: "Negative count" });
      }
      if (typeof row.inserted === "number" && row.count !== row.inserted) {
        failures.push({
          collection: row.collection || row.collectionName,
          reason: "Inserted count mismatch",
          inserted: row.inserted,
          count: row.count,
        });
      }
    }
    if (failures.length) {
      throw new SeedError("Count validation failed", { failures });
    }
    logger.info("Count validation passed", { checks: importResults.length + statsResults.length });
  });
}

async function runSeedForTarget(targetName, uri, config) {
  const dbName = parseDbName(uri);
  const client = new MongoClient(uri);
  logger.info("Connecting target", { targetName, dbName });
  await client.connect();
  const db = client.db(dbName);

  try {
    logger.info("Seed target started", { targetName, backupDir: config.backupDir });
    const baseImportResults = await importCollections({
      db,
      backupDir: config.backupDir,
      importOrder: BASE_IMPORT_ORDER,
      requiredCollections: config.requiredCollections,
    });
    const jobsImportResults = await importCollections({
      db,
      backupDir: config.backupDir,
      importOrder: JOBS_IMPORT_ORDER,
      requiredCollections: config.requiredCollections,
    });
    const statsResults = await rebuildStatsFromJobs(db, config.derivedCollections);
    await rebuildJobRelationships(db);
    await validateCollectionCounts(db, [...baseImportResults, ...jobsImportResults], statsResults);
    logger.info("Seed target finished", { targetName });
  } finally {
    await client.close();
    logger.info("Disconnected target", { targetName });
  }
}

async function main() {
  const config = getSeedConfig();

  await runSeedForTarget("local", config.localUri, config);
  await runSeedForTarget("live", config.liveUri, config);
}

main()
  .then(() => {
    logger.info("Seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seeding failed", {
      errorName: error.name,
      errorMessage: error.message,
      details: error.details,
    });
    process.exit(1);
  });
