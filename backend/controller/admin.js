/*
 * Platform admin console API. Everything here is for Super Admin and Site Admin only: it is the
 * one place that looks across companies. Changing a plan uses PUT /api/v2/tenant/billing (which
 * already audits); this file adds the list, the summary, deletion scheduling and the audit view.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { requireRole } = require("../middleware/tenantAccess");
const ErrorHandler = require("../utils/ErrorHandler");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const AiUsage = require("../model/aiUsage");
const { publicBilling } = require("../services/billing");
const deletion = require("../services/companyDeletion");

const platformOnly = [isAuthenticated, requireRole("Super Admin", "Site Admin")];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const validId = (id) => mongoose.isValidObjectId(id);

async function audit(req, action, company, extra = {}) {
  await mongoose.connection.collection("auditlogs").insertOne({
    at: new Date(),
    by: req.user._id,
    action,
    companyId: company._id,
    ...extra,
  });
}

function rowFor(company, users, ai) {
  const owner = users.owner || null;
  return {
    id: String(company._id),
    name: company.companyName,
    city: company.city,
    createdAt: company.createdAt || (company._id.getTimestamp ? company._id.getTimestamp() : null),
    ownerEmail: owner,
    users: users.count || 0,
    vehicles: (company.vehicle_ids || []).length,
    drivers: (company.driver_ids || []).length,
    customers: (company.customer_ids || []).length,
    jobs: (company.job_ids || []).length,
    billing: publicBilling(company.billing),
    note: (company.billing && company.billing.note) || "",
    deletion: deletion.statusOf(company),
    aiPagesThisMonth: ai ? ai.pages : 0,
    aiCallsThisMonth: ai ? ai.calls : 0,
  };
}

async function loadRows(filter = {}) {
  const companies = await Deliverer.find(filter).sort({ createdAt: -1 }).lean();
  const ids = companies.map((c) => c._id);
  const people = await User.find({ companyId: { $in: ids } })
    .select("email role companyId createdAt")
    .sort({ createdAt: 1 })
    .lean();
  const byCompany = new Map();
  for (const u of people) {
    const key = String(u.companyId);
    const entry = byCompany.get(key) || { count: 0, owner: null };
    entry.count += 1;
    if (!entry.owner && u.role === "Deliverer Admin") entry.owner = u.email;
    byCompany.set(key, entry);
  }
  const usage = await AiUsage.find({ tenantId: { $in: ids }, month: thisMonth() }).lean();
  const aiBy = new Map(usage.map((u) => [String(u.tenantId), u]));
  return companies.map((c) => rowFor(c, byCompany.get(String(c._id)) || {}, aiBy.get(String(c._id))));
}

// GET /api/v2/admin/companies?search=
router.get(
  "/companies",
  ...platformOnly,
  catchAsyncErrors(async (req, res) => {
    let rows = await loadRows();
    const q = String(req.query.search || "").trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.name} ${r.ownerEmail || ""} ${r.city || ""}`.toLowerCase().includes(q));
    res.status(200).json({ success: true, companies: rows });
  })
);

// GET /api/v2/admin/summary
router.get(
  "/summary",
  ...platformOnly,
  catchAsyncErrors(async (req, res) => {
    const rows = await loadRows();
    const byState = {};
    let monthlyUsd = 0;
    for (const r of rows) {
      byState[r.billing.state] = (byState[r.billing.state] || 0) + 1;
      if (r.billing.state === "active" && r.billing.priceUsd) monthlyUsd += r.billing.priceUsd;
    }
    const soon = rows.filter((r) => r.billing.state === "trial" && r.billing.daysLeft <= 7).length;
    res.status(200).json({
      success: true,
      summary: {
        companies: rows.length,
        byState,
        monthlyUsd, // what active companies pay per month at list price
        trialsEndingWithin7Days: soon,
        pendingDeletion: rows.filter((r) => r.deletion.pending).length,
        aiPagesThisMonth: rows.reduce((n, r) => n + r.aiPagesThisMonth, 0),
        aiCallsThisMonth: rows.reduce((n, r) => n + r.aiCallsThisMonth, 0),
        month: thisMonth(),
      },
    });
  })
);

// POST /api/v2/admin/companies/:id/deletion   schedule deletion (same cooling-off as the owner's own request)
router.post(
  "/companies/:id/deletion",
  ...platformOnly,
  catchAsyncErrors(async (req, res, next) => {
    if (!validId(req.params.id)) return next(new ErrorHandler("Company not found", 404));
    const company = await Deliverer.findById(req.params.id).lean();
    if (!company) return next(new ErrorHandler("Company not found", 404));
    const result = await deletion.requestDeletion({
      companyId: company._id,
      userId: req.user._id,
      confirmName: company.companyName, // the platform admin has picked this company on purpose
    });
    if (!result.ok) return next(new ErrorHandler(result.error, result.status || 400));
    await audit(req, "deletion.schedule", company, { scheduledFor: result.scheduledFor });
    res.status(200).json({ success: true, deletion: result });
  })
);

// DELETE /api/v2/admin/companies/:id/deletion   cancel a scheduled deletion
router.delete(
  "/companies/:id/deletion",
  ...platformOnly,
  catchAsyncErrors(async (req, res, next) => {
    if (!validId(req.params.id)) return next(new ErrorHandler("Company not found", 404));
    const company = await Deliverer.findById(req.params.id).lean();
    if (!company) return next(new ErrorHandler("Company not found", 404));
    await deletion.cancelDeletion(company._id);
    await audit(req, "deletion.cancel", company);
    res.status(200).json({ success: true, deletion: { pending: false } });
  })
);

// GET /api/v2/admin/companies/:id/audit
router.get(
  "/companies/:id/audit",
  ...platformOnly,
  catchAsyncErrors(async (req, res, next) => {
    if (!validId(req.params.id)) return next(new ErrorHandler("Company not found", 404));
    const rows = await mongoose.connection
      .collection("auditlogs")
      .find({ companyId: new mongoose.Types.ObjectId(req.params.id) })
      .sort({ at: -1 })
      .limit(50)
      .toArray();
    const by = await User.find({ _id: { $in: rows.map((r) => r.by).filter(Boolean) } }).select("email").lean();
    const emailOf = new Map(by.map((u) => [String(u._id), u.email]));
    res.status(200).json({
      success: true,
      entries: rows.map((r) => ({
        at: r.at,
        action: r.action,
        by: emailOf.get(String(r.by)) || String(r.by || ""),
        after: r.after || null,
        scheduledFor: r.scheduledFor || null,
      })),
    });
  })
);

module.exports = router;
