const mongoose = require("mongoose");

// A purchase order RECEIVED from a client ("carry these goods to this place for this price").
// Everything except the client and the date is optional: orders are often given by word of
// mouth, and a PO can be captured later, when the paperwork turns up.
const CURRENCIES = ["USD", "ZAR", "ZWG"];

const stopSchema = new mongoose.Schema(
  {
    place: { type: String, required: true, trim: true },
    country: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    // the client's own PO number; blank when it was word of mouth
    poNumber: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["open", "done"], default: "open" },
    description: { type: String, default: "", trim: true }, // what is to be carried
    stops: { type: [stopSchema], default: [] },
    price: { type: Number, min: 0 }, // agreed price per trip, optional
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    notes: { type: String, default: "" },
    // stored-file key of the photo / PDF of the original
    document: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, date: -1 });
// a PO number, when given, is unique per client within the company
purchaseOrderSchema.index(
  { tenantId: 1, customerName: 1, poNumber: 1 },
  { unique: true, partialFilterExpression: { poNumber: { $type: "string", $gt: "" } } }
);

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
PurchaseOrder.CURRENCIES = CURRENCIES;
module.exports = PurchaseOrder;
