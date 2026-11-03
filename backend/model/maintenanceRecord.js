const mongoose = require("mongoose");

// A service, repair or other workshop job on a truck or trailer.
const TYPES = ["service", "repair", "inspection", "tyres", "other"];

const maintenanceRecordSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    assetType: { type: String, enum: ["vehicle", "trailer"], required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    // odometer reading at the time (trucks only)
    odometer: { type: Number, min: 0 },
    type: { type: String, enum: TYPES, default: "service" },
    description: { type: String, default: "", trim: true },
    supplier: { type: String, default: "", trim: true },
    cost: { type: Number, default: 0, min: 0 },
    // set when this work completes a service plan, which restarts that plan's clock
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "ServicePlan" },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
maintenanceRecordSchema.index({ tenantId: 1, assetType: 1, assetId: 1, date: -1 });

const MaintenanceRecord = mongoose.model("MaintenanceRecord", maintenanceRecordSchema);
MaintenanceRecord.TYPES = TYPES;
module.exports = MaintenanceRecord;
