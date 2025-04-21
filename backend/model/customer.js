const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required:true,
  },
  city: {
    type: String,
    
  },
  phoneNumber: {
    type: String,
  },
  address: {
    type: String,
  },
},  { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);
