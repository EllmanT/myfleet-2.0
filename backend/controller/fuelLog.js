const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireFinance } = require("../middleware/financeAccess");
const { requireModule } = require("../middleware/moduleAccess");
const FuelFill = require("../model/fuelFill");
const Vehicle = require("../model/vehicle");
const { analyseFills, weekRange, weekSummary, whatsappText, expectedKmpl } = require("../services/fuelCheck");
const router = express.Router();

const toDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const num = (v, name, min) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ErrorHandler(`${name} must be a number of ${min} or more`, 400);
  return n;
};

async function cleanBody(body, companyId) {
  if (!mongoose.isValidObjectId(body.vehicleId)) throw new ErrorHandler("Choose a truck", 400);
  const vehicle = await Vehicle.findOne({ _id: body.vehicleId, companyId: String(companyId) });
  if (!vehicle) throw new ErrorHandler("Truck not found for your company", 404);
  const filledAt = toDate(body.filledAt);
  if (!filledAt) throw new ErrorHandler("A valid date and time is required", 400);
  const doc = {
    vehicleId: vehicle._id,
    driverName: String(body.driverName || "").trim(),
    filledAt,
    odometer: num(body.odometer, "Odometer", 0),
    litres: num(body.litres, "Litres", 0.1),
    amount: Math.round(num(body.amount, "Amount", 0) * 100) / 100,
    fullTank: body.fullTank !== false && body.fullTank !== "false",
    purpose: body.purpose === "private" ? "private" : "business",
    station: String(body.station || "").trim(),
    photoPosted: body.photoPosted === true || body.photoPosted === "true",
    notes: String(body.notes || "").trim(),
  };
  if (body.cashGiven !== undefined && body.cashGiven !== "" && body.cashGiven !== null) {
    doc.cashGiven = num(body.cashGiven, "Cash given", 0);
  }
  return doc;
}

// Every fill of the company, analysed truck by truck.
async function loadAnalysed(companyId) {
  const [vehicles, fills] = await Promise.all([
    Vehicle.find({ companyId: String(companyId) }).lean(),
    FuelFill.find({ companyId }).lean(),
  ]);
  const byVehicle = {};
  fills.forEach((f) => (byVehicle[String(f.vehicleId)] = byVehicle[String(f.vehicleId)] || []).push(f));
  const out = vehicles.map((v) => {
    const expected = expectedKmpl(v);
    return {
      vehicle: v,
      name: `${v.make || ""} ${v.regNumber || ""}`.trim(),
      expected,
      analysed: analyseFills(byVehicle[String(v._id)] || [], expected),
    };
  });
  return out;
}

router.post(
  "/create-fill",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const doc = await cleanBody(req.body, req.user.companyId);
      const fill = await FuelFill.create({ ...doc, companyId: req.user.companyId, createdBy: req.user._id });
      res.status(201).json({ success: true, fill });
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  })
);

router.put(
  "/update-fill/:id",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
      const existing = await FuelFill.findOne({ _id: req.params.id, companyId: req.user.companyId });
      if (!existing) return next(new ErrorHandler("Fill-up not found", 404));
      const doc = await cleanBody({ ...existing.toObject(), ...req.body }, req.user.companyId);
      existing.set(doc);
      await existing.save();
      res.status(200).json({ success: true, fill: existing });
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  })
);

router.delete(
  "/delete-fill/:id",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const r = await FuelFill.deleteOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!r.deletedCount) return next(new ErrorHandler("Fill-up not found", 404));
    res.status(200).json({ success: true });
  })
);

// All fills, newest first, each with its check result.
router.get(
  "/get-fills",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { from, to, vehicleId } = req.query;
      const all = await loadAnalysed(req.user.companyId);
      let list = all
        .filter((v) => !vehicleId || String(v.vehicle._id) === vehicleId)
        .flatMap((v) => v.analysed.map((f) => ({ ...f, vehicleName: v.name, expectedKmpl: v.expected })));
      if (from && toDate(from)) list = list.filter((f) => new Date(f.filledAt) >= toDate(from));
      if (to && toDate(to)) list = list.filter((f) => new Date(f.filledAt) <= toDate(to));
      list.sort((a, b) => new Date(b.filledAt) - new Date(a.filledAt));
      res.status(200).json({ success: true, fills: list.slice(0, 500), total: list.length });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// Weekly check (Monday to Sunday) with ready-to-paste WhatsApp text.
router.get(
  "/weekly",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const date = toDate(req.query.date) || new Date();
      const { start, end } = weekRange(date);
      const all = await loadAnalysed(req.user.companyId);
      const vehicles = all.map((v) => ({
        vehicleId: v.vehicle._id,
        name: v.name,
        ...weekSummary(v.analysed, start, end, v.expected),
      }));
      const text = whatsappText(start, vehicles.map((v) => ({ name: v.name, s: v })));
      res.status(200).json({ success: true, weekStart: start, weekEnd: end, vehicles, text });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

router.get(
  "/meta",
  isAuthenticated,
  requireFinance,
  requireModule("fuel"),
  catchAsyncErrors(async (req, res) => {
    const vehicles = await Vehicle.find({ companyId: String(req.user.companyId) }).lean();
    res.status(200).json({
      success: true,
      vehicles: vehicles.map((v) => ({ _id: v._id, name: `${v.make || ""} ${v.regNumber || ""}`.trim(), expectedKmpl: expectedKmpl(v) })),
    });
  })
);

module.exports = router;
