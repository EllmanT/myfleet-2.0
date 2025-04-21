const mongoose = require("mongoose");

const paymentSchema = mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
    },
    contractorId: {
      type: mongoose.Types.ObjectId,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places
    },
    description: {
      type: String,
    },
    year: {
      type: String,
    },
    month: {
      type: String,
    },
    paymentDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.export = mongoose.model("paymentSchema", paymentSchema);
