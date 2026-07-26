const XLSX = require("xlsx");

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function ddmmyyyyToDate(value) {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  let [, dd, mm, yyyy] = match;
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function coerceDate(raw) {
  if (typeof raw === "number") return excelSerialToDate(raw);
  if (raw instanceof Date) return raw;
  if (typeof raw === "string") {
    const fromSlash = ddmmyyyyToDate(raw);
    if (fromSlash) return fromSlash;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function findHeaderRowIndex(rows) {
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i += 1) {
    const cells = rows[i].map((c) => String(c).trim().toLowerCase());
    if (cells.some((c) => c === "j/n" || c === "job number" || c === "job no")) {
      return i;
    }
  }
  return -1;
}

function buildColumnMap(headerRow) {
  const idx = {};
  headerRow.forEach((raw, i) => {
    const h = String(raw).trim().toLowerCase();
    if (h === "j/n" || h === "job number" || h === "job no") idx.jobNumber = i;
    else if (h === "d/t" || h === "delivery type" || h === "type") idx.deliveryType = i;
    else if (h === "contractor") idx.contractor = i;
    else if (h === "from") idx.from = i;
    else if (h === "customer") idx.customer = i;
    else if (h.includes("out")) idx.mileageOut = i;
    else if (h.includes("in") && !h.includes("distance")) idx.mileageIn = i;
    else if (h.includes("dist")) idx.distance = i;
    else if (h.includes("cost")) idx.cost = i;
    else if (h.includes("source month")) idx.sourceMonth = i;
    else if (h.includes("date")) idx.date = i;
  });
  return idx;
}

/**
 * Parses one worksheet into normalized job-leg rows.
 * Returns { rows, dropped, columnMap, headerRowIndex } where each row is
 * { jobNumber, deliveryType, from, customer, mileageOut, mileageIn,
 *   distance, cost, orderDate, contractorName }.
 */
function parseSheet(sheet, { sourceFile, sourceSheet }) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headerRowIndex = findHeaderRowIndex(raw);
  if (headerRowIndex === -1) {
    throw new Error(
      `No job header row found in ${sourceFile} :: ${sourceSheet} (looked in first 30 rows)`
    );
  }

  const columnMap = buildColumnMap(raw[headerRowIndex]);
  const required = ["jobNumber", "mileageOut", "mileageIn", "distance", "cost", "date"];
  const missing = required.filter((k) => columnMap[k] === undefined);
  if (missing.length) {
    throw new Error(
      `${sourceFile} :: ${sourceSheet} is missing required column(s): ${missing.join(", ")}`
    );
  }

  const body = raw
    .slice(headerRowIndex + 1)
    .filter((r) => r.some((c) => String(c).trim() !== ""));

  const cutIdx = body.findIndex(
    (r) => String(r[0]).trim().toUpperCase() === "TOTAL"
  );
  const dataRows = cutIdx === -1 ? body : body.slice(0, cutIdx);

  const rows = [];
  const dropped = [];

  dataRows.forEach((r, i) => {
    const jobNumber = String(r[columnMap.jobNumber] ?? "").trim();
    const distance = Number(r[columnMap.distance]);
    const cost = Number(r[columnMap.cost]);
    const orderDate = coerceDate(r[columnMap.date]);

    if (!jobNumber || !Number.isFinite(distance) || !Number.isFinite(cost) || !orderDate) {
      dropped.push({ rowIndexInSheet: headerRowIndex + 1 + i, row: r });
      return;
    }

    rows.push({
      jobNumber,
      deliveryType:
        columnMap.deliveryType !== undefined
          ? String(r[columnMap.deliveryType] ?? "").trim().toLowerCase() || "local"
          : "local",
      from: String(r[columnMap.from] ?? "").trim(),
      customer: String(r[columnMap.customer] ?? "").trim(),
      mileageOut: String(r[columnMap.mileageOut] ?? "").trim(),
      mileageIn: String(r[columnMap.mileageIn] ?? "").trim(),
      distance,
      cost,
      orderDate,
      contractorName:
        columnMap.contractor !== undefined
          ? String(r[columnMap.contractor] ?? "").trim()
          : null,
      sourceFile,
      sourceSheet,
    });
  });

  return { rows, dropped, columnMap, headerRowIndex, titleRowRaw: raw[0] };
}

module.exports = {
  parseSheet,
  coerceDate,
  excelSerialToDate,
  findHeaderRowIndex,
  buildColumnMap,
};
