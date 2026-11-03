const mongoose = require("mongoose");

const lineSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 1, min: 0 },
  unitPriceCents: { type: Number, required: true, min: 0 },
  amountCents: { type: Number, required: true, min: 0 },
});

// A price offer sent before the work. When accepted it becomes an invoice draft.
const quotationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    number: { type: String },
    status: { type: String, enum: ["draft", "sent", "accepted", "rejected"], default: "draft" },
    customerName: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    validUntil: { type: Date },
    currency: { type: String, enum: ["USD", "ZAR", "ZWG"], default: "USD" },
    // e.g. "Harare to Johannesburg, 30t fertilizer"
    subject: { type: String, default: "", trim: true },
    lines: { type: [lineSchema], default: [] },
    taxRatePct: { type: Number, default: 0, min: 0, max: 100 },
    subtotalCents: { type: Number, default: 0 },
    taxCents: { type: Number, default: 0 },
    totalCents: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

quotationSchema.index({ tenantId: 1, issueDate: -1 });
quotationSchema.index(
  { tenantId: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } }
);

module.exports = mongoose.model("Quotation", quotationSchema);
