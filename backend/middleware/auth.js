const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../model/user");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Login to continue!", 401));
  }
  decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  req.user = await User.findById(decoded.id);
  next();
});
