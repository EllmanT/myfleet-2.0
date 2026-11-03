const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  // Owning company (Deliverer). Backfilled by scripts/backfillTenantId.js.
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliverer", index: true },
  name: {
    type: String,
    required:true,
  },
  city: {
    type: String,
    
  },
  phoneNumber: {
    type: String,
  },
  address: {
    type: String,
  },
},  { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);
