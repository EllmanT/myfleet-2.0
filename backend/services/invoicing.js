const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const { toCents, fromCents } = require("../utils/money");
const { computeTotals, lineAmount, paymentState } = require("../utils/invoiceMath");
const Invoice = require("../model/invoice");
const Payment = require("../model/payment");
const Trip = require("../model/trip");
const Job = require("../model/job");
const { companyOwns } = require("../middleware/tenantAccess");

const text = (v, max = 300) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Checks lines from the request and returns clean lines (amounts in cents).
// A line that names a trip or job must name one that belongs to the caller.
async function cleanLines(rawLines, user) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new ErrorHandler("Add at least one line", 400);
  }
  if (rawLines.length > 1000) throw new ErrorHandler("Too many lines", 400);
  const lines = [];
  for (const [i, l] of rawLines.entries()) {
    const description = text(l && l.description);
    if (!description) throw new ErrorHandler(`Line ${i + 1} needs a description`, 400);
    const quantity = l.quantity === undefined || l.quantity === "" ? 1 : Number(l.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw new ErrorHandler(`Line ${i + 1} quantity is not valid`, 400);
    const unitPriceCents = toCents(l.unitPrice !== undefined ? l.unitPrice : fromCents(l.unitPriceCents), `Line ${i + 1} price`);
    const line = { description, quantity, unitPriceCents, amountCents: lineAmount(quantity, unitPriceCents) };
    if (l.tripId) {
      if (!mongoose.isValidObjectId(l.tripId) || !(await Trip.exists({ _id: l.tripId, tenantId: user.companyId }))) {
        throw new ErrorHandler(`Line ${i + 1}: trip not found for your company`, 404);
      }
      line.tripId = l.tripId;
    }
    if (l.jobId) {
      const owned = await ownsJob(user, l.jobId);
      if (!owned) throw new ErrorHandler(`Line ${i + 1}: job not found for your company`, 404);
      line.jobId = l.jobId;
    }
    lines.push(line);
  }
  return lines;
}

// A job belongs to the company when it was driven by one of its vehicles.
async function companyVehicleIds(user) {
  const Vehicle = require("../model/vehicle");
  const Deliverer = require("../model/deliverer");
  const company = await Deliverer.findById(user.companyId).select("vehicle_ids").lean();
  const stamped = await Vehicle.find({ tenantId: user.companyId }).select("_id").lean();
  return [...new Set([...(company.vehicle_ids || []).map(String), ...stamped.map((v) => String(v._id))])];
}

async function ownsJob(user, jobId) {
  if (!mongoose.isValidObjectId(jobId)) return false;
  if (await Job.exists({ _id: jobId, tenantId: user.companyId })) return true;
  const job = await Job.findById(jobId).select("vehicleId").lean();
  if (!job || !job.vehicleId) return false;
  return companyOwns(user, "vehicle_ids", job.vehicleId);
}

// Customer-facing shape: dollars, plus what is owed and whether it is late.
function presentInvoice(inv) {
  const o = typeof inv.toObject === "function" ? inv.toObject() : inv;
  const state = paymentState(o);
  return {
    _id: o._id,
    number: o.number,
    status: o.status,
    customerName: o.customerName,
    issueDate: o.issueDate,
    dueDate: o.dueDate,
    currency: o.currency,
    taxRatePct: o.taxRatePct,
    notes: o.notes,
    terms: o.terms,
    quotationId: o.quotationId,
    voidReason: o.voidReason,
    lines: (o.lines || []).map((l) => ({
      _id: l._id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: fromCents(l.unitPriceCents),
      amount: fromCents(l.amountCents),
      tripId: l.tripId,
      jobId: l.jobId,
    })),
    subtotal: fromCents(o.subtotalCents),
    tax: fromCents(o.taxCents),
    total: fromCents(o.totalCents),
    paid: fromCents(o.paidCents),
    credits: fromCents(state.creditCents),
    balance: fromCents(state.balanceCents),
    creditNotes: (o.creditNotes || []).map((c) => ({ number: c.number, amount: fromCents(c.amountCents), reason: c.reason, date: c.date })),
    paymentStatus: state.paymentStatus,
    overdue: state.overdue,
    daysOverdue: state.daysOverdue,
  };
}

// Recalculates how much has been paid on each invoice from the payment records,
// so the stored figure can never drift from the payments themselves.
async function recomputePaid(tenantId, invoiceIds) {
  const ids = [...new Set(invoiceIds.map(String))].map((i) => new mongoose.Types.ObjectId(i));
  if (!ids.length) return;
  const sums = await Payment.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), "allocations.invoiceId": { $in: ids } } },
    { $unwind: "$allocations" },
    { $match: { "allocations.invoiceId": { $in: ids } } },
    { $group: { _id: "$allocations.invoiceId", total: { $sum: "$allocations.amountCents" } } },
  ]);
  const byId = new Map(sums.map((s) => [String(s._id), s.total]));
  await Promise.all(
    ids.map((id) => Invoice.updateOne({ _id: id, tenantId }, { $set: { paidCents: byId.get(String(id)) || 0 } }))
  );
}

module.exports = {
  text,
  toDate,
  cleanLines,
  companyVehicleIds,
  ownsJob,
  presentInvoice,
  recomputePaid,
  computeTotals,
};
