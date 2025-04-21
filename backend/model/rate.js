const mongoose = require("mongoose");

const rateSchema = new mongoose.Schema({
  contractor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contractor",
    required: true,
  },
  deliverer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Deliverer",
    required: true,
  },
  rateTypes: [
    {
      rateType: {
        type: String,
        required: true,
        default: 0,
      },
      smallVehicle: {
        type: Number,
        default: 0,
      },
      largeVehicle: {
        type: Number,
        default: 0,
      },
      mediumVehicle: {
        type: Number,
        default: 0,
      },
      horse: {
        type: Number,
        default: 0,
      },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("rate", rateSchema);
