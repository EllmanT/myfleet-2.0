const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany, companyOwns } = require("../middleware/tenantAccess");
const { escapeRegex } = require("../utils/escapeRegex");
const { withTotals, detectCrossBorder, round2 } = require("../utils/tripMath");
const Trip = require("../model/trip");
const Trailer = require("../model/trailer");
const Vehicle = require("../model/vehicle");
const Driver = require("../model/driver");
const Customer = require("../model/customer");
const Deliverer = require("../model/deliverer");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("crossBorder")];

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const text = (v, max = 200) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);
const num = (v, label, { min = 0 } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ErrorHandler(`${label} must be a number of ${min} or more`, 400);
  return n;
};

// Checks the body and returns a clean document, or throws ErrorHandler.
// Every referenced vehicle, trailer and driver must belong to the caller's company.
async function cleanTrip(body, user) {
  const tenantId = user.companyId;
  const date = toDate(body.date);
  if (!date) throw new ErrorHandler("A valid trip date is required", 400);

  const customerName = text(body.customerName, 120);
  if (!customerName) throw new ErrorHandler("Customer is required", 400);

  if (body.price === undefined || body.price === "") throw new ErrorHandler("Price is required", 400);
  const price = round2(num(body.price, "Price"));

  const currency = Trip.CURRENCIES.includes(body.currency) ? body.currency : "USD";

  const rawStops = Array.isArray(body.stops) ? body.stops : [];
  const stops = rawStops
    .map((s) => ({ place: text(s && s.place, 80), country: text(s && s.country, 40) }))
    .filter((s) => s.place);
  if (stops.length < 2) throw new ErrorHandler("Add at least a loading point and an offloading point", 400);
  if (stops.length > 12) throw new ErrorHandler("Too many stops", 400);

  const doc = {
    clientRef: text(body.clientRef, 40) || undefined,
    date,
    transporterName: text(body.transporterName, 120),
    customerName,
    supplierName: text(body.supplierName, 120),
    stops,
    isCrossBorder: detectCrossBorder(stops),
    cargoDescription: text(body.cargoDescription, 300),
    containerNo: text(body.containerNo, 40),
    consignmentNo: text(body.consignmentNo, 60),
    price,
    currency,
    notes: text(body.notes, 1000),
  };

  if (body.distanceKm !== undefined && body.distanceKm !== "" && body.distanceKm !== null) {
    doc.distanceKm = num(body.distanceKm, "Distance");
  }

  const deliveredAt = toDate(body.deliveredAt);
  if (body.deliveredAt && !deliveredAt) throw new ErrorHandler("Delivery date is not valid", 400);
  if (deliveredAt && deliveredAt < date) throw new ErrorHandler("Delivery date can't be before the trip date", 400);
  if (deliveredAt) doc.deliveredAt = deliveredAt;

  doc.status = Trip.STATUSES.includes(body.status) ? body.status : deliveredAt ? "delivered" : "planned";

  // assets: must be this company's
  if (body.horseId) {
    if (!(await companyOwns(user, "vehicle_ids", body.horseId))) throw new ErrorHandler("Truck not found for your company", 404);
    doc.horseId = body.horseId;
  }
  if (body.driverId) {
    if (!(await companyOwns(user, "driver_ids", body.driverId))) throw new ErrorHandler("Driver not found for your company", 404);
    doc.driverId = body.driverId;
  }
  if (body.trailerId) {
    if (!mongoose.isValidObjectId(body.trailerId) || !(await Trailer.exists({ _id: body.trailerId, tenantId }))) {
      throw new ErrorHandler("Trailer not found for your company", 404);
    }
    doc.trailerId = body.trailerId;
  }

  // cost lines
  const rawLines = Array.isArray(body.costLines) ? body.costLines : [];
  if (rawLines.length > 60) throw new ErrorHandler("Too many cost lines", 400);
  doc.costLines = rawLines.map((l, i) => {
    const type = Trip.COST_TYPES.includes(l.type) ? l.type : "other";
    const amount = round2(num(l.amount, `Cost line ${i + 1} amount`));
    const lineDate = toDate(l.date);
    return {
      type,
      description: text(l.description, 200),
      amount,
      currency: Trip.CURRENCIES.includes(l.currency) ? l.currency : currency,
      ...(lineDate ? { date: lineDate } : {}),
      receiptNo: text(l.receiptNo, 60),
    };
  });

  // border crossings
  const rawCross = Array.isArray(body.borderCrossings) ? body.borderCrossings : [];
  if (rawCross.length > 12) throw new ErrorHandler("Too many border crossings", 400);
  doc.borderCrossings = rawCross
    .filter((c) => text(c && c.post))
    .map((c) => {
      const arrivedAt = toDate(c.arrivedAt);
      const clearedAt = toDate(c.clearedAt);
      if (arrivedAt && clearedAt && clearedAt < arrivedAt) {
        throw new ErrorHandler(`Border ${text(c.post)}: cleared time is before arrival`, 400);
      }
      return {
        post: text(c.post, 80),
        direction: c.direction === "in" ? "in" : "out",
        ...(arrivedAt ? { arrivedAt } : {}),
        ...(clearedAt ? { clearedAt } : {}),
      };
    });

  return doc;
}

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error && error.code === 11000) {
        return next(new ErrorHandler("That job reference is already used by another trip", 409));
      }
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

router.post(
  "/create-trip",
  ...guard,
  handle(async (req, res) => {
    const doc = await cleanTrip(req.body, req.user);
    const trip = await Trip.create({ ...doc, tenantId: req.user.companyId, createdBy: req.user._id });
    res.status(201).json({ success: true, trip: withTotals(trip) });
  })
);

router.get(
  "/get-trips",
  ...guard,
  handle(async (req, res) => {
    const { from, to, search, horseId, status, crossBorder } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);
    const q = { tenantId: req.user.companyId };
    if (toDate(from) || toDate(to)) {
      q.date = {};
      if (toDate(from)) q.date.$gte = toDate(from);
      if (toDate(to)) q.date.$lte = toDate(to);
    }
    if (status && Trip.STATUSES.includes(status)) q.status = status;
    if (horseId && mongoose.isValidObjectId(horseId)) q.horseId = horseId;
    if (crossBorder === "true") q.isCrossBorder = true;
    if (crossBorder === "false") q.isCrossBorder = false;
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim().slice(0, 60)), "i");
      q.$or = [
        { clientRef: rx }, { customerName: rx }, { supplierName: rx },
        { cargoDescription: rx }, { "stops.place": rx }, { containerNo: rx },
      ];
    }
    const [trips, total] = await Promise.all([
      Trip.find(q).sort({ date: -1, _id: -1 }).skip(page * pageSize).limit(pageSize).lean(),
      Trip.countDocuments(q),
    ]);
    res.status(200).json({ success: true, trips: trips.map(withTotals), total, page, pageSize });
  })
);

router.get(
  "/summary",
  ...guard,
  handle(async (req, res) => {
    const { from, to } = req.query;
    const q = { tenantId: req.user.companyId, status: { $ne: "cancelled" } };
    if (toDate(from) || toDate(to)) {
      q.date = {};
      if (toDate(from)) q.date.$gte = toDate(from);
      if (toDate(to)) q.date.$lte = toDate(to);
    }
    const trips = (await Trip.find(q).limit(10000).lean()).map(withTotals);
    const byCurrency = {};
    const byMonth = {};
    let km = 0;
    let crossBorder = 0;
    trips.forEach((t) => {
      const c = t.currency || "USD";
      byCurrency[c] = byCurrency[c] || { revenue: 0, costs: 0 };
      byCurrency[c].revenue = round2(byCurrency[c].revenue + t.price);
      Object.entries(t.costsByCurrency).forEach(([cc, amt]) => {
        byCurrency[cc] = byCurrency[cc] || { revenue: 0, costs: 0 };
        byCurrency[cc].costs = round2(byCurrency[cc].costs + amt);
      });
      km += Number(t.distanceKm || 0);
      if (t.isCrossBorder) crossBorder += 1;
      const month = new Date(t.date).toISOString().slice(0, 7);
      byMonth[month] = byMonth[month] || { trips: 0, revenue: {} };
      byMonth[month].trips += 1;
      byMonth[month].revenue[c] = round2((byMonth[month].revenue[c] || 0) + t.price);
    });
    res.status(200).json({
      success: true,
      trips: trips.length,
      crossBorderTrips: crossBorder,
      distanceKm: Math.round(km),
      byCurrency,
      byMonth: Object.entries(byMonth)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, v]) => ({ month, ...v })),
    });
  })
);

router.get(
  "/meta",
  ...guard,
  handle(async (req, res) => {
    const company = await Deliverer.findById(req.user.companyId).select("vehicle_ids driver_ids customer_ids").lean();
    const [vehicles, trailers, drivers, customers] = await Promise.all([
      Vehicle.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.vehicle_ids || [] } }] })
        .select("make regNumber size").lean(),
      Trailer.find({ tenantId: req.user.companyId, active: true }).select("regNumber type").lean(),
      Driver.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.driver_ids || [] } }] })
        .select("name").lean(),
      Customer.find({ _id: { $in: company.customer_ids || [] } }).select("name").lean(),
    ]);
    res.status(200).json({
      success: true,
      vehicles, trailers, drivers,
      customers: customers.map((c) => c.name),
      costTypes: Trip.COST_TYPES,
      currencies: Trip.CURRENCIES,
      statuses: Trip.STATUSES,
    });
  })
);

router.put(
  "/update-trip/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const existing = await Trip.findOne({ _id: req.params.id, tenantId: req.user.companyId });
    if (!existing) return next(new ErrorHandler("Trip not found", 404));
    const merged = { ...existing.toObject(), ...req.body };
    const doc = await cleanTrip(merged, req.user);
    // fields the form clears must actually clear
    ["horseId", "trailerId", "driverId", "deliveredAt", "distanceKm", "clientRef"].forEach((k) => {
      if (!(k in doc)) existing[k] = undefined;
    });
    existing.set(doc);
    await existing.save();
    res.status(200).json({ success: true, trip: withTotals(existing) });
  })
);

router.delete(
  "/delete-trip/:id",
  ...guard,
  handle(async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
    const removed = await Trip.findOneAndDelete({ _id: req.params.id, tenantId: req.user.companyId });
    if (!removed) return next(new ErrorHandler("Trip not found", 404));
    res.status(200).json({ success: true, message: "Trip deleted" });
  })
);

module.exports = router;
