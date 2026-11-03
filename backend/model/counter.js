const mongoose = require("mongoose");

// One running number per company and document series (invoice, quotation, ...).
const counterSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  series: { type: String, required: true },
  value: { type: Number, default: 0 },
});
counterSchema.index({ tenantId: 1, series: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);
