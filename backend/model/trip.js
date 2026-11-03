const mongoose = require("mongoose");

// One whole trip/load, as written in the cross-border ledger: one row = one trip
// with its own agreed price (unlike a local Job leg, which is priced per km).
const COST_TYPES = [
  "fuel", "toll", "zinara", "border_fee", "transit_fee", "permit",
  "agent_fee", "parking", "fine", "allowance", "repairs", "other",
];
const CURRENCIES = ["USD", "ZAR", "ZWG"];
const STATUSES = ["planned", "in_transit", "delivered", "closed", "cancelled"];

const stopSchema = new mongoose.Schema(
  {
    place: { type: String, required: true, trim: true },
    country: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const costLineSchema = new mongoose.Schema({
  type: { type: String, enum: COST_TYPES, default: "other" },
  description: { type: String, default: "" },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: CURRENCIES, default: "USD" },
  date: { type: Date },
  receiptNo: { type: String, default: "" },
});

const crossingSchema = new mongoose.Schema({
  post: { type: String, required: true, trim: true },
  direction: { type: String, enum: ["in", "out"], default: "out" },
  arrivedAt: { type: Date },
  clearedAt: { type: Date },
});

const tripSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    // The client's own job reference (e.g. AL.01, "allea01"). Unique per company.
    clientRef: { type: String, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: "planned" },

    transporterName: { type: String, default: "", trim: true },
    customerName: { type: String, required: true, trim: true },
    supplierName: { type: String, default: "", trim: true },

    stops: { type: [stopSchema], default: [] },
    isCrossBorder: { type: Boolean, default: false },
    borderCrossings: { type: [crossingSchema], default: [] },

    cargoDescription: { type: String, default: "", trim: true },
    containerNo: { type: String, default: "", trim: true },
    consignmentNo: { type: String, default: "", trim: true },

    distanceKm: { type: Number, min: 0 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: "USD" },

    horseId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    trailerId: { type: mongoose.Schema.Types.ObjectId, ref: "Trailer" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "driver" },
    deliveredAt: { type: Date },

    costLines: { type: [costLineSchema], default: [] },
    // set when a trip is on an issued invoice, so it can't be billed twice
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    notes: { type: String, default: "" },
    source: { type: String, default: "manual" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

tripSchema.index({ tenantId: 1, date: -1 });
// a clientRef, when given, is unique within the company
tripSchema.index(
  { tenantId: 1, clientRef: 1 },
  { unique: true, partialFilterExpression: { clientRef: { $type: "string", $gt: "" } } }
);

const Trip = mongoose.model("Trip", tripSchema);
Trip.COST_TYPES = COST_TYPES;
Trip.CURRENCIES = CURRENCIES;
Trip.STATUSES = STATUSES;
module.exports = Trip;
