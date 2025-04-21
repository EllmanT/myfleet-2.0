  const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phoneNumber: {
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
  idNumber: {
    type: String,
    required: true,
  },
  id: {
    type: String,
    required: true,
  },
  license: {
    type: String,
  },
  companyId: {
    type: String,
    required: true,
  },
  job_ids: {
    type: [mongoose.Types.ObjectId],
    ref: "Job",
  },
  //dateJoined:{
  //type:Date,
  // },
  dateEnded: {
    type: Date,
  },
 
},  { timestamps: true }
);

module.exports = mongoose.model("Driver", driverSchema);
