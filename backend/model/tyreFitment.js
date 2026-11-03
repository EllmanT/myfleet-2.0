const mongoose = require("mongoose");

// A tyre on a wheel position for a period. Open while removedAt is empty.
const tyreFitmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    tyreId: { type: mongoose.Schema.Types.ObjectId, ref: "Tyre", required: true },
    assetType: { type: String, enum: ["vehicle", "trailer"], required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    position: { type: String, required: true, trim: true }, // e.g. "Steer left", "Drive 2 outer right"
    fittedAt: { type: Date, required: true },
    fittedOdometer: { type: Number, min: 0 },
    removedAt: { type: Date },
    removedOdometer: { type: Number, min: 0 },
    reason: { type: String, default: "" }, // worn, puncture, rotated, scrapped ...
  },
  { timestamps: true }
);
tyreFitmentSchema.index({ tenantId: 1, tyreId: 1, fittedAt: -1 });
tyreFitmentSchema.index({ tenantId: 1, assetType: 1, assetId: 1 });

module.exports = mongoose.model("TyreFitment", tyreFitmentSchema);
