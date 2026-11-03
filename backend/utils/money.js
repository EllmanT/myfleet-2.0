// Money is kept as whole cents so adding and splitting amounts never drifts.
const ErrorHandler = require("./ErrorHandler");

// Dollars (a number or numeric string) -> whole cents. Rejects junk and negatives.
function toCents(value, label = "Amount") {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n) || n < 0) {
    throw new ErrorHandler(`${label} must be a number of 0 or more`, 400);
  }
  return Math.round(n * 100);
}

const fromCents = (cents) => Math.round(Number(cents) || 0) / 100;

module.exports = { toCents, fromCents };
