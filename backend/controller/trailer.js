const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany } = require("../middleware/tenantAccess");
const Trailer = require("../model/trailer");
const Trip = require("../model/trip");
const ComplianceDoc = require("../model/complianceDoc");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("tractorUnits")];

const clean = (body) => {
  const regNumber = String(body.regNumber || "").trim().slice(0, 20);
  if (!regNumber) throw new ErrorHandler("Registration number is required", 400);
  const doc = {
    regNumber,
    regKey: Trailer.toRegKey(regNumber),
    type: String(body.type || "other").trim().slice(0, 30) || "other",
    notes: String(body.notes || "").trim().slice(0, 500),
    active: body.active === undefined ? true : Boolean(body.active),
  };
  for (const [k, label, max] of [["axles", "Axles", 12], ["capacityTons", "Capacity", 200]]) {
    if (body[k] !== undefined && body[k] !== "" && body[k] !== null) {
      const n = Number(body[k]);
      if (!Number.isFinite(n) || n < 0 || n > max) throw new ErrorHandler(`${label} is not valid`, 400);
      doc[k] = n;
    }
  }
  return doc;
};

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error && error.code === 11000) {
        return next(new ErrorHandler("A trailer with that registration already exists", 409));
      }
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

router.post(
  "/create-trailer",
  ...guard,
  handle(async (req, res) => {
    const trailer = await Trailer.create({ ...clean(req.body), tenantId: req.user.companyId });
    res.status(201).json({ success: true, trailer });
  })
);

router.get(
  "/get-trailers",
  ...guard,
  handle(async (req, res) => {
    const q = { tenantId: req.user.companyId };
    if (req.query.active === "true") q.active = true;
    const trailers = await Trailer.find(q).sort({ regNumber: 1 }).lean();
    res.status(200).json({ success: true, trailers, types: Trailer.TRAILER_TYPES });
  })
);

router.put(
  "/update-trailer/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const existing = await Trailer.findOne({ _id: req.params.id, tenantId: req.user.companyId });
    if (!existing) return next(new ErrorHandler("Trailer not found", 404));
    existing.set(clean({ ...existing.toObject(), ...req.body }));
    await existing.save();
    res.status(200).json({ success: true, trailer: existing });
  })
);

router.delete(
  "/delete-trailer/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const trailer = await Trailer.findOne({ _id: req.params.id, tenantId: req.user.companyId });
    if (!trailer) return next(new ErrorHandler("Trailer not found", 404));
    const used = await Trip.countDocuments({ tenantId: req.user.companyId, trailerId: trailer._id });
    if (used > 0) {
      return next(
        new ErrorHandler(`This trailer is on ${used} trip(s). Mark it inactive instead of deleting it.`, 409)
      );
    }
    await ComplianceDoc.deleteMany({ tenantId: req.user.companyId, ownerType: "trailer", ownerId: trailer._id });
    await trailer.deleteOne();
    res.status(200).json({ success: true, message: "Trailer deleted" });
  })
);

module.exports = router;
