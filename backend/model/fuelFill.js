const mongoose = require("mongoose");

// One document per fuel fill-up. Used for the weekly tank-to-tank check:
// litres bought are compared with the km the truck actually drove.
const FuelFillSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverName: { type: String, default: "" },
    filledAt: { type: Date, required: true },
    odometer: { type: Number, required: true, min: 0 },
    litres: { type: Number, required: true, min: 0.1 },
    amount: { type: Number, required: true, min: 0 },
    // true = tank filled until the pump clicked off. Only full-to-full fills give a reliable km per litre.
    fullTank: { type: Boolean, default: true },
    // "business" counts in profit. "private" is recorded only and never counted.
    purpose: { type: String, enum: ["business", "private"], default: "business" },
    station: { type: String, default: "" },
    // the pump + odometer photos were posted in the WhatsApp group
    photoPosted: { type: Boolean, default: false },
    cashGiven: { type: Number, min: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

FuelFillSchema.index({ companyId: 1, vehicleId: 1, filledAt: 1 });

module.exports = mongoose.model("FuelFill", FuelFillSchema);
