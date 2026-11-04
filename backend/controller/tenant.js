const express = require("express");
const router = express.Router();
const Deliverer = require("../model/deliverer");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { isGlobalAdmin, requireRole } = require("../middleware/tenantAccess");
const { clearModuleCache } = require("../middleware/moduleAccess");
const { MODULES, resolveModules, applyModuleChanges } = require("../config/modules");
const { streamCompanyExport } = require("../services/dataExport");
const deletion = require("../services/companyDeletion");
const { BAND_ORDER } = require("../config/plans");
const { clearBillingCache, publicBilling } = require("../services/billing");

const registry = () =>
  MODULES.map(({ key, label, description, available }) => ({ key, label, description, available }));

// GET /api/v2/tenant/me - the company's plan and which modules are on.
router.get(
  "/me",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    if (!req.user.companyId) {
      return next(new ErrorHandler("Your account has no company", 403));
    }
    const company = await Deliverer.findById(req.user.companyId)
      .select("companyName plan modules billing deletionRequestedAt deletionScheduledFor")
      .lean();
    if (!company) return next(new ErrorHandler("Company not found", 404));

    res.status(200).json({
      success: true,
      companyName: company.companyName,
      plan: company.plan || "free",
      modules: resolveModules(company.modules),
      registry: registry(),
      deletion: deletion.statusOf(company),
      billing: publicBilling(company.billing),
    });
  })
);

// PUT /api/v2/tenant/billing { companyId, band?, status?, trialEndsAt?, paidUntil?, extendTrialDays?, note? }
// Platform admins only: set a company's plan, mark it paid until a date, extend a trial, suspend.
// Every change is written to the audit log.
router.put(
  "/billing",
  isAuthenticated,
  requireRole("Super Admin", "Site Admin"),
  catchAsyncErrors(async (req, res, next) => {
    const b = req.body || {};
    if (!require("mongoose").isValidObjectId(b.companyId)) return next(new ErrorHandler("Say which company (companyId)", 400));
    const company = await Deliverer.findById(b.companyId);
    if (!company) return next(new ErrorHandler("Company not found", 404));

    const next_ = { ...(company.billing ? company.billing.toObject() : {}) };
    const bad = (m) => next(new ErrorHandler(m, 400));
    if (b.band !== undefined) {
      if (!BAND_ORDER.includes(b.band)) return bad(`band must be one of ${BAND_ORDER.join(", ")}`);
      next_.band = b.band;
    }
    if (b.status !== undefined) {
      if (!["trial", "active", "suspended", "cancelled"].includes(b.status)) return bad("status must be trial, active, suspended or cancelled");
      next_.status = b.status;
    }
    for (const field of ["trialEndsAt", "paidUntil"]) {
      if (b[field] !== undefined) {
        const d = b[field] === null ? null : new Date(b[field]);
        if (d !== null && Number.isNaN(d.getTime())) return bad(`${field} is not a date`);
        next_[field] = d;
      }
    }
    if (b.extendTrialDays !== undefined) {
      const n = Number(b.extendTrialDays);
      if (!Number.isFinite(n) || n < -365 || n > 365) return bad("extendTrialDays must be between -365 and 365");
      const base = next_.trialEndsAt && new Date(next_.trialEndsAt) > new Date() ? new Date(next_.trialEndsAt) : new Date();
      next_.trialEndsAt = new Date(base.getTime() + n * 86400000);
    }
    if (b.note !== undefined) next_.note = String(b.note).slice(0, 500);
    if (!next_.band) next_.band = "starter"; // giving a legacy company any plan field puts it on a plan
    if (!next_.status) next_.status = "trial";

    const before = company.billing ? company.billing.toObject() : null;
    company.billing = next_;
    await company.save();
    clearBillingCache(company._id);
    await require("mongoose").connection.collection("auditlogs").insertOne({
      at: new Date(),
      by: req.user._id,
      action: "billing.update",
      companyId: company._id,
      before,
      after: next_,
    });
    res.status(200).json({ success: true, billing: publicBilling(company.billing) });
  })
);

// GET /api/v2/tenant/setup - what the company has set up so far, for the first-run checklist.
router.get(
  "/setup",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    if (!req.user.companyId) return next(new ErrorHandler("Your account has no company", 403));
    const company = await Deliverer.findById(req.user.companyId)
      .select("vehicle_ids driver_ids customer_ids job_ids")
      .lean();
    if (!company) return next(new ErrorHandler("Company not found", 404));
    const Invoice = require("../model/invoice");
    const invoices = await Invoice.countDocuments({ tenantId: req.user.companyId });
    res.status(200).json({
      success: true,
      counts: {
        vehicles: (company.vehicle_ids || []).length,
        drivers: (company.driver_ids || []).length,
        customers: (company.customer_ids || []).length,
        jobs: (company.job_ids || []).length,
        invoices,
      },
    });
  })
);

// PUT /api/v2/tenant/modules  { modules: { fuel: true, expenses: false } }
// A company admin changes their own company's modules. Platform admins may name
// another company with companyId.
router.put(
  "/modules",
  isAuthenticated,
  requireRole("Deliverer Admin", "Super Admin", "Site Admin"),
  catchAsyncErrors(async (req, res, next) => {
    const targetId =
      isGlobalAdmin(req.user) && req.body.companyId ? req.body.companyId : req.user.companyId;
    if (!targetId) return next(new ErrorHandler("Your account has no company", 403));

    const company = await Deliverer.findById(targetId);
    if (!company) return next(new ErrorHandler("Company not found", 404));

    const result = applyModuleChanges(company.modules, req.body.modules);
    if (!result.ok) return next(new ErrorHandler(result.error, 400));

    company.modules = result.next;
    company.markModified("modules");
    await company.save();
    clearModuleCache(company._id);

    res.status(200).json({
      success: true,
      modules: resolveModules(company.modules),
    });
  })
);

// GET /api/v2/tenant/export - the whole company's data as one ZIP (spreadsheets, JSON, documents).
// Company admins only. One export at a time per company.
const exporting = new Set();
router.get(
  "/export",
  isAuthenticated,
  requireRole("Deliverer Admin", "Super Admin", "Site Admin"),
  catchAsyncErrors(async (req, res, next) => {
    const companyId =
      isGlobalAdmin(req.user) && req.query.companyId ? String(req.query.companyId) : String(req.user.companyId || "");
    if (!companyId || !require("mongoose").isValidObjectId(companyId)) {
      return next(new ErrorHandler("Your account has no company", 403));
    }
    if (exporting.has(companyId)) {
      return next(new ErrorHandler("An export is already being prepared. Try again in a minute.", 429));
    }
    exporting.add(companyId);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      res.status(200);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="myfleet-export-${stamp}.zip"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const manifest = await streamCompanyExport({ companyId, requestedBy: req.user._id, out: res });
      // eslint-disable-next-line no-console
      console.info("[data-export]", JSON.stringify({ company: companyId, by: String(req.user._id), counts: manifest.counts }));
    } catch (error) {
      if (!res.headersSent) {
        res.removeHeader("Content-Disposition");
        res.removeHeader("Content-Type");
        return next(new ErrorHandler(error.status === 404 ? "Company not found" : "The export failed. Try again.", error.status || 500));
      }
      // Already streaming: cut the connection so the browser shows a failed download
      // rather than a truncated file that looks complete.
      res.destroy(error);
    } finally {
      exporting.delete(companyId);
    }
  })
);

// Deleting the company. Company admins of their own company only; nothing is removed until the
// date has passed, and until then the request can be cancelled.
const ownCompanyAdmin = (req, res, next) => {
  if (!req.user.companyId) return next(new ErrorHandler("Your account has no company", 403));
  next();
};

// POST /api/v2/tenant/deletion { confirmName }
router.post(
  "/deletion",
  isAuthenticated,
  requireRole("Deliverer Admin"),
  ownCompanyAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const result = await deletion.requestDeletion({
      companyId: req.user.companyId,
      userId: req.user._id,
      confirmName: req.body && req.body.confirmName,
    });
    if (!result.ok) return next(new ErrorHandler(result.error, result.status || 400));
    // eslint-disable-next-line no-console
    console.info("[company-deletion] requested", String(req.user.companyId), "by", String(req.user._id));
    res.status(200).json({ success: true, deletion: result });
  })
);

// DELETE /api/v2/tenant/deletion - change of mind
router.delete(
  "/deletion",
  isAuthenticated,
  requireRole("Deliverer Admin"),
  ownCompanyAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const result = await deletion.cancelDeletion(req.user.companyId);
    if (!result.ok) return next(new ErrorHandler(result.error, result.status || 400));
    res.status(200).json({ success: true, deletion: result });
  })
);

// GET /api/v2/tenant/purge-due - the daily scheduled job (Vercel cron sends
// "Authorization: Bearer <CRON_SECRET>"). Without CRON_SECRET set it does nothing.
router.get(
  "/purge-due",
  catchAsyncErrors(async (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return next(new ErrorHandler("Not available", 404));
    const given = String(req.headers.authorization || "");
    const expected = `Bearer ${secret}`;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) {
      return next(new ErrorHandler("Not authorized", 401));
    }
    const results = await deletion.purgeDueCompanies();
    // eslint-disable-next-line no-console
    console.info("[company-deletion] purge run", JSON.stringify(results));
    res.status(200).json({ success: true, purged: results.length, results });
  })
);

module.exports = router;
