/*
 * Applies config/plans.js to requests: the read-only gate, the truck limit, and the cache that
 * keeps both from costing a database read on every call.
 */
const Deliverer = require("../model/deliverer");
const ErrorHandler = require("../utils/ErrorHandler");
const { billingState, bandForTrucks, MAX_TRUCKS, BANDS } = require("../config/plans");

const cache = new Map();
const CACHE_MS = 30 * 1000;

async function stateForCompany(companyId) {
  const key = String(companyId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.state;
  const company = await Deliverer.findById(companyId).select("billing").lean();
  const state = billingState(company && company.billing);
  cache.set(key, { state, expires: Date.now() + CACHE_MS });
  return state;
}
const clearBillingCache = (companyId) => (companyId ? cache.delete(String(companyId)) : cache.clear());

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
// Writes that must keep working when the company cannot change its data: leaving, and asking to
// delete or to cancel deleting. (Export is a GET, so it is always allowed.)
const ALWAYS_WRITABLE = [/^\/api\/v2\/tenant\/deletion$/, /^\/api\/v2\/user\/logout/, /^\/api\/v2\/auth\//];

// Returns an ErrorHandler when this request must be refused, otherwise null.
async function readOnlyError(req) {
  if (SAFE_METHODS.includes(req.method)) return null;
  const user = req.user;
  if (!user || !user.companyId) return null; // platform admins and company-less users are not company-billed
  if (["Super Admin", "Site Admin"].includes(user.role)) return null;
  const path = String(req.baseUrl || "") + String(req.path || "");
  if (ALWAYS_WRITABLE.some((re) => re.test(path))) return null;

  const state = await stateForCompany(user.companyId);
  if (state.writable) return null;

  const messages = {
    trial_ended: "Your free trial has ended. Your data is safe and you can still view and download it. Contact us to continue.",
    payment_overdue: "Your subscription payment is overdue. Your data is safe and you can still view and download it. Contact us to continue.",
    suspended: "This account is suspended. Contact us to restore it. You can still download your data.",
    cancelled: "This account has been cancelled. You can still view and download your data.",
  };
  const err = new ErrorHandler(messages[state.readOnlyReason] || "This account is read-only.", state.readOnlyReason === "suspended" ? 403 : 402);
  err.code = "READ_ONLY";
  err.reason = state.readOnlyReason;
  return err;
}

// Adding one more truck: refuse above the largest band; otherwise move up a band when needed (no
// second trial; the price changes at the next invoice). Companies without billing are not limited.
async function allowAnotherTruck(company) {
  if (!company || !company.billing || !company.billing.band) return { ok: true };
  const count = (company.vehicle_ids || []).length + 1;
  if (count > MAX_TRUCKS) {
    return { ok: false, error: `Plans cover up to ${MAX_TRUCKS} trucks. Contact us for a larger fleet; your data is safe.` };
  }
  const needed = bandForTrucks(count);
  if (needed && needed !== company.billing.band && BANDS[needed].maxTrucks > BANDS[company.billing.band].maxTrucks) {
    await Deliverer.updateOne({ _id: company._id }, { $set: { "billing.band": needed } });
    clearBillingCache(company._id);
    return { ok: true, movedTo: needed };
  }
  return { ok: true };
}

module.exports = { stateForCompany, clearBillingCache, readOnlyError, allowAnotherTruck };
