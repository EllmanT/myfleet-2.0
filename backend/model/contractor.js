const mongoose = require("mongoose");

const contractorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
    },
    prefix: {
      type: String,
    },
    contact: {
      type: String,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    lastOrder: {
      type: Number,
      default: 1,
    },
    goodsTypes: {
      type: [String],
      required: true,
    },

    vehiclesTypes: {
      type: [String],
      required: true,
    },

    deliveryTypes: {
      type: [String],
      required: true,
    },

    customers: {
      type: [mongoose.Types.ObjectId],
      ref: "Customer",
    },
    job_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Job",
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Contractor", contractorSchema);
