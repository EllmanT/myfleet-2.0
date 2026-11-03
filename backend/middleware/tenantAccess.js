const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const { stripOperators } = require("./security");

// Phase 0 company-scoping helpers. These are an interim guard until every model
// carries a tenantId (Phase 1). They reuse the Deliverer id arrays that the app
// already maintains, so they work with today's data without a migration.

const GLOBAL_ROLES = ["Super Admin", "Site Admin"];

const isGlobalAdmin = (user) => Boolean(user && GLOBAL_ROLES.includes(user.role));

// Only the listed roles may continue.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ErrorHandler("You are not authorized to do this", 403));
    }
    next();
  };

// The caller must belong to a company (global admins may act without one).
const requireCompany = (req, res, next) => {
  if (!req.user) return next(new ErrorHandler("Login to continue!", 401));
  if (!req.user.companyId && !isGlobalAdmin(req.user)) {
    return next(new ErrorHandler("Your account has no company", 403));
  }
  next();
};

// Create endpoints: take the company from the session, never from the body.
// Global admins may still name a company explicitly (they pick one in the UI).
const forceOwnCompany = (req, res, next) => {
  if (!req.user) return next(new ErrorHandler("Login to continue!", 401));
  // Multipart bodies are parsed after the global sanitiser has run.
  if (req.body) stripOperators(req.body);
  if (!isGlobalAdmin(req.user)) {
    if (!req.user.companyId) {
      return next(new ErrorHandler("Your account has no company", 403));
    }
    req.body = req.body || {};
    req.body.companyId = String(req.user.companyId);
  }
  next();
};

// Does the caller's company own this record? `field` is the id array on the
// Deliverer document (vehicle_ids, driver_ids, customer_ids, contractor_ids,
// job_ids, admin_ids).
async function companyOwns(user, field, id) {
  if (isGlobalAdmin(user)) return true;
  if (!user || !user.companyId) return false;
  if (!mongoose.isValidObjectId(id)) return false;
  // Preferred: the record carries its owner (set on create, backfilled for
  // older data by scripts/backfillTenantId.js).
  const modelName = TENANT_MODELS[field];
  if (modelName) {
    const Model = require(`../model/${modelName}`);
    const owned = await Model.exists({ _id: id, tenantId: user.companyId });
    if (owned) return true;
    // A record that names a DIFFERENT owner is never ours, whatever the lists say.
    const stamped = await Model.exists({ _id: id, tenantId: { $exists: true } });
    if (stamped) return false;
  }
  // Fallback for records not yet backfilled: the company's id lists.
  const Deliverer = require("../model/deliverer");
  const found = await Deliverer.exists({ _id: user.companyId, [field]: id });
  return Boolean(found);
}

const TENANT_MODELS = {
  vehicle_ids: "vehicle",
  driver_ids: "driver",
  customer_ids: "customer",
  contractor_ids: "contractor",
  job_ids: "job",
};

// Jobs are also owned if they were driven by one of the company's vehicles
// (covers jobs created before job_ids was reliably maintained).
async function companyOwnsJob(user, jobId) {
  if (await companyOwns(user, "job_ids", jobId)) return true;
  if (!user || !user.companyId || !mongoose.isValidObjectId(jobId)) return false;
  const Job = require("../model/job");
  const job = await Job.findById(jobId).select("vehicleId").lean();
  if (!job || !job.vehicleId) return false;
  return companyOwns(user, "vehicle_ids", job.vehicleId);
}

// Route guard for by-id update/delete. `getId(req)` returns the target id.
// A missing or foreign record both answer 404 so ids can't be probed.
const requireOwnership = (field, getId) => async (req, res, next) => {
  try {
    const id = getId(req);
    const ok =
      field === "job_ids"
        ? await companyOwnsJob(req.user, id)
        : await companyOwns(req.user, field, id);
    if (!ok) return next(new ErrorHandler("Not found", 404));
    next();
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
};

module.exports = {
  GLOBAL_ROLES,
  isGlobalAdmin,
  requireRole,
  requireCompany,
  forceOwnCompany,
  companyOwns,
  requireOwnership,
};
