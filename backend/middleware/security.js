const rateLimit = require("express-rate-limit");

// Drop keys that start with "$" or contain "." from user input. Without this a
// body like {"email": {"$ne": null}} reaches Mongo as an operator and can bypass
// lookups (NoSQL injection).
function stripOperators(value) {
  if (Array.isArray(value)) {
    value.forEach(stripOperators);
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete value[key];
      } else {
        stripOperators(value[key]);
      }
    }
  }
  return value;
}

const sanitizeInput = (req, res, next) => {
  if (req.body) stripOperators(req.body);
  if (req.query) stripOperators(req.query);
  if (req.params) stripOperators(req.params);
  next();
};

// Tests fire many requests from one address, so limits are off there.
const skipInTests = () => process.env.NODE_ENV === "test";

const limiterBase = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again shortly.",
    }),
};

// Login, signup, password reset: slow down password guessing and email spam.
const authLimiter = rateLimit({
  ...limiterBase,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

// Everything else under /api: generous, aimed at runaway scripts.
const apiLimiter = rateLimit({
  ...limiterBase,
  windowMs: 15 * 60 * 1000,
  limit: 1500,
});

module.exports = { sanitizeInput, authLimiter, apiLimiter, stripOperators };
