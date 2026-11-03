const mongoose = require("mongoose");

// How much AI reading a company has used this month, for the monthly allowance
// and so the real cost per customer is known.
const aiUsageSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    month: { type: String, required: true }, // YYYY-MM
    pages: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);
aiUsageSchema.index({ tenantId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("AiUsage", aiUsageSchema);
