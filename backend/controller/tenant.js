const express = require("express");
const router = express.Router();
const Deliverer = require("../model/deliverer");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { isGlobalAdmin, requireRole } = require("../middleware/tenantAccess");
const { clearModuleCache } = require("../middleware/moduleAccess");
const { MODULES, resolveModules, applyModuleChanges } = require("../config/modules");

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
      .select("companyName plan modules")
      .lean();
    if (!company) return next(new ErrorHandler("Company not found", 404));

    res.status(200).json({
      success: true,
      companyName: company.companyName,
      plan: company.plan || "free",
      modules: resolveModules(company.modules),
      registry: registry(),
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

module.exports = router;
