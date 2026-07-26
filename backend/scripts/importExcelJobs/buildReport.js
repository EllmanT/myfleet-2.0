/**
 * Dry run: parses every file in the manifest, resolves it against the
 * current LOCAL DB reference data, and writes a JSON report describing what
 * an actual import (run.js) would do. Makes no writes of any kind.
 */
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { loadReferenceData } = require("./resolveEntities");
const { collectAllRows } = require("./collectAllRows");

dotenv.config({ path: path.resolve(__dirname, "..", "..", "config", ".env") });

function parseDbName(uri) {
  const parsed = new URL(uri);
  return parsed.pathname.replace(/^\/+/, "").split("?")[0] || "myfleet";
}

async function main() {
  const uri = process.env.MONGO_URI_LOCAL || process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error("Missing MONGO_URI_LOCAL/OFFLINE_DB_URL");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(parseDbName(uri));
    const refData = await loadReferenceData(db);
    const { perFile, jobDrafts, pendingNewCustomers, unresolved, duplicates } =
      collectAllRows(refData);

    const totalDistance = Math.round(
      perFile.reduce((s, f) => s + f.computedDistance, 0) * 100
    ) / 100;
    const totalCost = Math.round(
      perFile.reduce((s, f) => s + f.computedCost, 0) * 100
    ) / 100;

    const headerMismatches = perFile.filter((f) => {
      const distOk = f.declared.dist === null || f.declared.dist === f.computedDistance;
      const costOk = f.declared.cost === null || f.declared.cost === f.computedCost;
      return !distOk || !costOk;
    });

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        filesProcessed: perFile.length,
        totalAcceptedJobRows: jobDrafts.length,
        totalDistance,
        totalCost,
        unresolvedRowCount: unresolved.length,
        duplicateLegsSkipped: duplicates.length,
        newCustomersToCreate: pendingNewCustomers.size,
        filesWithHeaderMismatch: headerMismatches.length,
      },
      perFile,
      headerMismatches: headerMismatches.map((f) => ({
        file: f.file,
        sheet: f.sheet,
        declared: f.declared,
        computed: { distance: f.computedDistance, cost: f.computedCost },
      })),
      newCustomers: Array.from(pendingNewCustomers.values()).map((c) => c.name).sort(),
      unresolved,
      duplicates,
    };

    const outPath = path.resolve(__dirname, "report.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log("=== Import dry-run report ===");
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`Full report written to ${outPath}`);
    if (unresolved.length) {
      console.log(`\nWARNING: ${unresolved.length} row(s) could not be resolved — see report.json`);
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Report generation failed:", error);
    process.exit(1);
  });
}

module.exports = { main };
