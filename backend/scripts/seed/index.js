/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const { getSeedConfig } = require("./config");
const { importCollections } = require("./importCollections");
const { rebuildStatsFromJobs } = require("./rebuildStatsFromJobs");
const { rebuildJobRelationships } = require("./rebuildJobRelationships");
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
