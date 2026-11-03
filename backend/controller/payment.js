const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireFinance } = require("../middleware/financeAccess");
const { requireModule } = require("../middleware/moduleAccess");
const { escapeRegex } = require("../utils/escapeRegex");
const { toCents, fromCents } = require("../utils/money");
const { paymentState } = require("../utils/invoiceMath");
const { text, toDate, recomputePaid } = require("../services/invoicing");
const Invoice = require("../model/invoice");
const Payment = require("../model/payment");
const router = express.Router();

const guard = [isAuthenticated, requireFinance, requireModule("invoices")];

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

const present = (p) => {
  const o = typeof p.toObject === "function" ? p.toObject() : p;
  const allocated = (o.allocations || []).reduce((s, a) => s + a.amountCents, 0);
  return {
    _id: o._id,
    customerName: o.customerName,
    date: o.date,
    amount: fromCents(o.amountCents),
    currency: o.currency,
    method: o.method,
    reference: o.reference,
    notes: o.notes,
    allocations: (o.allocations || []).map((a) => ({ invoiceId: a.invoiceId, amount: fromCents(a.amountCents) })),
    allocated: fromCents(allocated),
    unallocated: fromCents(o.amountCents - allocated),
  };
};

// Records money received and applies it to invoices.
//  - allocations: [{ invoiceId, amount }] applies it exactly as given, or
//  - autoAllocate + customerName applies it to that customer's oldest unpaid invoices.
// Whatever is not applied stays as credit on the customer's account.
router.post(
  "/record-payment",
  ...guard,
  handle(async (req, res, next) => {
    const tenantId = req.user.companyId;
    const amountCents = toCents(req.body.amount, "Payment amount");
    if (amountCents < 1) return next(new ErrorHandler("Payment amount must be more than 0", 400));
    const date = toDate(req.body.date) || new Date();
    const currency = ["USD", "ZAR", "ZWG"].includes(req.body.currency) ? req.body.currency : "USD";
    const method = Payment.METHODS.includes(req.body.method) ? req.body.method : "other";

    let wanted = [];
    let customerName = text(req.body.customerName, 120);

    if (Array.isArray(req.body.allocations) && req.body.allocations.length) {
      wanted = req.body.allocations.map((a) => ({ invoiceId: a.invoiceId, cents: toCents(a.amount, "Allocation") }));
    } else if (req.body.autoAllocate) {
      if (!customerName) return next(new ErrorHandler("Choose the customer", 400));
      const open = (await Invoice.find({ tenantId, status: "issued", customerName, currency }).sort({ issueDate: 1, _id: 1 }))
        .map((inv) => ({ inv, st: paymentState(inv) }))
        .filter((x) => x.st.balanceCents > 0);
      let left = amountCents;
      for (const { inv, st } of open) {
        if (left <= 0) break;
        const take = Math.min(left, st.balanceCents);
        wanted.push({ invoiceId: String(inv._id), cents: take });
        left -= take;
      }
    }

    const allocations = [];
    const seen = new Set();
    let total = 0;
    for (const w of wanted) {
      if (!mongoose.isValidObjectId(w.invoiceId)) throw new ErrorHandler("Invalid invoice", 400);
      if (seen.has(String(w.invoiceId))) throw new ErrorHandler("An invoice can only be listed once per payment", 400);
      seen.add(String(w.invoiceId));
      if (w.cents < 1) continue;
      const inv = await Invoice.findOne({ _id: w.invoiceId, tenantId });
      if (!inv) throw new ErrorHandler("Invoice not found", 404);
      if (inv.status !== "issued") throw new ErrorHandler(`${inv.number || "A draft invoice"} can't take payments (it is ${inv.status})`, 409);
      if (inv.currency !== currency) throw new ErrorHandler(`${inv.number} is in ${inv.currency}. Record the payment in ${inv.currency}.`, 400);
      const { balanceCents } = paymentState(inv);
      if (w.cents > balanceCents) throw new ErrorHandler(`${inv.number} only has ${fromCents(balanceCents).toFixed(2)} outstanding`, 400);
      if (!customerName) customerName = inv.customerName;
      allocations.push({ invoiceId: inv._id, amountCents: w.cents });
      total += w.cents;
    }
    if (total > amountCents) throw new ErrorHandler("The invoices add up to more than the payment", 400);
    if (!customerName) throw new ErrorHandler("Choose the customer this payment is from", 400);

    const payment = await Payment.create({
      tenantId, customerName, date, amountCents, currency, method,
      reference: text(req.body.reference, 80), notes: text(req.body.notes, 500),
      allocations, createdBy: req.user._id,
    });
    await recomputePaid(tenantId, allocations.map((a) => a.invoiceId));
    res.status(201).json({ success: true, payment: present(payment) });
  })
);

router.get(
  "/get-payments",
  ...guard,
  handle(async (req, res) => {
    const { customer, from, to } = req.query;
    const q = { tenantId: req.user.companyId };
    if (customer) q.customerName = new RegExp(escapeRegex(String(customer).trim().slice(0, 80)), "i");
    if (toDate(from) || toDate(to)) {
      q.date = {};
      if (toDate(from)) q.date.$gte = toDate(from);
      if (toDate(to)) q.date.$lte = toDate(to);
    }
    const payments = await Payment.find(q).sort({ date: -1, _id: -1 }).limit(1000).lean();
    const numbers = new Map(
      (await Invoice.find({ _id: { $in: payments.flatMap((p) => p.allocations.map((a) => a.invoiceId)) } }).select("number").lean()).map((i) => [String(i._id), i.number])
    );
    res.status(200).json({
      success: true,
      payments: payments.map((p) => ({
        ...present(p),
        allocations: p.allocations.map((a) => ({ invoiceId: a.invoiceId, invoiceNumber: numbers.get(String(a.invoiceId)) || "", amount: fromCents(a.amountCents) })),
      })),
    });
  })
);

// Removing a payment puts the money back on the invoices it was applied to.
router.delete(
  "/delete-payment/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const removed = await Payment.findOneAndDelete({ _id: req.params.id, tenantId: req.user.companyId });
    if (!removed) return next(new ErrorHandler("Payment not found", 404));
    await recomputePaid(req.user.companyId, removed.allocations.map((a) => a.invoiceId));
    res.status(200).json({ success: true, message: "Payment deleted" });
  })
);

module.exports = router;
