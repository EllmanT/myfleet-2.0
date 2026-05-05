const crypto = require("crypto");
const express = require("express");
const User = require("../model/user");
const { upload } = require("../multer");
const router = express.Router();
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const sendToken = require("../utils/jwtToken");
const sendMail = require("../utils/sendMail");
const jwt = require("jsonwebtoken");
const { isAuthenticated } = require("../middleware/auth");
const Deliverer = require("../model/deliverer");

const RESET_TOKEN_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LEN = 8;

const frontendResetUrl = (rawToken) => {
  const base =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000";
  const trimmed = String(base).replace(/\/$/, "");
  return `${trimmed}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

//create-user
router.post("/create-user", upload.single("file"), async (req, res, next) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      companyId,
      role,
      address,
      city,
      password,
    } = req.body;
    const checkEmail = await User.findOne({ email });

    if (checkEmail) {
      return next(new ErrorHandler("User exists", 400));
    }

    const user = {
      name: name,
      email: email,
      phoneNumber: phoneNumber,
      companyId: companyId,
      role: role,
      address: address,
      city: city,
      password: password,
    };

    const activationToken = createActivationToken(user);
    // const activationUrl = `https://myfleet-ijfg.vercel.app/activation/${activationToken}`;
    const activationUrl = `https://checkins-render-prod-deployment.onrender.com/activation/${activationToken}`;

    try {
      await sendMail({
        email: user.email,
        subject: "Activate Account!",
        message: `Hi ${user.name}. Please click the link to activate your account : ${activationUrl}`,
      });

      res.status(201).json({
        success: true,
        message: `Check your email to finish verification : ${user.email} `,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});
// create activation token
const createActivationToken = (user) => {
  return jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: "5m",
  });
};

//activate-user

router.post(
  `/activation`,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { activation_token } = req.body;
      const checkToken = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!checkToken) {
        return next(new ErrorHandler("Token is invalid", 400));
      }

      const {
        name,
        email,
        phoneNumber,
        password,
        address,
        city,
        role,
        companyId,
      } = checkToken;

      let user = await User.findOne({ email });
      if (user) {
        return next(new ErrorHandler("User already exists", 400));
      }

      const isCompanyDeliverer = await Deliverer.findById(companyId);

      if (user) {
        //checking to see if admin exists in the deliverers admins array list
        //we dont want to add duplicate admins into the deliverers array list

        //checking the deliverer table
        if (isCompanyDeliverer) {
          //check if admin already exists as a client for deliverer
          const isDeliveryAdmin = isCompanyDeliverer.admin_ids.find(
            (admin) => (admin = user._id)
          );
          if (isDeliveryAdmin) {
            return next(
              new ErrorHandler(
                `${user.name}   ${user.email} is already in the system`,
                500
              )
            );
          }

          isCompanyDeliverer.admin_ids.push(user._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,

            message: "Admin added successfully",
          });
        }

        //return next(new ErrorHandler("The admin already exists", 400));
      } else {
        user = await User.create({
          name: name,
          email: email,
          phoneNumber: phoneNumber,
          city: city,
          address: address,
          role: role,
          password: password,
          companyId: companyId,
        });
        //pushing the data into deliverer
        if (isCompanyDeliverer) {
          isCompanyDeliverer.admin_ids.push(user._id);
          await isCompanyDeliverer.save();
          sendToken(user, 201, res);

          res.status(201).json({
            success: true,
            message: "Admin added successfully",
          });
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

//login-user

router.post(
  `/login-user`,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const checkEmail = await User.findOne({ email }).select("+password");
      if (!email || !password) {
        return next(new ErrorHandler("Enter all the fields", 400));
      }
      if (!checkEmail) {
        return next(new ErrorHandler("User doesnt exist", 400));
      }

      verifyPassword = await checkEmail.comparePassword(password);
      if (!verifyPassword) {
        return next(new ErrorHandler("Enter correct info", 400));
      }
      sendToken(checkEmail, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// forgot-password — sends email with reset link (does not reveal if email exists)
router.post(
  "/forgot-password",
  catchAsyncErrors(async (req, res, next) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    if (!email) {
      return next(new ErrorHandler("Please provide your email", 400));
    }

    const user = await User.findOne({ email });
    const genericMessage =
      "If an account exists for that email, you will receive a password reset link shortly.";

    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + RESET_TOKEN_MS);
    await user.save({ validateBeforeSave: false });

    const resetUrl = frontendResetUrl(rawToken);
    const devLink = process.env.RESET_PASSWORD_DEV_LINK === "true";
    const smtpOk = sendMail.isSmtpConfigured();

    if (!smtpOk && devLink) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
        devResetUrl: resetUrl,
      });
    }

    if (!smtpOk) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
      );
      return next(
        new ErrorHandler(
          "Email is not configured (missing SMPT_HOST or SMPT_SERVICE / credentials). Configure SMTP in backend/config/.env, or set RESET_PASSWORD_DEV_LINK=true for local development only.",
          503
        )
      );
    }

    try {
      await sendMail({
        email: user.email,
        subject: "myFleet — reset your password",
        message: `Hi ${user.name},\n\nReset your password using this link (valid 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      });
    } catch (err) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
      );
      return next(
        new ErrorHandler(
          err.message || "Could not send reset email. Check SMTP settings.",
          500
        )
      );
    }

    return res.status(200).json({ success: true, message: genericMessage });
  })
);

// reset-password — body: { token, password }
router.post(
  "/reset-password",
  catchAsyncErrors(async (req, res, next) => {
    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!token || !password) {
      return next(new ErrorHandler("Token and new password are required", 400));
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return next(
        new ErrorHandler(`Password must be at least ${MIN_PASSWORD_LEN} characters`, 400)
      );
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpire");

    if (!user) {
      return next(new ErrorHandler("Invalid or expired reset token", 400));
    }

    user.password = password;
    await user.save();
    await User.updateOne(
      { _id: user._id },
      { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
    );

    res.status(200).json({
      success: true,
      message: "Password updated. You can sign in with your new password.",
    });
  })
);

//get-user
router.get(
  "/get-user",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return next(new ErrorHandler("User doesnt exist", 400));
      }
      const deliverer = await Deliverer.findById(user.companyId);
      if (!deliverer) {
        return next(new ErrorHandler("Error , Deliverer not found", 400));
      }

      const delivererName = deliverer.companyName;

      res.status(200).json({
        success: true,
        user,
        delivererName,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get-all-admins-page

router.get(
  "/get-all-admins-page",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let {
        page = 0,
        pageSize = 25,
        sort = null,

        search = "",
      } = req.query;

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      const sortOptions = Boolean(sort) ? generateSort() : {};

      // Find the deliverer based on the company ID
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      // Get the admin IDs associated with the deliverer
      const adminIds = deliverer.admin_ids;

      // Create a search filter
      const searchFilter = {
        _id: { $in: adminIds },
        $or: [
          { name: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },

          // Add other fields to search on as needed
        ],
      };
      // Query for the admins using the search filter
      const pageAdmins = await User.find(searchFilter).sort(sortOptions).lean();

      if (pageAdmins.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No admins in the system",
        });
      }

      // Paginate the results manually based on the requested page and page size
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedAdmins = pageAdmins.slice(startIndex, endIndex);

      const totalCount = pageAdmins.length;

      res.status(200).json({
        success: true,
        pageAdmins: paginatedAdmins,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update seller info
router.put(
  "/update-admin",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adminId, name, email, phoneNumber, city, address, role } =
        req.body;

      const admin = await User.findById(adminId);

      if (!admin) {
        return next(new ErrorHandler("User not found", 400));
      }


      admin.name = name;
      admin.email = email;
      admin.city = city;
      admin.address = address;
      admin.phoneNumber = phoneNumber;
      admin.role = role;

      await admin.save();

      res.status(201).json({
        success: true,
        admin,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//delete admin

router.delete(
  "/delete-admin/:adminId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const adminId = req.params.adminId;

      const admin = await User.findByIdAndDelete(adminId);
      if (!admin) {
        return next(new ErrorHandler("There is no admin with this id", 500));
      }
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }

      // Remove the adminId from the deliverer's array of adminIds
      const updatedAdminIds = deliverer.admin_ids.filter(
        (id) => id.toString() !== adminId
      );

      // Update the deliverer's adminIds array with the updated array
      deliverer.admin_ids = updatedAdminIds;
      await deliverer.save();

      res.status(201).json({
        success: true,
        message: "Admin Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;
