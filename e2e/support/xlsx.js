// Builds vehicle-log workbooks for the Excel import specs (xlsx comes from backend/node_modules).
const path = require("path");
const Module = require("module");
const breq = Module.createRequire(path.resolve(__dirname, "..", "..", "backend", "package.json"));
const XLSX = breq("xlsx");

const HEADER = ["Driver", "Date", "Time Out", "Mileage Out", "From", "To", "Mileage In", "Time In", "Total KM", "Contractor", "Type"];

// The sample workbook from docs/qa/TEST_DATA.md section 5, row by row.
const SAMPLE_ROWS = [
  ["Tendai", "05/01/2026", "07:00", 1000, "Depot", "Delta Mining", 1050, "08:00", 50, "Lammel QA", ""],
  ["", "", "08:10", 1050, "Delta Mining", "Depot", 1100, "09:00", 50, "Lammel QA", ""],
  ["Tendai", "05/01/2026", "10:00", 1100, "Depot", "Beta Foods", 1130, "10:45", 30, "PVT", ""],
  ["Tendai", "06/01/2026", "07:00", 1130, "Depot", "Beta Foods", 1160, "08:00", 30, "Lammel QA", "express"],
  ["Tendai", "07/01/2026", "07:00", 1160, "Depot", "Delta Mining / Beta Foods", 1200, "09:00", 40, "Lammel QA", ""],
  ["Chipo", "08/01/2026", "07:00", 1200, "Depot", "Unknown Place XYZ", 1220, "08:00", 20, "Lammel QA", ""],
  ["Tendai", "09/01/2026", "07:00", 1220, "Depot", "Beta Foods", 1210, "08:00", 10, "Lammel QA", ""],
  ["Tendai", "09/01/2026", "09:00", 1230, "Depot", "Beta Foods", 1260, "10:00", 35, "Lammel QA", ""],
  ["", "", "", "", "", "", "", "TOTAL", "", "", ""],
  ["Ghost", "10/01/2026", "", 1300, "Depot", "Beta Foods", 1310, "", 10, "Lammel QA", ""],
];

function workbook(sheets) {
  const book = XLSX.utils.book_new();
  for (const { name, aoa } of sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

const logSheet = (name = "QAA1001", rows = SAMPLE_ROWS, title = "TOYOTA DYNA - QAA 1001") => ({
  name,
  aoa: [[title], [], HEADER, ...rows],
});

const sampleWorkbook = () => workbook([logSheet()]);

module.exports = { XLSX, HEADER, SAMPLE_ROWS, workbook, logSheet, sampleWorkbook };
