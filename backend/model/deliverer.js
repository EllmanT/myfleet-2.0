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
    // Linked Clerk organization once the company signs in through Clerk.
    clerkOrgId: { type: String, index: { unique: true, sparse: true } },
    // Billing plan (free during the launch period).
    plan: { type: String, default: "free" },
    // Set when the company's admin asks for the company and all its data to be deleted. The data
    // is kept until deletionScheduledFor so the request can be cancelled; see
    // services/companyDeletion.js.
    // Plan band, trial clock and payment state. Absent on companies that existed before billing:
    // those are "legacy" (always active, no limits). See config/plans.js.
    billing: {
      band: { type: String, enum: ["starter", "fleet", "pro"] },
      status: { type: String, enum: ["trial", "active", "suspended", "cancelled"] },
      trialEndsAt: { type: Date },
      paidUntil: { type: Date },
      note: { type: String },
      // which clock date each reminder email was last sent for (services/billingEmails.js)
      notices: { type: mongoose.Schema.Types.Mixed },
    },
    deletionRequestedAt: { type: Date },
    deletionScheduledFor: { type: Date },
    deletionRequestedBy: { type: mongoose.Types.ObjectId },
    // true when WE scheduled it because the company stayed read-only; cancelled automatically on payment
    deletionAuto: { type: Boolean },
    // Which optional modules are switched on. Missing on companies that existed
    // before module toggles; see config/modules.js (resolveModules).
    modules: { type: mongoose.Schema.Types.Mixed },
    // Invented data for screenshots and demos. scripts/seedDemoTenant.js only ever
    // creates, resets or deletes companies with this flag.
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Deliverer", delivererSchema);
``;
