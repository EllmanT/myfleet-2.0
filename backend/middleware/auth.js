const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../model/user");
const { clerkConfigured, companyIdForOrg } = require("../services/clerkAuth");
const { enterRequest } = require("../services/tenantContext");
const { readOnlyError } = require("../services/billing");

// "GET /api/v2/job/get-latest-jobs-vehicle/:vehicleId": the route pattern, not the URL,
// so the same route is one entry however many ids it is called with.
const routeLabel = (req) =>
  `${req.method} ${req.baseUrl || ""}${(req.route && req.route.path) || req.path}`;

const hasBearer = (req) =>
  typeof req.headers.authorization === "string" &&
  req.headers.authorization.startsWith("Bearer ");

// Verified Clerk session for this request, or null. clerkMiddleware (mounted in
// app.js when Clerk is configured) has already validated the token's signature.
function clerkAuthOf(req) {
  const { getAuth } = require("@clerk/express");
  try {
    const auth = getAuth(req);
    return auth && auth.userId ? auth : null;
  } catch (error) {
    return null;
  }
}
exports.clerkAuthOf = clerkAuthOf;

// A signed-in Clerk user who hasn't been linked to our records yet, or who
// switched organization, must call /auth/bootstrap first.
const needsBootstrap = (next, message) => {
  const err = new ErrorHandler(message, 401);
  err.code = "NEEDS_BOOTSTRAP";
  return next(err);
};

async function authenticateWithClerk(req, res, next) {
  const auth = clerkAuthOf(req);
  if (!auth) {
    return next(new ErrorHandler("Session expired, please login again", 401));
  }

  const user = await User.findOne({ clerkUserId: auth.userId });
  if (!user) return needsBootstrap(next, "Finish setting up your account");

  if (auth.orgId) {
    const companyId = await companyIdForOrg(auth.orgId);
    if (!companyId || String(user.companyId) !== companyId) {
      return needsBootstrap(next, "Switching company");
    }
  } else if (!["Super Admin", "Site Admin"].includes(user.role)) {
    return needsBootstrap(next, "Choose or create a company");
  }

  req.user = user;
  req.authSource = "clerk";
  enterRequest(user, routeLabel(req));
  const blocked = await readOnlyError(req);
  if (blocked) return next(blocked);
  next();
}

async function authenticateWithCookie(req, res, next) {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Login to continue!", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    return next(new ErrorHandler("Session expired, please login again", 401));
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new ErrorHandler("Session expired, please login again", 401));
  }
  req.user = user;
  req.authSource = "cookie";
  enterRequest(user, routeLabel(req));
  const blocked = await readOnlyError(req);
  if (blocked) return next(blocked);
  next();
}

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  // A Clerk session token wins when present; otherwise the existing cookie
  // login keeps working, so both can run side by side during the move.
  if (clerkConfigured() && hasBearer(req)) {
    return authenticateWithClerk(req, res, next);
  }
  return authenticateWithCookie(req, res, next);
});
