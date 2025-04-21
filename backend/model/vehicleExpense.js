const mongoose = require("mongoose");

const VehicleExpenseSchema = new mongoose.Schema(
  {
    vehicleId: {
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
        employeeId: String,
        cost: {
          type: mongoose.Schema.Types.Decimal128,
          get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("VehicleExpense", VehicleExpenseSchema);
