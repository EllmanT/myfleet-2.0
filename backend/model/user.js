const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Enter your name"],
    },
    email: {
      type: String,
      required: [true, "Enter your email"],
    },
    password: {
      type: String,
      // Clerk-managed accounts have no local password.
      required: [
        function () {
          return !this.clerkUserId;
        },
        "Enter your password",
      ],
      select: false,
    },
    phoneNumber: {
      type: String,
      required: function () {
        return !this.clerkUserId;
      },
    },
    role: {
      type: String,
      default: "deliverer",
      required: true,
    },
    address: {
      type: String,
      required: function () {
        return !this.clerkUserId;
      },
    },
    city: {
      type: String,
      required: function () {
        return !this.clerkUserId;
      },
    },
    companyId: {
      type: mongoose.Types.ObjectId,
    },

    // Linked Clerk user once the person signs in through Clerk.
    clerkUserId: { type: String, index: { unique: true, sparse: true } },

    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    // Never serialise the password hash or reset fields into an API response.
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        return ret;
      },
    },
  }
);

//hashing the password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

//the jwt Token
userSchema.methods.getJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES,
  });
};

//comparing the passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  // Clerk-only accounts have no local password to compare against.
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
