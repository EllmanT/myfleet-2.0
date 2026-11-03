const mongoose = require("mongoose");

const CURRENCIES = ["USD", "ZAR", "ZWG"];

const lineSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 1, min: 0 },
  unitPriceCents: { type: Number, required: true, min: 0 },
  amountCents: { type: Number, required: true, min: 0 },
  // what the line bills, so the same trip or job can't be billed twice
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
});

const creditNoteSchema = new mongoose.Schema({
  number: { type: String, required: true },
  amountCents: { type: Number, required: true, min: 1 },
  reason: { type: String, default: "" },
  date: { type: Date, default: Date.now },
});

// draft: editable, no number yet. issued: locked, numbered. void: cancelled.
// Whether it is paid is worked out from payments, not stored as a status.
const invoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    number: { type: String },
    status: { type: String, enum: ["draft", "issued", "void"], default: "draft" },
    customerName: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date },
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    lines: { type: [lineSchema], default: [] },
    taxRatePct: { type: Number, default: 0, min: 0, max: 100 },
    subtotalCents: { type: Number, default: 0 },
    taxCents: { type: Number, default: 0 },
    totalCents: { type: Number, default: 0 },
    // sum of payment allocations; recomputed whenever payments change
    paidCents: { type: Number, default: 0 },
    creditNotes: { type: [creditNoteSchema], default: [] },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" },
    voidReason: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, issueDate: -1 });
invoiceSchema.index(
  { tenantId: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } }
);

const Invoice = mongoose.model("Invoice", invoiceSchema);
Invoice.CURRENCIES = CURRENCIES;
module.exports = Invoice;
