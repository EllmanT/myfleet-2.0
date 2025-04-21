const mongoose = require("mongoose");

const employeeExpenseSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
    },
    companyId: {
      type: String,
    },

    expenseData: [
      {
        date: String,
        description: String,
        vehicleId: String,
        cost: {
          type: mongoose.Schema.Types.Decimal128,
          get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("employeeExpense", employeeExpenseSchema);
