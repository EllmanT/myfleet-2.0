const ErrorHandler = require("../utils/ErrorHandler");

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal server issue";

  // Bad ObjectId etc. (Mongoose names this "CastError")
  if (err.name === "CastError" || err.name === "CastingError") {
    err = new ErrorHandler(`Resources not found at ${err.path}`, 400);
  }

  // Duplicate key
  if (err.code === 11000) {
    const duplicateKeys = Object.keys(err.keyValue || {});
    const duplicateField = duplicateKeys[0] || "field";
    err = new ErrorHandler(`Duplicate value for ${duplicateField}`, 409);
  }

  // Bad or expired login token
  if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
    err = new ErrorHandler("Session is invalid, please login again", 401);
  }
  if (err.name === "TokenExpiredError") {
    err = new ErrorHandler("Session expired, please login again", 401);
  }

  // Upload limits (multer)
  if (err.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    err = new ErrorHandler(
      tooBig ? "File is too large (max 5 MB)" : "Upload not accepted",
      tooBig ? 413 : 400
    );
  }

  // A blocked cross-origin request is the caller's problem, not a server fault
  if (typeof err.message === "string" && err.message.startsWith("Not allowed by CORS")) {
    err = new ErrorHandler("Origin not allowed", 403);
  }

  // In production, don't leak internals (database messages, stack hints) for
  // unexpected server faults. Development and tests keep the real message so
  // problems stay easy to diagnose.
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production" ||
    Boolean(process.env.VERCEL);
  if (err.statusCode >= 500) {
    console.error(err);
    if (isProd) err.message = "Something went wrong on our side";
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    // Lets the app tell "link my account" apart from a plain login failure.
    ...(["NEEDS_BOOTSTRAP", "MODULE_DISABLED"].includes(err.code) ? { code: err.code } : {}),
  });
};
