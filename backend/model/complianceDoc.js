const mongoose = require("mongoose");

// A document that expires and must be renewed: Yellow Card, licences, permits.
// Attached to a horse, a trailer or a driver, so the app can warn before it lapses.
const OWNER_TYPES = ["vehicle", "trailer", "driver"];
const DOC_TYPES = [
  "yellow_card", "vehicle_licence", "roadworthy", "insurance", "sadc_permit",
  "carbon_tax", "drivers_licence", "prdp", "passport", "other",
];

const complianceDocSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", required: true, index: true },
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    docType: { type: String, enum: DOC_TYPES, required: true },
    number: { type: String, default: "", trim: true },
    issuedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

complianceDocSchema.index({ tenantId: 1, expiresAt: 1 });
complianceDocSchema.index({ tenantId: 1, ownerType: 1, ownerId: 1 });

const ComplianceDoc = mongoose.model("ComplianceDoc", complianceDocSchema);
ComplianceDoc.OWNER_TYPES = OWNER_TYPES;
ComplianceDoc.DOC_TYPES = DOC_TYPES;
module.exports = ComplianceDoc;
