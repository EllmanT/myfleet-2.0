const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    // Owning company (Deliverer). companyId (string) is kept for older code.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", index: true },
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
      requried: true,
    },
    job_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Job",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
