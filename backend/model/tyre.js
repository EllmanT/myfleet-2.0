const mongoose = require("mongoose");

// One physical tyre, tracked from purchase until it is scrapped. Where it has been
// fitted lives in TyreFitment, so a tyre can move between positions and trucks.
const tyreSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    serial: { type: String, required: true, trim: true },
    serialKey: { type: String, required: true },
    brand: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    condition: { type: String, enum: ["new", "retread", "used"], default: "new" },
    cost: { type: Number, default: 0, min: 0 },
    purchasedAt: { type: Date },
    status: { type: String, enum: ["in_stock", "fitted", "scrapped"], default: "in_stock" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);
tyreSchema.index({ tenantId: 1, serialKey: 1 }, { unique: true });

const Tyre = mongoose.model("Tyre", tyreSchema);
Tyre.toKey = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
module.exports = Tyre;
