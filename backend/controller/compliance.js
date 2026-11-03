const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany, companyOwns } = require("../middleware/tenantAccess");
const ComplianceDoc = require("../model/complianceDoc");
const Trailer = require("../model/trailer");
const Vehicle = require("../model/vehicle");
const Driver = require("../model/driver");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("tractorUnits")];
const DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 30;

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// expired | due_soon | ok, judged against today (start of the UTC day)
function statusOf(expiresAt, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((new Date(expiresAt).getTime() - today) / DAY);
  const status = days < 0 ? "expired" : days <= DUE_SOON_DAYS ? "due_soon" : "ok";
  return { status, daysLeft: days };
}

async function assertOwner(user, ownerType, ownerId) {
  if (!ownerId || !mongoose.isValidObjectId(ownerId)) throw new ErrorHandler("Choose what this document belongs to", 400);
  let ok = false;
  if (ownerType === "vehicle") ok = await companyOwns(user, "vehicle_ids", ownerId);
  else if (ownerType === "driver") ok = await companyOwns(user, "driver_ids", ownerId);
  else if (ownerType === "trailer") ok = Boolean(await Trailer.exists({ _id: ownerId, tenantId: user.companyId }));
  if (!ok) throw new ErrorHandler("That item was not found for your company", 404);
}

async function clean(body, user) {
  if (!ComplianceDoc.OWNER_TYPES.includes(body.ownerType)) throw new ErrorHandler("Choose a truck, trailer or driver", 400);
  if (!ComplianceDoc.DOC_TYPES.includes(body.docType)) throw new ErrorHandler("Choose a document type", 400);
  await assertOwner(user, body.ownerType, body.ownerId);
  const expiresAt = toDate(body.expiresAt);
  if (!expiresAt) throw new ErrorHandler("An expiry date is required", 400);
  const issuedAt = toDate(body.issuedAt);
  if (body.issuedAt && !issuedAt) throw new ErrorHandler("Issue date is not valid", 400);
  if (issuedAt && issuedAt > expiresAt) throw new ErrorHandler("Issue date can't be after the expiry date", 400);
  return {
    ownerType: body.ownerType,
    ownerId: body.ownerId,
    docType: body.docType,
    number: String(body.number || "").trim().slice(0, 60),
    expiresAt,
    ...(issuedAt ? { issuedAt } : {}),
    notes: String(body.notes || "").trim().slice(0, 500),
  };
}

// Names for the owners, so the list can say "Yellow Card - AFE 5848".
async function ownerNames(tenantId, docs) {
  const ids = (type) => [...new Set(docs.filter((d) => d.ownerType === type).map((d) => String(d.ownerId)))];
  const [vehicles, trailers, drivers] = await Promise.all([
    Vehicle.find({ _id: { $in: ids("vehicle") } }).select("make regNumber").lean(),
    Trailer.find({ tenantId, _id: { $in: ids("trailer") } }).select("regNumber").lean(),
    Driver.find({ _id: { $in: ids("driver") } }).select("name").lean(),
  ]);
  const map = new Map();
  vehicles.forEach((v) => map.set(`vehicle:${v._id}`, `${v.make || ""} ${v.regNumber || ""}`.trim()));
  trailers.forEach((t) => map.set(`trailer:${t._id}`, t.regNumber));
  drivers.forEach((d) => map.set(`driver:${d._id}`, d.name));
  return map;
}

const present = (docs, names) =>
  docs.map((d) => ({
    ...d,
    ownerName: names.get(`${d.ownerType}:${d.ownerId}`) || "(removed)",
    ...statusOf(d.expiresAt),
  }));

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

// What a document can be attached to: this company's trucks, trailers and drivers.
router.get(
  "/meta",
  ...guard,
  handle(async (req, res) => {
    const Deliverer = require("../model/deliverer");
    const company = await Deliverer.findById(req.user.companyId).select("vehicle_ids driver_ids").lean();
    const [vehicles, trailers, drivers] = await Promise.all([
      Vehicle.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.vehicle_ids || [] } }] })
        .select("make regNumber").lean(),
      Trailer.find({ tenantId: req.user.companyId }).select("regNumber").lean(),
      Driver.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.driver_ids || [] } }] })
        .select("name").lean(),
    ]);
    res.status(200).json({ success: true, vehicles, trailers, drivers, docTypes: ComplianceDoc.DOC_TYPES });
  })
);

router.post(
  "/create-doc",
  ...guard,
  handle(async (req, res) => {
    const doc = await clean(req.body, req.user);
    const created = await ComplianceDoc.create({ ...doc, tenantId: req.user.companyId, createdBy: req.user._id });
    res.status(201).json({ success: true, doc: created });
  })
);

// All documents, soonest expiry first. ?status=expired|due_soon|ok narrows the list.
router.get(
  "/get-docs",
  ...guard,
  handle(async (req, res) => {
    const q = { tenantId: req.user.companyId };
    if (ComplianceDoc.OWNER_TYPES.includes(req.query.ownerType)) q.ownerType = req.query.ownerType;
    if (req.query.ownerId && mongoose.isValidObjectId(req.query.ownerId)) q.ownerId = req.query.ownerId;
    const docs = await ComplianceDoc.find(q).sort({ expiresAt: 1 }).limit(2000).lean();
    let shown = present(docs, await ownerNames(req.user.companyId, docs));
    if (["expired", "due_soon", "ok"].includes(req.query.status)) {
      shown = shown.filter((d) => d.status === req.query.status);
    }
    res.status(200).json({
      success: true,
      docs: shown,
      docTypes: ComplianceDoc.DOC_TYPES,
      dueSoonDays: DUE_SOON_DAYS,
    });
  })
);

// What needs attention: already expired, or expiring within `days` (default 30).
router.get(
  "/expiring",
  ...guard,
  handle(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || DUE_SOON_DAYS, 1), 365);
    const limit = new Date(Date.now() + days * DAY);
    const docs = await ComplianceDoc.find({ tenantId: req.user.companyId, expiresAt: { $lte: limit } })
      .sort({ expiresAt: 1 })
      .limit(500)
      .lean();
    const shown = present(docs, await ownerNames(req.user.companyId, docs));
    res.status(200).json({
      success: true,
      expired: shown.filter((d) => d.status === "expired"),
      dueSoon: shown.filter((d) => d.status !== "expired"),
    });
  })
);

router.put(
  "/update-doc/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const existing = await ComplianceDoc.findOne({ _id: req.params.id, tenantId: req.user.companyId });
    if (!existing) return next(new ErrorHandler("Document not found", 404));
    const doc = await clean({ ...existing.toObject(), ...req.body }, req.user);
    existing.set(doc);
    await existing.save();
    res.status(200).json({ success: true, doc: existing });
  })
);

router.delete(
  "/delete-doc/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const removed = await ComplianceDoc.findOneAndDelete({ _id: req.params.id, tenantId: req.user.companyId });
    if (!removed) return next(new ErrorHandler("Document not found", 404));
    res.status(200).json({ success: true, message: "Document deleted" });
  })
);

module.exports = router;
module.exports.statusOf = statusOf;
