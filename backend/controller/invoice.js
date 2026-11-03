const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireFinance } = require("../middleware/financeAccess");
const { requireModule } = require("../middleware/moduleAccess");
const { companyOwns } = require("../middleware/tenantAccess");
const { escapeRegex } = require("../utils/escapeRegex");
const { toCents, fromCents } = require("../utils/money");
const { paymentState, ageBucket, startOfUtcDay } = require("../utils/invoiceMath");
const { streamDocumentPdf } = require("../utils/documentPdf");
const { nextNumber } = require("../services/documentNumber");
const {
  text, toDate, cleanLines, companyVehicleIds, presentInvoice, computeTotals,
} = require("../services/invoicing");
const Invoice = require("../model/invoice");
const Trip = require("../model/trip");
const Job = require("../model/job");
const Contractor = require("../model/contractor");
const Customer = require("../model/customer");
const Deliverer = require("../model/deliverer");
const router = express.Router();

const guard = [isAuthenticated, requireFinance, requireModule("invoices")];
const DAY = 24 * 60 * 60 * 1000;

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error && error.code === 11000) return next(new ErrorHandler("That number is already used", 409));
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

const idParam = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ErrorHandler("Invalid id", 400);
  return req.params.id;
};
const findMine = async (req, { editable = false } = {}) => {
  const inv = await Invoice.findOne({ _id: idParam(req), tenantId: req.user.companyId });
  if (!inv) throw new ErrorHandler("Invoice not found", 404);
  if (editable && inv.status !== "draft") {
    throw new ErrorHandler("Only a draft can be changed. Issued invoices are locked; use a credit note or void it.", 409);
  }
  return inv;
};

// Applies the header fields of a request to an invoice document.
async function applyBody(inv, body, user) {
  const customerName = text(body.customerName, 120);
  if (!customerName) throw new ErrorHandler("Customer is required", 400);
  const issueDate = toDate(body.issueDate) || new Date();
  const dueDate = body.dueDate ? toDate(body.dueDate) : new Date(issueDate.getTime() + 30 * DAY);
  if (body.dueDate && !dueDate) throw new ErrorHandler("Due date is not valid", 400);
  if (dueDate < issueDate) throw new ErrorHandler("Due date can't be before the invoice date", 400);
  const taxRatePct = body.taxRatePct === undefined || body.taxRatePct === "" ? 0 : Number(body.taxRatePct);
  if (!Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) throw new ErrorHandler("Tax rate must be between 0 and 100", 400);

  inv.customerName = customerName;
  inv.issueDate = issueDate;
  inv.dueDate = dueDate;
  inv.currency = Invoice.CURRENCIES.includes(body.currency) ? body.currency : "USD";
  inv.taxRatePct = taxRatePct;
  inv.notes = text(body.notes, 2000);
  inv.terms = text(body.terms, 2000);
  inv.lines = await cleanLines(body.lines, user);
  Object.assign(inv, computeTotals(inv.lines, taxRatePct));
}

// Choices for the invoice screens: who can be billed, and which trucks.
router.get(
  "/meta",
  ...guard,
  handle(async (req, res) => {
    const company = await Deliverer.findById(req.user.companyId).select("contractor_ids customer_ids vehicle_ids").lean();
    const [contractors, customers, vehicles] = await Promise.all([
      Contractor.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.contractor_ids || [] } }] }).select("companyName").sort({ companyName: 1 }).lean(),
      Customer.find({ _id: { $in: company.customer_ids || [] } }).select("name").sort({ name: 1 }).lean(),
      require("../model/vehicle").find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.vehicle_ids || [] } }] }).select("make regNumber").lean(),
    ]);
    res.status(200).json({
      success: true,
      contractors,
      vehicles,
      customers: [...new Set([...customers.map((c) => c.name), ...contractors.map((c) => c.companyName)])],
      currencies: Invoice.CURRENCIES,
    });
  })
);

router.post(
  "/create-invoice",
  ...guard,
  handle(async (req, res) => {
    const inv = new Invoice({ tenantId: req.user.companyId, createdBy: req.user._id });
    await applyBody(inv, req.body, req.user);
    await inv.save();
    res.status(201).json({ success: true, invoice: presentInvoice(inv) });
  })
);

// A draft for one contractor's unbilled jobs in a period (optionally one truck):
// the monthly invoice per truck or per client.
router.post(
  "/draft-from-jobs",
  ...guard,
  handle(async (req, res, next) => {
    const { contractorId, vehicleId } = req.body;
    const from = toDate(req.body.from);
    const to = toDate(req.body.to);
    if (!from || !to) return next(new ErrorHandler("Choose the period (from and to dates)", 400));
    if (!(await companyOwns(req.user, "contractor_ids", contractorId))) return next(new ErrorHandler("Contractor not found", 404));
    if (vehicleId && !(await companyOwns(req.user, "vehicle_ids", vehicleId))) return next(new ErrorHandler("Truck not found", 404));

    const contractor = await Contractor.findById(contractorId).select("companyName").lean();
    const vehicleIds = vehicleId ? [vehicleId] : await companyVehicleIds(req.user);
    const jobs = await Job.find({
      contractorId,
      vehicleId: { $in: vehicleIds },
      orderDate: { $gte: from, $lte: new Date(to.getTime() + DAY - 1) },
      invoiceId: { $exists: false },
    }).sort({ orderDate: 1 }).limit(1000).lean();
    if (!jobs.length) return next(new ErrorHandler("No unbilled jobs found for that contractor and period", 404));

    const places = await Customer.find({ _id: { $in: [...new Set(jobs.flatMap((j) => [String(j.from), String(j.customer)]))] } })
      .select("name").lean();
    const nameOf = new Map(places.map((p) => [String(p._id), p.name]));

    const lines = jobs.map((j) => ({
      description: `${j.jobNumber} - ${new Date(j.orderDate).toISOString().slice(0, 10)} - ${nameOf.get(String(j.from)) || "?"} to ${nameOf.get(String(j.customer)) || "?"}${j.distance ? ` (${j.distance} km)` : ""}`,
      quantity: 1,
      unitPrice: parseFloat(j.cost.toString()),
      jobId: j._id,
    }));

    const inv = new Invoice({ tenantId: req.user.companyId, createdBy: req.user._id });
    await applyBody(inv, {
      customerName: contractor.companyName,
      issueDate: req.body.issueDate,
      currency: "USD",
      lines,
      notes: `Jobs from ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
    }, req.user);
    await inv.save();
    res.status(201).json({ success: true, invoice: presentInvoice(inv), jobs: jobs.length });
  })
);

// A draft for selected trips of one client.
router.post(
  "/draft-from-trips",
  ...guard,
  handle(async (req, res, next) => {
    const ids = Array.isArray(req.body.tripIds) ? req.body.tripIds.filter((i) => mongoose.isValidObjectId(i)) : [];
    if (!ids.length) return next(new ErrorHandler("Select at least one trip", 400));
    const trips = await Trip.find({ _id: { $in: ids }, tenantId: req.user.companyId, status: { $ne: "cancelled" } }).sort({ date: 1 }).lean();
    if (trips.length !== ids.length) return next(new ErrorHandler("Some trips were not found, or are cancelled", 404));
    if (trips.some((t) => t.invoiceId)) return next(new ErrorHandler("Some of these trips are already on an invoice", 409));
    if (new Set(trips.map((t) => t.customerName)).size > 1) return next(new ErrorHandler("Pick trips for one client at a time", 400));
    if (new Set(trips.map((t) => t.currency)).size > 1) return next(new ErrorHandler("Pick trips in one currency at a time", 400));

    const lines = trips.map((t) => ({
      description: [t.clientRef, new Date(t.date).toISOString().slice(0, 10), t.stops.map((s) => s.place).join(" to "), t.cargoDescription].filter(Boolean).join(" - "),
      quantity: 1,
      unitPrice: t.price,
      tripId: t._id,
    }));
    const inv = new Invoice({ tenantId: req.user.companyId, createdBy: req.user._id });
    await applyBody(inv, { customerName: trips[0].customerName, currency: trips[0].currency, issueDate: req.body.issueDate, lines }, req.user);
    await inv.save();
    res.status(201).json({ success: true, invoice: presentInvoice(inv) });
  })
);

router.get(
  "/get-invoices",
  ...guard,
  handle(async (req, res) => {
    const { status, paymentStatus, customer, from, to } = req.query;
    const q = { tenantId: req.user.companyId };
    if (["draft", "issued", "void"].includes(status)) q.status = status;
    if (customer) q.customerName = new RegExp(escapeRegex(String(customer).trim().slice(0, 80)), "i");
    if (toDate(from) || toDate(to)) {
      q.issueDate = {};
      if (toDate(from)) q.issueDate.$gte = toDate(from);
      if (toDate(to)) q.issueDate.$lte = toDate(to);
    }
    let invoices = (await Invoice.find(q).sort({ issueDate: -1, _id: -1 }).limit(2000)).map(presentInvoice);
    if (paymentStatus === "overdue") invoices = invoices.filter((i) => i.overdue);
    else if (["unpaid", "partial", "paid"].includes(paymentStatus)) invoices = invoices.filter((i) => i.paymentStatus === paymentStatus);
    const open = invoices.filter((i) => i.status === "issued" && i.balance > 0);
    res.status(200).json({
      success: true,
      invoices: invoices.map(({ lines, ...rest }) => rest),
      outstanding: Math.round(open.reduce((s, i) => s + i.balance * 100, 0)) / 100,
      overdue: Math.round(open.filter((i) => i.overdue).reduce((s, i) => s + i.balance * 100, 0)) / 100,
    });
  })
);

router.get(
  "/get-invoice/:id",
  ...guard,
  handle(async (req, res) => {
    res.status(200).json({ success: true, invoice: presentInvoice(await findMine(req)) });
  })
);

router.put(
  "/update-invoice/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req, { editable: true });
    await applyBody(inv, { ...presentInvoice(inv), ...req.body }, req.user);
    await inv.save();
    res.status(200).json({ success: true, invoice: presentInvoice(inv) });
  })
);

router.delete(
  "/delete-invoice/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req, { editable: true });
    await inv.deleteOne();
    res.status(200).json({ success: true, message: "Draft deleted" });
  })
);

// Issuing gives the invoice its number, locks it, and marks the trips and jobs
// on it as billed so they can't go on another invoice.
router.post(
  "/issue/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req, { editable: true });
    if (!inv.lines.length) throw new ErrorHandler("Add at least one line", 400);
    if (inv.totalCents <= 0) throw new ErrorHandler("The total must be more than 0", 400);

    const tripIds = inv.lines.map((l) => l.tripId).filter(Boolean);
    const jobIds = inv.lines.map((l) => l.jobId).filter(Boolean);
    const [tripClash, jobClash] = await Promise.all([
      tripIds.length ? Trip.countDocuments({ _id: { $in: tripIds }, invoiceId: { $exists: true } }) : 0,
      jobIds.length ? Job.countDocuments({ _id: { $in: jobIds }, invoiceId: { $exists: true } }) : 0,
    ]);
    if (tripClash || jobClash) {
      throw new ErrorHandler(`${tripClash + jobClash} item(s) on this invoice are already billed on another invoice`, 409);
    }

    inv.number = await nextNumber(req.user.companyId, "invoice");
    inv.status = "issued";
    await inv.save();
    await Promise.all([
      tripIds.length ? Trip.updateMany({ _id: { $in: tripIds }, tenantId: req.user.companyId }, { $set: { invoiceId: inv._id } }) : null,
      jobIds.length ? Job.updateMany({ _id: { $in: jobIds } }, { $set: { invoiceId: inv._id } }) : null,
    ]);
    res.status(200).json({ success: true, invoice: presentInvoice(inv) });
  })
);

// An issued invoice with no payments can be voided; its trips and jobs become
// billable again. One with payments needs a credit note instead.
router.post(
  "/void/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req);
    if (inv.status !== "issued") throw new ErrorHandler("Only an issued invoice can be voided", 409);
    if (inv.paidCents > 0) throw new ErrorHandler("This invoice has payments. Delete the payments first, or issue a credit note.", 409);
    inv.status = "void";
    inv.voidReason = text(req.body.reason, 300);
    await inv.save();
    await Promise.all([
      Trip.updateMany({ invoiceId: inv._id, tenantId: req.user.companyId }, { $unset: { invoiceId: 1 } }),
      Job.updateMany({ invoiceId: inv._id }, { $unset: { invoiceId: 1 } }),
    ]);
    res.status(200).json({ success: true, invoice: presentInvoice(inv) });
  })
);

// A credit note reduces what is owed without editing the locked invoice.
router.post(
  "/credit-note/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req);
    if (inv.status !== "issued") throw new ErrorHandler("Credit notes apply to issued invoices", 409);
    const amountCents = toCents(req.body.amount, "Credit amount");
    if (amountCents < 1) throw new ErrorHandler("Credit amount must be more than 0", 400);
    const { balanceCents } = paymentState(inv);
    if (amountCents > balanceCents) throw new ErrorHandler(`A credit can't be more than the balance (${fromCents(balanceCents).toFixed(2)})`, 400);
    inv.creditNotes.push({
      number: await nextNumber(req.user.companyId, "creditNote"),
      amountCents,
      reason: text(req.body.reason, 300),
    });
    await inv.save();
    res.status(200).json({ success: true, invoice: presentInvoice(inv) });
  })
);

router.get(
  "/pdf/:id",
  ...guard,
  handle(async (req, res) => {
    const inv = await findMine(req);
    const company = await Deliverer.findById(req.user.companyId).select("companyName address city contact").lean();
    streamDocumentPdf(res, { kind: "Invoice", doc: presentInvoice(inv), company, filename: `${inv.number || "draft-invoice"}.pdf` });
  })
);

// Who owes what, grouped by customer, with how late it is.
router.get(
  "/receivables",
  ...guard,
  handle(async (req, res) => {
    const asOf = toDate(req.query.asOf) || new Date();
    const issued = await Invoice.find({ tenantId: req.user.companyId, status: "issued" }).limit(5000);
    const rows = new Map();
    const totals = {};
    for (const inv of issued) {
      const st = paymentState(inv, asOf);
      if (st.balanceCents <= 0) continue;
      const key = `${inv.customerName}|${inv.currency}`;
      const row = rows.get(key) || { customerName: inv.customerName, currency: inv.currency, invoices: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
      const bucket = ageBucket(st.daysOverdue);
      row[bucket] += st.balanceCents;
      row.total += st.balanceCents;
      row.invoices += 1;
      rows.set(key, row);
      totals[inv.currency] = (totals[inv.currency] || 0) + st.balanceCents;
    }
    const money = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ["current", "d1_30", "d31_60", "d61_90", "d90_plus", "total"].includes(k) ? fromCents(v) : v]));
    res.status(200).json({
      success: true,
      asOf,
      customers: [...rows.values()].sort((a, b) => b.total - a.total).map(money),
      totals: Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, fromCents(v)])),
    });
  })
);

// Work done but not yet invoiced: the money that is easiest to forget.
router.get(
  "/unbilled",
  ...guard,
  handle(async (req, res) => {
    const vehicleIds = (await companyVehicleIds(req.user)).map((i) => new mongoose.Types.ObjectId(i));
    const jobs = await Job.aggregate([
      { $match: { vehicleId: { $in: vehicleIds }, invoiceId: { $exists: false } } },
      { $group: {
          _id: { contractorId: "$contractorId", month: { $dateToString: { format: "%Y-%m", date: "$orderDate" } } },
          legs: { $sum: 1 },
          total: { $sum: { $toDouble: "$cost" } },
      } },
      { $sort: { "_id.month": -1 } },
      { $limit: 500 },
    ]);
    const names = new Map((await Contractor.find({ _id: { $in: jobs.map((j) => j._id.contractorId) } }).select("companyName").lean()).map((c) => [String(c._id), c.companyName]));
    const trips = await Trip.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(String(req.user.companyId)), invoiceId: { $exists: false }, status: { $ne: "cancelled" } } },
      { $group: { _id: { customerName: "$customerName", currency: "$currency" }, trips: { $sum: 1 }, total: { $sum: "$price" } } },
      { $sort: { total: -1 } },
      { $limit: 200 },
    ]);
    res.status(200).json({
      success: true,
      jobs: jobs.map((j) => ({ contractorId: j._id.contractorId, contractorName: names.get(String(j._id.contractorId)) || "(unknown)", month: j._id.month, legs: j.legs, total: Math.round(j.total * 100) / 100 })),
      trips: trips.map((t) => ({ customerName: t._id.customerName, currency: t._id.currency, trips: t.trips, total: Math.round(t.total * 100) / 100 })),
    });
  })
);

module.exports = router;
