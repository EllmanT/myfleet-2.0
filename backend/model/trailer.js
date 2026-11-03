const mongoose = require("mongoose");

// A trailer is its own asset: it is paired with a horse (tractor unit) per trip,
// and can be swapped between horses, so it is not a field on the vehicle.
const TRAILER_TYPES = ["flatbed", "skeleton", "tautliner", "side tipper", "tanker", "reefer", "lowbed", "other"];

const trailerSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    regNumber: { type: String, required: true, trim: true },
    // regNumber without spaces, upper case: used to keep one trailer per number per company
    regKey: { type: String, required: true },
    type: { type: String, default: "other" },
    axles: { type: Number, min: 1, max: 12 },
    capacityTons: { type: Number, min: 0 },
    notes: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trailerSchema.index({ tenantId: 1, regKey: 1 }, { unique: true });

const Trailer = mongoose.model("Trailer", trailerSchema);
Trailer.TRAILER_TYPES = TRAILER_TYPES;
Trailer.toRegKey = (reg) => String(reg || "").replace(/\s+/g, "").toUpperCase();
module.exports = Trailer;
