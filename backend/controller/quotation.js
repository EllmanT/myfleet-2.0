const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireFinance } = require("../middleware/financeAccess");
const { requireModule } = require("../middleware/moduleAccess");
const { escapeRegex } = require("../utils/escapeRegex");
const { fromCents } = require("../utils/money");
const { streamDocumentPdf } = require("../utils/documentPdf");
const { nextNumber } = require("../services/documentNumber");
const { text, toDate, cleanLines, computeTotals, presentInvoice } = require("../services/invoicing");
const Quotation = require("../model/quotation");
const Invoice = require("../model/invoice");
const Deliverer = require("../model/deliverer");
const router = express.Router();

const guard = [isAuthenticated, requireFinance, requireModule("quotations")];
const DAY = 24 * 60 * 60 * 1000;

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

const present = (q) => {
  const o = typeof q.toObject === "function" ? q.toObject() : q;
  const expired = o.status === "sent" && o.validUntil && new Date(o.validUntil).getTime() < Date.now() - 0;
  return {
    _id: o._id, number: o.number, status: o.status, expired: Boolean(expired),
    customerName: o.customerName, issueDate: o.issueDate, validUntil: o.validUntil,
    currency: o.currency, subject: o.subject, taxRatePct: o.taxRatePct, notes: o.notes, terms: o.terms,
    invoiceId: o.invoiceId,
    lines: (o.lines || []).map((l) => ({ _id: l._id, description: l.description, quantity: l.quantity, unitPrice: fromCents(l.unitPriceCents), amount: fromCents(l.amountCents) })),
    subtotal: fromCents(o.subtotalCents), tax: fromCents(o.taxCents), total: fromCents(o.totalCents),
  };
};

const findMine = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ErrorHandler("Invalid id", 400);
  const q = await Quotation.findOne({ _id: req.params.id, tenantId: req.user.companyId });
  if (!q) throw new ErrorHandler("Quotation not found", 404);
  return q;
};

async function applyBody(q, body, user) {
  const customerName = text(body.customerName, 120);
  if (!customerName) throw new ErrorHandler("Customer is required", 400);
  const issueDate = toDate(body.issueDate) || new Date();
  const validUntil = body.validUntil ? toDate(body.validUntil) : new Date(issueDate.getTime() + 14 * DAY);
  if (body.validUntil && !validUntil) throw new ErrorHandler("Valid-until date is not valid", 400);
  if (validUntil < issueDate) throw new ErrorHandler("Valid-until can't be before the quotation date", 400);
  const taxRatePct = body.taxRatePct === undefined || body.taxRatePct === "" ? 0 : Number(body.taxRatePct);
  if (!Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) throw new ErrorHandler("Tax rate must be between 0 and 100", 400);

  q.customerName = customerName;
  q.issueDate = issueDate;
  q.validUntil = validUntil;
  q.currency = ["USD", "ZAR", "ZWG"].includes(body.currency) ? body.currency : "USD";
  q.subject = text(body.subject, 200);
  q.taxRatePct = taxRatePct;
  q.notes = text(body.notes, 2000);
  q.terms = text(body.terms, 2000);
  q.lines = (await cleanLines(body.lines, user)).map(({ tripId, jobId, ...line }) => line); // quotes don't bill trips
  Object.assign(q, computeTotals(q.lines, taxRatePct));
}

router.post(
  "/create-quotation",
  ...guard,
  handle(async (req, res) => {
    const q = new Quotation({ tenantId: req.user.companyId, createdBy: req.user._id });
    await applyBody(q, req.body, req.user);
    // numbered at creation: a quotation is sent to a customer, so it needs a reference
    q.number = await nextNumber(req.user.companyId, "quotation");
    await q.save();
    res.status(201).json({ success: true, quotation: present(q) });
  })
);

router.get(
  "/get-quotations",
  ...guard,
  handle(async (req, res) => {
    const { status, customer } = req.query;
    const q = { tenantId: req.user.companyId };
    if (["draft", "sent", "accepted", "rejected"].includes(status)) q.status = status;
    if (customer) q.customerName = new RegExp(escapeRegex(String(customer).trim().slice(0, 80)), "i");
    const rows = (await Quotation.find(q).sort({ issueDate: -1, _id: -1 }).limit(1000)).map(present);
    res.status(200).json({ success: true, quotations: rows.map(({ lines, ...rest }) => rest) });
  })
);

router.get(
  "/get-quotation/:id",
  ...guard,
  handle(async (req, res) => {
    res.status(200).json({ success: true, quotation: present(await findMine(req)) });
  })
);

router.put(
  "/update-quotation/:id",
  ...guard,
  handle(async (req, res) => {
    const q = await findMine(req);
    if (["accepted", "rejected"].includes(q.status)) throw new ErrorHandler(`A ${q.status} quotation can't be changed`, 409);
    await applyBody(q, { ...present(q), ...req.body }, req.user);
    await q.save();
    res.status(200).json({ success: true, quotation: present(q) });
  })
);

router.post(
  "/set-status/:id",
  ...guard,
  handle(async (req, res) => {
    const q = await findMine(req);
    const next = req.body.status;
    const allowed = { draft: ["sent"], sent: ["accepted", "rejected", "draft"], rejected: ["sent"], accepted: [] };
    if (!(allowed[q.status] || []).includes(next)) throw new ErrorHandler(`A ${q.status} quotation can't be marked ${next}`, 409);
    q.status = next;
    await q.save();
    res.status(200).json({ success: true, quotation: present(q) });
  })
);

// Turns an accepted quotation into an invoice draft with the same lines.
router.post(
  "/convert/:id",
  ...guard,
  handle(async (req, res) => {
    const q = await findMine(req);
    if (q.status !== "accepted") throw new ErrorHandler("Mark the quotation as accepted first", 409);
    if (q.invoiceId) throw new ErrorHandler("This quotation already has an invoice", 409);
    const inv = new Invoice({ tenantId: req.user.companyId, createdBy: req.user._id, quotationId: q._id });
    await applyBody(inv, {
      customerName: q.customerName, currency: q.currency, taxRatePct: q.taxRatePct,
      lines: q.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
      notes: q.subject ? `Quotation ${q.number}: ${q.subject}` : `Quotation ${q.number}`,
    }, req.user);
    // applyBody reads unitPrice in dollars; keep exact cents from the quotation
    inv.lines.forEach((line, i) => { line.unitPriceCents = q.lines[i].unitPriceCents; line.amountCents = q.lines[i].amountCents; });
    Object.assign(inv, computeTotals(inv.lines, q.taxRatePct));
    await inv.save();
    q.invoiceId = inv._id;
    await q.save();
    res.status(201).json({ success: true, invoice: presentInvoice(inv), quotation: present(q) });
  })
);

router.delete(
  "/delete-quotation/:id",
  ...guard,
  handle(async (req, res) => {
    const q = await findMine(req);
    if (q.invoiceId) throw new ErrorHandler("This quotation has an invoice, so it can't be deleted", 409);
    await q.deleteOne();
    res.status(200).json({ success: true, message: "Quotation deleted" });
  })
);

router.get(
  "/pdf/:id",
  ...guard,
  handle(async (req, res) => {
    const q = await findMine(req);
    const company = await Deliverer.findById(req.user.companyId).select("companyName address city contact").lean();
    streamDocumentPdf(res, { kind: "Quotation", doc: present(q), company, filename: `${q.number}.pdf` });
  })
);

module.exports = router;
