const mongoose = require("mongoose");

const METHODS = ["cash", "ecocash", "bank", "other"];

// Money received. It is split across invoices by allocations, so one payment can
// settle several invoices and one invoice can be paid in several parts.
// Anything not allocated stays as credit on the customer's account.
const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["USD", "ZAR", "ZWG"], default: "USD" },
    method: { type: String, enum: METHODS, default: "other" },
    reference: { type: String, default: "", trim: true },
    allocations: [
      {
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
        amountCents: { type: Number, required: true, min: 1 },
        _id: false,
      },
    ],
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, date: -1 });
paymentSchema.index({ tenantId: 1, "allocations.invoiceId": 1 });

const Payment = mongoose.model("Payment", paymentSchema);
Payment.METHODS = METHODS;
module.exports = Payment;
