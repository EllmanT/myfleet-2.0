const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { SOURCE_ROOT, FILE_VEHICLE_MAP } = require("./fileManifest");
const { parseSheet } = require("./parseWorkbook");
const { resolveRow, normalizeName } = require("./resolveEntities");

function parseDeclaredHeader(titleRowRaw = []) {
  const text = titleRowRaw.map((c) => String(c)).join(" ");
  const jobs = text.match(/JOBS?\s*:?\s*(\d+)/i);
  const dist = text.match(/DIST(?:ANCE)?\s*:?\s*(\d+(?:\.\d+)?)\s*KM/i);
  const cost = text.match(/COST\s*:?\s*\$?\s*(?:USD)?\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  return {
    jobs: jobs ? Number(jobs[1]) : null,
    dist: dist ? Number(dist[1]) : null,
    cost: cost ? Number(cost[1].replace(/,/g, "")) : null,
  };
}

function legKey(vehicleRegNumber, row) {
  return [
    vehicleRegNumber,
    row.jobNumber,
    normalizeName(row.from),
    normalizeName(row.customer),
    row.mileageOut,
    row.mileageIn,
    row.orderDate.toISOString().slice(0, 10),
  ].join("|");
}

/**
 * Walks every mapped file/sheet, parses it, and resolves every row against
 * current DB reference data. Read-only against the DB (refData is loaded by
 * the caller). Returns everything needed both for the pre-write report and
 * for the actual insert step.
 */
function collectAllRows(refData) {
  const perFile = [];
  const jobDrafts = [];
  const pendingNewCustomers = new Map();
  const unresolved = [];
  const seenLegs = new Map(); // legKey -> first occurrence {file, sheet}
  const duplicates = [];

  for (const [relPath, vehicleSpec] of Object.entries(FILE_VEHICLE_MAP)) {
    const absPath = path.join(SOURCE_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Manifest references missing file: ${relPath}`);
    }
    const wb = XLSX.readFile(absPath);

    const sheetsToRead =
      typeof vehicleSpec === "string"
        ? wb.SheetNames.map((sn) => ({ sheetName: sn, vehicleRegNumber: vehicleSpec }))
        : Object.entries(vehicleSpec).map(([sheetName, vehicleRegNumber]) => ({
            sheetName,
            vehicleRegNumber,
          }));

    for (const { sheetName, vehicleRegNumber } of sheetsToRead) {
      if (!wb.SheetNames.includes(sheetName)) {
        throw new Error(`Sheet "${sheetName}" not found in ${relPath}`);
      }
      const sheet = wb.Sheets[sheetName];
      const parsed = parseSheet(sheet, { sourceFile: relPath, sourceSheet: sheetName });
      const declared = parseDeclaredHeader(parsed.titleRowRaw);

      let computedDistance = 0;
      let computedCost = 0;
      let acceptedCount = 0;

      for (const row of parsed.rows) {
        const key = legKey(vehicleRegNumber, row);
        if (seenLegs.has(key)) {
          duplicates.push({ key, first: seenLegs.get(key), duplicate: { file: relPath, sheet: sheetName } });
          continue; // skip exact duplicate leg
        }
        seenLegs.set(key, { file: relPath, sheet: sheetName });

        const { issues, jobDraft } = resolveRow(row, vehicleRegNumber, refData, pendingNewCustomers);
        if (issues.length) {
          unresolved.push({ file: relPath, sheet: sheetName, jobNumber: row.jobNumber, issues });
          continue;
        }
        jobDrafts.push(jobDraft);
        computedDistance += row.distance;
        computedCost += row.cost;
        acceptedCount += 1;
      }

      perFile.push({
        file: relPath,
        sheet: sheetName,
        vehicleRegNumber,
        declared,
        parsedRowCount: parsed.rows.length,
        acceptedRowCount: acceptedCount,
        droppedRowCount: parsed.dropped.length,
        computedDistance: Math.round(computedDistance * 100) / 100,
        computedCost: Math.round(computedCost * 100) / 100,
      });
    }
  }

  return {
    perFile,
    jobDrafts,
    pendingNewCustomers,
    unresolved,
    duplicates,
  };
}

module.exports = { collectAllRows, parseDeclaredHeader, legKey };
