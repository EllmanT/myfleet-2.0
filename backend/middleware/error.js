const ErrorHandler = require("../utils/ErrorHandler");

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal server issue";

  //mongodb error

  if (err.name === "CastingError") {
    message = `Resources not found at ${err.path}`;
    err = new ErrorHandler(message, 400);
  }
  //duplicate error
  if (err.code === "1100") {
    message = `Duplicate found at ${Object.key(err.keysValue())}`;
    err = new ErrorHandler(message, 400);
  }

  //jwt token error
  if (err.message === "JsonWebTokenError") {
    message = "The url is invalid";
    err = new ErrorHandler(message, 400);
  }

  //expired error
  if (err.message === "TokenExpiredError") {
    message = "The token has expired";
    err = new ErrorHandler(message, 400);
  }

  //response
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
