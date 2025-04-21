const mongoose = require("mongoose");

const delivererSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    goodsType: {
      type: [String],
      required: true,
    },

    vehiclesType: [
      {
        type: String,
      },
    ],
    deliveryType: [
      {
        type: String,
      },
    ],

    Rates: [
      {
        rateType: {
          type: String,
        },
        smallVehicle: {
          type: Number,
        },
        mediumVehicle: {
          type: Number,
        },
        largeVehicle: {
          type: Number,
        },
      },
    ],
    job_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Job",
    },
    customer_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Customer",
    },
    contractor_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Contractor",
    },
    admin_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Admin",
    },
    driver_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Driver",
    },
    vehicle_ids: {
      type: [mongoose.Types.ObjectId],
      ref: "Vehicle",
    },
    contact: {
      type: "String",
    },

    prefix: {
      type: String,
      default: "JN",
    },
    lastOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Deliverer", delivererSchema);
``;
