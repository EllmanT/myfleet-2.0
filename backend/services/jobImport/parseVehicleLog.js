const XLSX = require("xlsx");

// Parses a per-vehicle log workbook (one row per leg) into plain rows.
// Pure: no DB access. Layout is detected by header names, not positions,
// so columns can be reordered or added without code changes.
//
// Expected per sheet: a title row somewhere above the header carrying the
// vehicle reg (e.g. "TOYOTA DYNA – AAV 4331"), a header row, then one row
// per leg, optionally ending with a TOTAL row.

const HEADER_SCAN_ROWS = 20;

// Order matters: first matching field wins for a header cell.
const COLUMN_MATCHERS = [
  ["mileageOut", /^(mileage|odometer|km)out$|^out$/],
  ["mileageIn", /^(mileage|odometer|km)in$|^in$/],
  ["totalKm", /^(total)?(km|kms|distance|dist)$/],
  ["contractor", /^contractor/],
  ["authorisedBy", /^authori[sz]ed(by)?$/],
  ["type", /^(job|delivery)?type$|^dt$/],
  ["driver", /^driver/],
  ["date", /^(job|order)?date$/],
  ["from", /^from$/],
  ["to", /^(to|destination|customer)$/],
];

const REQUIRED_COLUMNS = ["date", "mileageOut", "mileageIn", "from", "to"];

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function findHeader(rows) {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS);
  for (let index = 0; index < limit; index += 1) {
    const columnMap = {};
    (rows[index] || []).forEach((cell, col) => {
      const key = normalizeHeader(cell);
      if (!key) return;
      const match = COLUMN_MATCHERS.find(([, pattern]) => pattern.test(key));
      if (match && columnMap[match[0]] === undefined) {
        columnMap[match[0]] = col;
      }
    });
    if (REQUIRED_COLUMNS.every((field) => columnMap[field] !== undefined)) {
      return { headerRowIndex: index, columnMap };
    }
  }
  return null;
}

// Zimbabwe-style plates: three letters + four digits, with optional
// spaces/dashes between ("AAV 4331", "AAV-4331", "AAV4331").
const REG_PATTERN = /\b([A-Z]{3})[\s-]*(\d{4})\b/;

function extractRegNumber(text) {
  const match = REG_PATTERN.exec(String(text || "").toUpperCase());
  return match ? `${match[1]}${match[2]}` : null;
}

function normalizeRegNumber(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function excelSerialToUtcDate(serial) {
  const days = Math.floor(serial) - 25569;
  return new Date(days * 86400 * 1000);
}

// Returns a Date at UTC midnight for the calendar day, or null.
function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToUtcDate(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    );
  }
  const text = cleanText(value);
  let match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
  }
  match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTotalRow(row) {
  return row.some((cell) => /^total$/i.test(cleanText(cell)));
}

function isEmptyRow(row) {
  return row.every((cell) => cleanText(cell) === "");
}

function parseSheet(sheet, { sheetName, fileName }) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });

  const header = findHeader(rawRows);
  if (!header) {
    return {
      sheetName,
      skipped: true,
      reason: "Not a vehicle log (no Date / Mileage Out / Mileage In / From / To header)",
      rows: [],
    };
  }

  const { headerRowIndex, columnMap } = header;

  // Prefer an explicit Contractor column; fall back to Authorised By.
  const contractorCol =
    columnMap.contractor !== undefined ? columnMap.contractor : columnMap.authorisedBy;

  const titleText = rawRows
    .slice(0, headerRowIndex)
    .map((row) => (row || []).map(cleanText).join(" "))
    .join(" ");
  // Multi-vehicle workbooks: title row first, then the sheet tab name.
  const regNumber =
    extractRegNumber(titleText) ||
    extractRegNumber(sheetName) ||
    extractRegNumber(fileName);

  const cell = (row, field) =>
    columnMap[field] === undefined ? null : row[columnMap[field]];

  const rows = [];
  let lastDriver = "";
  let lastDate = null;

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const row = rawRows[index] || [];
    if (isEmptyRow(row)) continue;
    if (isTotalRow(row)) break;

    const warnings = [];
    let driverName = cleanText(cell(row, "driver"));
    let date = parseDate(cell(row, "date"));

    // Logs often leave driver/date blank on follow-on rows of the same day.
    if (!driverName && lastDriver) {
      driverName = lastDriver;
      warnings.push("Driver blank — carried over from the row above");
    }
    if (!date && lastDate && cleanText(cell(row, "date")) === "") {
      date = lastDate;
      warnings.push("Date blank — carried over from the row above");
    }
    if (driverName) lastDriver = driverName;
    if (date) lastDate = date;

    const mileageOut = parseNumber(cell(row, "mileageOut"));
    const mileageIn = parseNumber(cell(row, "mileageIn"));
    const totalKm = parseNumber(cell(row, "totalKm"));

    rows.push({
      rowNumber: index + 1,
      driverName,
      date,
      mileageOut,
      mileageIn,
      totalKm,
      from: cleanText(cell(row, "from")),
      to: cleanText(cell(row, "to")),
      contractorRaw: contractorCol === undefined ? "" : cleanText(row[contractorCol]),
      typeRaw: cleanText(cell(row, "type")),
      warnings,
    });
  }

  return {
    sheetName,
    skipped: false,
    regNumber,
    title:
      rawRows
        .slice(0, headerRowIndex)
        .map((row) => (row || []).map(cleanText).filter(Boolean).join(" "))
        .find(Boolean) || sheetName,
    columns: Object.keys(columnMap),
    contractorColumn:
      columnMap.contractor !== undefined
        ? "Contractor"
        : columnMap.authorisedBy !== undefined
        ? "Authorised By"
        : null,
    rows,
  };
}

function parseVehicleLog(buffer, fileName = "") {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheets = workbook.SheetNames.map((sheetName) =>
    parseSheet(workbook.Sheets[sheetName], { sheetName, fileName })
  );
  return { fileName, sheets };
}

module.exports = {
  parseVehicleLog,
  parseDate,
  parseNumber,
  extractRegNumber,
  normalizeRegNumber,
};
