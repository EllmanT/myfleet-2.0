/**
 * One-off conversion of the two Iveco AEX PDF job reports (the only source
 * data for that vehicle) into .xlsx files matching the same column layout
 * used by every other file in `all jobs 2025 to 2026`, so they flow through
 * the same importer. Row data below was transcribed directly from the PDFs.
 */
const path = require("path");
const XLSX = require("xlsx");
const { SOURCE_ROOT } = require("./fileManifest");

// [jobNumber, deliveryType, from, customer, mileageOut, mileageIn, distance, cost, date(dd/mm/yyyy)]
const JAN_2025_ROWS = [
  ["LM0390", "local", "Lammel", "ZW Wardrobe", 416160, 416163, 3, 8.85, "06/01/2025"],
  ["LM0390", "local", "ZW Wardrobe", "Lammel", 416163, 416165, 2, 5.9, "06/01/2025"],
  ["LM0391", "local", "Lammel", "Revolve Kelvin", 416165, 416181, 16, 47.2, "06/01/2025"],
  ["LM0391", "local", "Revolve Kelvin", "Lammel", 416181, 416197, 16, 47.2, "06/01/2025"],
  ["LM0392", "local", "Lammel", "Boardex", 416206, 416211, 5, 14.75, "07/01/2025"],
  ["LM0392", "local", "Boardex", "Lammel", 416211, 416217, 6, 17.7, "07/01/2025"],
  ["LM0393", "local", "Lammel", "Unifit", 416217, 416221, 4, 11.8, "07/01/2025"],
  ["LM0393", "local", "Unifit", "Lammel", 416221, 416225, 4, 11.8, "07/01/2025"],
  ["RK0571", "local", "Lammel", "Millenium", 416234, 416251, 17, 50.15, "08/01/2025"],
  ["RK0571", "local", "Millenium", "Lammel", 416251, 416269, 18, 53.1, "08/01/2025"],
  ["LM0394", "local", "Lammel", "Mrs Stoole", 416269, 416288, 19, 56.05, "08/01/2025"],
  ["LM0394", "local", "Mrs Stoole", "Pomona Dump", 416288, 416293, 5, 14.75, "08/01/2025"],
  ["LM0394", "local", "Pomona Dump", "Lammel", 416293, 416314, 21, 61.95, "08/01/2025"],
  ["LM0395", "local", "Millenium", "WestPro", 416417, 416422, 5, 14.75, "08/01/2025"],
  ["LM0395", "local", "WestPro", "Lammel", 416422, 416440, 18, 53.1, "08/01/2025"],
  ["UF0094", "local", "Lammel", "U Furn", 416331, 416356, 25, 73.75, "10/01/2025"],
  ["UF0094", "local", "U Furn", "Lammel", 416356, 416386, 30, 88.5, "10/01/2025"],
  ["UF0095", "local", "Lammel", "U Furn", 416331, 416356, 25, 73.75, "10/01/2025"],
  ["UF0095", "local", "U Furn", "Lammel", 416356, 416386, 30, 88.5, "10/01/2025"],
  ["RK0572", "local", "Lammel", "RDC", 416394, 416397, 3, 8.85, "10/01/2025"],
  ["RK0572", "local", "RDC", "Mrs Cohen", 416397, 416410, 13, 38.35, "10/01/2025"],
  ["RK0572", "local", "Mrs Cohen", "Millenium", 416410, 416417, 7, 20.65, "10/01/2025"],
  ["LM0396", "local", "Lammel", "WestPro", 416440, 416460, 20, 59, "14/01/2025"],
  ["LM0396", "local", "WestPro", "Shippy", 416460, 416477, 17, 50.15, "14/01/2025"],
  ["LM0397", "local", "Lammel", "Chinondo", 416482, 416493, 11, 32.45, "15/01/2025"],
  ["LM0397", "local", "Chinondo", "Romeo Kitchens", 416493, 416500, 7, 20.65, "15/01/2025"],
  ["LM0397", "local", "Romeo Kitchens", "Lammel", 416500, 416516, 16, 47.2, "15/01/2025"],
  ["LM0398", "local", "Lammel", "WestPro", 416516, 416534, 18, 53.1, "16/01/2025"],
  ["LM0398", "local", "WestPro", "Lammel", 416534, 416553, 19, 56.05, "16/01/2025"],
  ["LM0399", "local", "Lammel", "WestPro", 416553, 416571, 18, 53.1, "16/01/2025"],
  ["LM0399", "local", "WestPro", "Lammel", 416571, 416589, 18, 53.1, "16/01/2025"],
  ["RK0573", "local", "Lammel", "Chinondo", 416594, 416611, 17, 50.15, "17/01/2025"],
  ["RK0573", "local", "Chinondo", "Lammel", 416611, 416623, 12, 35.4, "17/01/2025"],
  ["UF0096", "local", "Lammel", "U Furn", 416623, 416648, 25, 73.75, "17/01/2025"],
  ["UF0096", "local", "U Furn", "Shippy", 416648, 416671, 23, 67.85, "17/01/2025"],
  ["BH0384", "local", "Lammel", "Baker Tilly", 416676, 416690, 14, 41.3, "18/01/2025"],
  ["UF0097", "local", "Baker Tilly", "U Furn", 416690, 416715, 25, 73.75, "18/01/2025"],
  ["UF0097", "local", "U Furn", "Shippy", 416715, 416742, 27, 79.65, "18/01/2025"],
  ["RK0576", "local", "Lammel", "Chinondo", 416755, 416768, 13, 38.35, "21/01/2025"],
  ["RK0576", "local", "Chinondo", "Lammel", 416768, 416779, 11, 32.45, "21/01/2025"],
  ["RK0577", "local", "Lammel", "Chinondo", 416801, 416812, 11, 32.45, "22/01/2025"],
  ["RK0577", "local", "Chinondo", "Lammel", 416812, 416824, 12, 35.4, "22/01/2025"],
  ["RK0578", "local", "Lammel", "Chinondo", 416824, 416835, 11, 32.45, "22/01/2025"],
  ["RK0578", "local", "Chinondo", "Lammel", 416835, 416846, 11, 32.45, "22/01/2025"],
  ["UF0098", "local", "Lammel", "Madokero", 416884, 416908, 24, 70.8, "23/01/2025"],
  ["UF0098", "local", "Madokero", "Lammel", 416908, 416933, 25, 73.75, "23/01/2025"],
  ["RK0579", "local", "Lammel", "Chinondo", 416933, 416944, 11, 32.45, "23/01/2025"],
  ["RK0579", "local", "Chinondo", "Shippy", 416944, 416954, 10, 29.5, "23/01/2025"],
  ["RK0580", "local", "Lammel", "Chop Chop", 416958, 416982, 24, 70.8, "24/01/2025"],
  ["RK0580", "local", "Chop Chop", "Lammel", 416982, 417007, 25, 73.75, "24/01/2025"],
  ["UF0099", "local", "Lammel", "Madokero", 417007, 417033, 26, 76.7, "24/01/2025"],
  ["UF0099", "local", "Madokero", "Lammel", 417033, 417061, 28, 82.6, "24/01/2025"],
  ["LM0429", "local", "Lammel", "Ruwa TM", 417065, 417080, 15, 44.25, "24/01/2025"],
  ["LM0429", "local", "Ruwa TM", "Lammel", 417080, 417095, 15, 44.25, "24/01/2025"],
  ["LM0408", "local", "Lammel", "West Property", 417099, 417118, 19, 56.05, "26/01/2025"],
  ["LM0408", "local", "West Property", "Lammel", 417118, 417137, 19, 56.05, "26/01/2025"],
  ["RK0584", "local", "Lammel", "Fairline Investments", 417166, 417173, 7, 20.65, "27/01/2025"],
  ["RK0584", "local", "Fairline Investments", "Lammel", 417173, 417180, 7, 20.65, "27/01/2025"],
  ["RK0585", "local", "Lammel", "Fairline Investments", 417304, 417311, 7, 20.65, "31/01/2025"],
  ["RK0585", "local", "Fairline Investments", "Lammel", 417311, 417319, 8, 23.6, "31/01/2025"],
  ["UF0100", "local", "Lammel", "Madokero", 417319, 417345, 26, 76.7, "31/01/2025"],
  ["UF0100", "local", "Madokero", "Shippy", 417345, 417373, 28, 82.6, "31/01/2025"],
];

const FEB_2025_ROWS = [
  ["RK0622", "local", "Lammel", "Garden Estate", 417505, 417539, 34, 100.3, "03/02/2025"],
  ["RK0622", "local", "Garden Estate", "Lammel", 417539, 417571, 32, 94.4, "03/02/2025"],
];

const DECLARED = {
  jan: { jobs: 62, dist: 942, cost: 2867.4 },
  feb: { jobs: 2, dist: 66, cost: 194.7 },
};

function buildSheetRows(vehicleLabel, periodLabel, dataRows) {
  const distSum = dataRows.reduce((s, r) => s + r[6], 0);
  const costSum = Math.round(dataRows.reduce((s, r) => s + r[7], 0) * 100) / 100;
  const titleRow = [
    vehicleLabel,
    "",
    periodLabel,
    "",
    `JOBS: ${dataRows.length}`,
    "",
    `DIST: ${distSum}KM`,
    "",
    `COST: $${costSum.toFixed(2)}`,
  ];
  const blankRow = ["", "", "", "", "", "", "", "", ""];
  const headerRow = ["J/N", "D/T", "From", "Customer", "Out", "In", "Dist", "Cost", "Job Date"];
  return { aoa: [titleRow, blankRow, headerRow, ...dataRows], distSum, costSum };
}

function writeWorkbook(outPath, vehicleLabel, periodLabel, dataRows, declared) {
  const { aoa, distSum, costSum } = buildSheetRows(vehicleLabel, periodLabel, dataRows);
  // Cost is the strict integrity check (every row's cost = dist * fixed local
  // rate, so a mismatch here means a genuine transcription error). Distance
  // vs. the PDF's printed header is a soft check only: several source files
  // in this corpus have a stale/wrong header DIST figure while the row-level
  // data (and its matching cost) is correct — same rule as the rest of the
  // import: trust row data, not the printed summary line.
  if (costSum !== declared.cost) {
    throw new Error(
      `Transcription mismatch for ${outPath}: computed cost=${costSum} vs declared cost=${declared.cost}`
    );
  }
  if (distSum !== declared.dist) {
    console.warn(
      `NOTE: ${outPath} row-level distance (${distSum}KM) differs from the PDF's printed header (${declared.dist}KM); trusting row-level data.`
    );
  }
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Iveco AEX");
  XLSX.writeFile(wb, outPath);
  console.log(`Wrote ${outPath} (${dataRows.length} rows, ${distSum}KM, $${costSum.toFixed(2)})`);
}

function run() {
  const janPath = path.join(SOURCE_ROOT, "2025-jobs", "IVECO AEX JAN 2025.xlsx");
  const febPath = path.join(SOURCE_ROOT, "2025-jobs", "IVECO AEX FEB 2025.xlsx");
  writeWorkbook(janPath, "IVECO AEX", "Jan-25", JAN_2025_ROWS, DECLARED.jan);
  writeWorkbook(febPath, "IVECO AEX", "Feb-25", FEB_2025_ROWS, DECLARED.feb);
}

if (require.main === module) {
  run();
}

module.exports = { run };
