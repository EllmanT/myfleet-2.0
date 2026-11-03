const XLSX = require("xlsx");
const ErrorHandler = require("../../utils/ErrorHandler");

const HEADER = ["Driver", "Date", "Time Out", "Mileage Out", "From", "To", "Mileage In", "Time In", "Total KM", "Contractor"];

const ddmmyyyy = (iso) => {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
};

// Builds a standard vehicle-log workbook from reviewed rows, in exactly the layout
// the Excel importer already reads. That way a photo goes through the same
// preview, matching and commit steps as a spreadsheet, with no second code path.
function rowsToWorkbookBuffer({ vehicleReg, vehicleDescription, rows }) {
  const reg = String(vehicleReg || "").trim();
  if (!/^[A-Za-z]{3}\s?-?\d{4}$/.test(reg)) {
    throw new ErrorHandler("Enter the vehicle registration (three letters and four digits, e.g. AFE 5848)", 400);
  }
  if (!Array.isArray(rows) || !rows.length) throw new ErrorHandler("There are no rows to import", 400);
  if (rows.length > 500) throw new ErrorHandler("Too many rows", 400);

  const data = rows.map((r, i) => {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new ErrorHandler(`Row ${i + 1}: the date is missing or not valid`, 400);
    return [
      String(r.driver || "").trim(),
      ddmmyyyy(r.date),
      String(r.timeOut || ""),
      r.mileageOut === null || r.mileageOut === "" || r.mileageOut === undefined ? "" : Number(r.mileageOut),
      String(r.from || "").trim(),
      String(r.to || "").trim(),
      r.mileageIn === null || r.mileageIn === "" || r.mileageIn === undefined ? "" : Number(r.mileageIn),
      String(r.timeIn || ""),
      r.totalKm === null || r.totalKm === "" || r.totalKm === undefined ? "" : Number(r.totalKm),
      String(r.contractor || "").trim(),
    ];
  });

  const title = `${String(vehicleDescription || "Vehicle").trim()} - ${reg}`;
  const sheet = XLSX.utils.aoa_to_sheet([[title], [], HEADER, ...data]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, reg.replace(/\s|-/g, "").toUpperCase());
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

module.exports = { rowsToWorkbookBuffer, HEADER };
