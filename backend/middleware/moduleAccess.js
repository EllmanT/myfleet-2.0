const Deliverer = require("../model/deliverer");
const ErrorHandler = require("../utils/ErrorHandler");
const { resolveModules } = require("../config/modules");
const { isGlobalAdmin } = require("./tenantAccess");

// companyId -> resolved modules, kept briefly so a switched-off module doesn't
// cost a database read on every request. Cleared whenever settings change.
const cache = new Map();
const CACHE_MS = 30 * 1000;

async function modulesForCompany(companyId) {
  const key = String(companyId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.modules;
  const company = await Deliverer.findById(companyId).select("modules").lean();
  const modules = resolveModules(company && company.modules);
  cache.set(key, { modules, expires: Date.now() + CACHE_MS });
  return modules;
}

function clearModuleCache(companyId) {
  if (companyId) cache.delete(String(companyId));
  else cache.clear();
}

// Blocks a route when the caller's company has switched the module off. This is
// enforced on the server, so hiding a menu item is never the only protection.
const requireModule = (key) => async (req, res, next) => {
  try {
    if (!req.user) return next(new ErrorHandler("Login to continue!", 401));
    if (isGlobalAdmin(req.user)) return next();
    if (!req.user.companyId) return next(new ErrorHandler("Your account has no company", 403));
    const modules = await modulesForCompany(req.user.companyId);
    if (!modules[key]) {
      const err = new ErrorHandler("This feature is switched off for your company", 403);
      err.code = "MODULE_DISABLED";
      return next(err);
    }
    next();
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
};

module.exports = { requireModule, modulesForCompany, clearModuleCache };
