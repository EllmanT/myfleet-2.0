const mongoose = require("mongoose");

const overallStatsSchema = mongoose.Schema(
  {
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

    yearlyExpenses: {
      type: mongoose.Schema.Types.Decimal128,
      get: (value) => parseFloat(value.toString()).toFixed(2),
    },

    yearlyProfit: {
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
        totalProfit: {
          type: mongoose.Schema.Types.Decimal128,
          get: (value) => parseFloat(value).toFixed(2), // Round totalRevenue to 2 decimal places
        },
        totalExpenses: {
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

    totalCustomers: {
      type: Number,
    },
    totalContractors: {
      type: Number,
    },

    revenueByContractor: {
      type: Map,
      of: mongoose.Schema.Types.Decimal128, // Use Decimal128 for the map values
      get: (map) => {
        const roundedMap = {};
        map.forEach((value, key) => {
          // Convert each value to float and round to 2 decimal places
          roundedMap[key] = parseFloat(value.toString()).toFixed(2);
        });
        return roundedMap;
      },
    },
    jobsByContractor: {
      type: Map,
      of: Number,
      get: (map) => {
        return map ? Object.fromEntries(map.entries()) : {}; // Transform Map to an object
      },
    },

    companyId: { type: mongoose.Types.ObjectId, ref: "Deliverer" },
  },
  { timestamps: true }
);


// Add the virtual field here
overallStatsSchema.virtual('jobsContractor').get(function () {
  return this.jobsByContractor;
});

// Enable virtuals in toObject and toJSON
overallStatsSchema.set('toObject', { getters: true, virtuals: true });
overallStatsSchema.set('toJSON', { getters: true, virtuals: true });

// Export the model
const OverallStats = mongoose.model('OverallStats', overallStatsSchema);

module.exports = OverallStats;