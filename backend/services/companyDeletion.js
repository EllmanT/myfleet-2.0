/*
 * Deleting a company and all its data (plan H5).
 *
 * How it works, and why:
 *   1. An admin asks for deletion and types the company's name. Nothing is removed yet.
 *      The company is marked with a date (default 30 days away). Until then everyone can
 *      still sign in, the admin can download all the data, and the request can be cancelled
 *      with one click. This is the pattern accounting and shop software uses: a cooling-off
 *      period, and a chance to take your records with you.
 *   2. When the date passes, purgeDueCompanies() (run daily by a scheduled job) removes the
 *      company's records, uploaded files and users, then the company itself.
 *   3. Only a small note is kept: company id, name, when it was deleted and how many records
 *      were removed. No customer, driver or financial data stays.
 *
 * Tax records: Zimbabwe requires a business to keep its own books for at least six years.
 * The company is the owner of those records, not myFleet, so the export is how they keep
 * them. We do not promise to keep a copy for them.
 */
const mongoose = require("mongoose");
const { KINDS, DERIVED_KINDS, companyFilter } = require("./dataExport");
const { deleteTenantFiles } = require("./fileStorage");

const GLOBAL_ROLES = ["Super Admin", "Site Admin"];
const DAY = 24 * 60 * 60 * 1000;

const graceDays = () => {
  const n = Number(process.env.DELETION_GRACE_DAYS);
  return Number.isFinite(n) && n >= 0 ? n : 30;
};

const Deliverer = () => require("../model/deliverer");
const User = () => require("../model/user");

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

function statusOf(company) {
  if (!company || !company.deletionScheduledFor) return { pending: false };
  const msLeft = new Date(company.deletionScheduledFor).getTime() - Date.now();
  return {
    pending: true,
    requestedAt: company.deletionRequestedAt,
    scheduledFor: company.deletionScheduledFor,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY)),
  };
}

async function requestDeletion({ companyId, userId, confirmName }) {
  const company = await Deliverer().findById(companyId);
  if (!company) return { ok: false, status: 404, error: "Company not found" };
  if (norm(confirmName) !== norm(company.companyName)) {
    return { ok: false, status: 400, error: "Type the company name exactly as shown to confirm" };
  }
  if (!company.deletionScheduledFor) {
    company.deletionRequestedAt = new Date();
    company.deletionScheduledFor = new Date(Date.now() + graceDays() * DAY);
    company.deletionRequestedBy = userId;
    await company.save();
  }
  return { ok: true, ...statusOf(company) };
}

async function cancelDeletion(companyId) {
  const company = await Deliverer().findById(companyId);
  if (!company) return { ok: false, status: 404, error: "Company not found" };
  company.deletionRequestedAt = undefined;
  company.deletionScheduledFor = undefined;
  company.deletionRequestedBy = undefined;
  await company.save();
  return { ok: true, pending: false };
}

// Remove one company's data. Refuses unless its deletion date has passed (or force is set,
// which only tests and a deliberate admin script use).
async function purgeCompany(companyId, { force = false } = {}) {
  const company = await Deliverer().findById(companyId).lean();
  if (!company) return { ok: false, error: "Company not found" };
  if (!force && (!company.deletionScheduledFor || new Date(company.deletionScheduledFor) > new Date())) {
    return { ok: false, error: "Deletion is not due yet" };
  }

  const removed = {};
  for (const kind of [...KINDS, ...DERIVED_KINDS]) {
    const Model = require(`../model/${kind.model}`);
    const result = await Model.collection.deleteMany(companyFilter(kind, company));
    removed[kind.name] = result.deletedCount;
  }
  // contractor statistics have no company field; they hang off the company's contractors
  const ContractorStats = require("../model/contractorStats");
  const contractorIds = (company.contractor_ids || []).map(String);
  if (contractorIds.length) {
    const r = await ContractorStats.collection.deleteMany({ contractorId: { $in: contractorIds } });
    removed["contractor-stats"] = r.deletedCount;
  }

  removed.files = await deleteTenantFiles(company._id);

  // People who belong only to this company. Platform admins are never removed.
  const users = await User().collection.deleteMany({
    companyId: company._id,
    role: { $nin: GLOBAL_ROLES },
  });
  removed.users = users.deletedCount;

  await mongoose.connection.collection("deletedcompanies").insertOne({
    companyId: company._id,
    companyName: company.companyName,
    requestedAt: company.deletionRequestedAt || null,
    deletedAt: new Date(),
    removed,
  });
  await Deliverer().collection.deleteOne({ _id: company._id });
  return { ok: true, removed };
}

async function purgeDueCompanies() {
  const due = await Deliverer().collection
    .find({ deletionScheduledFor: { $lte: new Date() } }, { projection: { _id: 1 } })
    .toArray();
  const results = [];
  for (const { _id } of due) {
    try {
      const r = await purgeCompany(_id);
      results.push({ companyId: String(_id), ...r });
    } catch (error) {
      results.push({ companyId: String(_id), ok: false, error: error.message });
    }
  }
  return results;
}

module.exports = { requestDeletion, cancelDeletion, purgeCompany, purgeDueCompanies, statusOf, graceDays };
