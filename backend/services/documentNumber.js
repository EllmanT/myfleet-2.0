const Counter = require("../model/counter");

const PREFIX = { invoice: "INV", quotation: "QUO", creditNote: "CN" };

// Atomically takes the next number for a company, e.g. INV-0007. Numbers are only
// taken when a document is issued, so issued numbers have no gaps.
async function nextNumber(tenantId, series) {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, series },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${PREFIX[series] || series.toUpperCase()}-${String(counter.value).padStart(4, "0")}`;
}

module.exports = { nextNumber };
