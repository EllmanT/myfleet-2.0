const mongoose = require("mongoose");

// "Service every 10,000 km or 6 months" for one truck or trailer. When it is next
// due is worked out from the last work logged against it.
const servicePlanSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    assetType: { type: String, enum: ["vehicle", "trailer"], required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    intervalKm: { type: Number, min: 1 },
    intervalDays: { type: Number, min: 1 },
    // where the clock starts if nothing has been logged against the plan yet
    baselineKm: { type: Number, min: 0 },
    baselineDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
servicePlanSchema.index({ tenantId: 1, assetType: 1, assetId: 1 });

module.exports = mongoose.model("ServicePlan", servicePlanSchema);
