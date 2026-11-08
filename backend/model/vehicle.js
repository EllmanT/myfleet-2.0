const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    // Owning company (Deliverer). companyId (string) is kept for older code.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", index: true },
    // Normal km per litre for this truck, used by the fuel check. Falls back to
    // a default for its size when not set.
    expectedKmPerLitre: { type: Number, min: 0 },
    make: {
      type: String,
      required: true,
    },
    companyId: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    regNumber: {
      type: String,
      required: true,
    },
    job_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Job",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
