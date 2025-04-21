const mongoose = require("mongoose");

const ContractorStatsSchema = new mongoose.Schema({
  contractorId: String,
  delivererId: String,
  yearlyJobs: {
    type: Number,
  },
  yearlyMileage: {
    type: Number,
  },
  yearlyRevenue: {
      type: mongoose.Schema.Types.Decimal128,
      get: (value) => parseFloat(value.toString()).toFixed(2),
  },

  year: {
    type: Number,
  },
  monthlyData: [
    {
      month: String,
      totalMileage: Number,
      totalRevenue: {
                  type: mongoose.Schema.Types.Decimal128,
                  get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places
        
      },

      totalJobs: Number,
    },
  ],
  dailyData: [
    {
      date: String,
      totalMileage: Number,
      totalRevenue: {
          type: mongoose.Schema.Types.Decimal128,
          get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places

      },
      totalJobs: Number,
    },
  ],
  job_ids: {
    type: [mongoose.Types.ObjectId],
    ref: "Job",
  },
}, { timestamps: true });

module.exports = mongoose.model("ContractorStats", ContractorStatsSchema);
