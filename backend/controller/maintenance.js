const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany, companyOwns } = require("../middleware/tenantAccess");
const { currentOdometer, trailerKm, planStatus, fitmentKm, round2 } = require("../services/maintenance");
const MaintenanceRecord = require("../model/maintenanceRecord");
const ServicePlan = require("../model/servicePlan");
const Tyre = require("../model/tyre");
const TyreFitment = require("../model/tyreFitment");
const Trailer = require("../model/trailer");
const Vehicle = require("../model/vehicle");
const Deliverer = require("../model/deliverer");
const Job = require("../model/job");
const Trip = require("../model/trip");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("maintenance")];

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const text = (v, max = 200) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);
const optNum = (v, label, { min = 0 } = {}) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ErrorHandler(`${label} must be a number of ${min} or more`, 400);
  return n;
};
const idOf = (req, key = "id") => {
  if (!mongoose.isValidObjectId(req.params[key])) throw new ErrorHandler("Invalid id", 400);
  return req.params[key];
};

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error && error.code === 11000) return next(new ErrorHandler("That serial number is already in use", 409));
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

// A truck or trailer must belong to the caller's company.
async function assertAsset(user, assetType, assetId) {
  if (!["vehicle", "trailer"].includes(assetType)) throw new ErrorHandler("Choose a truck or a trailer", 400);
  if (!assetId || !mongoose.isValidObjectId(assetId)) throw new ErrorHandler("Choose a truck or a trailer", 400);
  const ok =
    assetType === "vehicle"
      ? await companyOwns(user, "vehicle_ids", assetId)
      : Boolean(await Trailer.exists({ _id: assetId, tenantId: user.companyId }));
  if (!ok) throw new ErrorHandler("That truck or trailer was not found for your company", 404);
}

async function assetNames(user, items) {
  const ids = (t) => [...new Set(items.filter((i) => i.assetType === t).map((i) => String(i.assetId)))];
  const [vehicles, trailers] = await Promise.all([
    Vehicle.find({ _id: { $in: ids("vehicle") } }).select("make regNumber").lean(),
    Trailer.find({ tenantId: user.companyId, _id: { $in: ids("trailer") } }).select("regNumber").lean(),
  ]);
  const map = new Map();
  vehicles.forEach((v) => map.set(`vehicle:${v._id}`, `${v.make || ""} ${v.regNumber || ""}`.trim()));
  trailers.forEach((t) => map.set(`trailer:${t._id}`, t.regNumber));
  return (item) => map.get(`${item.assetType}:${item.assetId}`) || "(removed)";
}

router.get(
  "/meta",
  ...guard,
  handle(async (req, res) => {
    const company = await Deliverer.findById(req.user.companyId).select("vehicle_ids").lean();
    const [vehicles, trailers] = await Promise.all([
      Vehicle.find({ $or: [{ tenantId: req.user.companyId }, { _id: { $in: company.vehicle_ids || [] } }] }).select("make regNumber").lean(),
      Trailer.find({ tenantId: req.user.companyId }).select("regNumber active").lean(),
    ]);
    res.status(200).json({ success: true, vehicles, trailers, types: MaintenanceRecord.TYPES });
  })
);

/* ---------------- workshop records ---------------- */

async function cleanRecord(body, user) {
  await assertAsset(user, body.assetType, body.assetId);
  const date = toDate(body.date);
  if (!date) throw new ErrorHandler("A valid date is required", 400);
  const doc = {
    assetType: body.assetType,
    assetId: body.assetId,
    date,
    type: MaintenanceRecord.TYPES.includes(body.type) ? body.type : "service",
    description: text(body.description),
    supplier: text(body.supplier, 120),
    cost: round2(optNum(body.cost, "Cost") || 0),
    notes: text(body.notes, 1000),
  };
  const odometer = optNum(body.odometer, "Odometer");
  if (odometer !== undefined) {
    if (body.assetType === "trailer") throw new ErrorHandler("Trailers don't have an odometer", 400);
    doc.odometer = odometer;
  }
  if (body.planId) {
    const plan = mongoose.isValidObjectId(body.planId)
      ? await ServicePlan.findOne({ _id: body.planId, tenantId: user.companyId })
      : null;
    if (!plan || String(plan.assetId) !== String(body.assetId)) throw new ErrorHandler("That service plan isn't for this truck or trailer", 400);
    doc.planId = plan._id;
  }
  return doc;
}

router.post("/create-record", ...guard, handle(async (req, res) => {
  const doc = await cleanRecord(req.body, req.user);
  const record = await MaintenanceRecord.create({ ...doc, tenantId: req.user.companyId, createdBy: req.user._id });
  res.status(201).json({ success: true, record });
}));

router.get("/get-records", ...guard, handle(async (req, res) => {
  const q = { tenantId: req.user.companyId };
  if (["vehicle", "trailer"].includes(req.query.assetType)) q.assetType = req.query.assetType;
  if (req.query.assetId && mongoose.isValidObjectId(req.query.assetId)) q.assetId = req.query.assetId;
  if (toDate(req.query.from) || toDate(req.query.to)) {
    q.date = {};
    if (toDate(req.query.from)) q.date.$gte = toDate(req.query.from);
    if (toDate(req.query.to)) q.date.$lte = toDate(req.query.to);
  }
  const records = await MaintenanceRecord.find(q).sort({ date: -1, _id: -1 }).limit(1000).lean();
  const nameOf = await assetNames(req.user, records);
  const total = round2(records.reduce((s, r) => s + r.cost, 0));
  res.status(200).json({ success: true, records: records.map((r) => ({ ...r, assetName: nameOf(r) })), total });
}));

router.put("/update-record/:id", ...guard, handle(async (req, res, next) => {
  const existing = await MaintenanceRecord.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!existing) return next(new ErrorHandler("Record not found", 404));
  const doc = await cleanRecord({ ...existing.toObject(), ...req.body }, req.user);
  if (!("odometer" in doc)) existing.odometer = undefined;
  if (!("planId" in doc)) existing.planId = undefined;
  existing.set(doc);
  await existing.save();
  res.status(200).json({ success: true, record: existing });
}));

router.delete("/delete-record/:id", ...guard, handle(async (req, res, next) => {
  const removed = await MaintenanceRecord.findOneAndDelete({ _id: idOf(req), tenantId: req.user.companyId });
  if (!removed) return next(new ErrorHandler("Record not found", 404));
  res.status(200).json({ success: true, message: "Record deleted" });
}));

/* ---------------- service plans ---------------- */

async function cleanPlan(body, user) {
  await assertAsset(user, body.assetType, body.assetId);
  const name = text(body.name, 80);
  if (!name) throw new ErrorHandler("Give the plan a name, e.g. Full service", 400);
  const intervalKm = optNum(body.intervalKm, "Interval (km)", { min: 1 });
  const intervalDays = optNum(body.intervalDays, "Interval (days)", { min: 1 });
  if (!intervalKm && !intervalDays) throw new ErrorHandler("Set how often it is due, in km, days, or both", 400);
  const baselineDate = toDate(body.baselineDate) || new Date();
  const doc = { assetType: body.assetType, assetId: body.assetId, name, baselineDate, active: body.active === undefined ? true : Boolean(body.active) };
  if (intervalKm) doc.intervalKm = intervalKm;
  if (intervalDays) doc.intervalDays = intervalDays;
  const baselineKm = optNum(body.baselineKm, "Last done at (km)");
  if (baselineKm !== undefined) doc.baselineKm = baselineKm;
  return doc;
}

async function withStatus(user, plans, now = new Date()) {
  const nameOf = await assetNames(user, plans);
  const out = [];
  for (const plan of plans) {
    const last = await MaintenanceRecord.findOne({ tenantId: user.companyId, planId: plan._id }).sort({ date: -1 }).lean();
    const lastDate = last ? last.date : plan.baselineDate;
    let kmSince = null;
    let lastKm = last && Number.isFinite(last.odometer) ? last.odometer : plan.baselineKm;
    if (plan.assetType === "vehicle") {
      const odo = await currentOdometer(user.companyId, plan.assetId);
      if (Number.isFinite(odo) && Number.isFinite(lastKm)) kmSince = Math.max(0, odo - lastKm);
    } else {
      kmSince = await trailerKm(user.companyId, plan.assetId, lastDate, now);
    }
    out.push({
      ...plan,
      assetName: nameOf(plan),
      lastDoneAt: lastDate,
      lastDoneKm: Number.isFinite(lastKm) ? lastKm : null,
      kmSince,
      ...planStatus({ intervalKm: plan.intervalKm, intervalDays: plan.intervalDays, lastDate, kmSince, now }),
    });
  }
  const rank = { overdue: 0, due_soon: 1, ok: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status]);
}

router.post("/create-plan", ...guard, handle(async (req, res) => {
  const doc = await cleanPlan(req.body, req.user);
  // for a truck with no starting reading given, start from where the odometer is now
  if (doc.assetType === "vehicle" && doc.baselineKm === undefined) {
    const odo = await currentOdometer(req.user.companyId, doc.assetId);
    if (Number.isFinite(odo)) doc.baselineKm = odo;
  }
  const plan = await ServicePlan.create({ ...doc, tenantId: req.user.companyId });
  res.status(201).json({ success: true, plan: (await withStatus(req.user, [plan.toObject()]))[0] });
}));

router.get("/get-plans", ...guard, handle(async (req, res) => {
  const q = { tenantId: req.user.companyId, active: true };
  if (req.query.assetId && mongoose.isValidObjectId(req.query.assetId)) q.assetId = req.query.assetId;
  const plans = await ServicePlan.find(q).lean();
  const shown = await withStatus(req.user, plans);
  res.status(200).json({
    success: true,
    plans: shown,
    overdue: shown.filter((p) => p.status === "overdue").length,
    dueSoon: shown.filter((p) => p.status === "due_soon").length,
  });
}));

router.put("/update-plan/:id", ...guard, handle(async (req, res, next) => {
  const existing = await ServicePlan.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!existing) return next(new ErrorHandler("Plan not found", 404));
  const doc = await cleanPlan({ ...existing.toObject(), ...req.body }, req.user);
  ["intervalKm", "intervalDays", "baselineKm"].forEach((k) => { if (!(k in doc)) existing[k] = undefined; });
  existing.set(doc);
  await existing.save();
  res.status(200).json({ success: true, plan: (await withStatus(req.user, [existing.toObject()]))[0] });
}));

router.delete("/delete-plan/:id", ...guard, handle(async (req, res, next) => {
  const plan = await ServicePlan.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!plan) return next(new ErrorHandler("Plan not found", 404));
  await MaintenanceRecord.updateMany({ tenantId: req.user.companyId, planId: plan._id }, { $unset: { planId: 1 } });
  await plan.deleteOne();
  res.status(200).json({ success: true, message: "Plan deleted" });
}));

/* ---------------- tyres ---------------- */

router.post("/create-tyre", ...guard, handle(async (req, res) => {
  const serial = text(req.body.serial, 40);
  if (!serial) throw new ErrorHandler("Serial number is required", 400);
  const purchasedAt = toDate(req.body.purchasedAt);
  const tyre = await Tyre.create({
    tenantId: req.user.companyId, serial, serialKey: Tyre.toKey(serial),
    brand: text(req.body.brand, 60), size: text(req.body.size, 30),
    condition: ["new", "retread", "used"].includes(req.body.condition) ? req.body.condition : "new",
    cost: round2(optNum(req.body.cost, "Cost") || 0),
    ...(purchasedAt ? { purchasedAt } : {}), notes: text(req.body.notes, 500),
  });
  res.status(201).json({ success: true, tyre });
}));

// Every tyre with where it is now, how far it has run in total, and what it costs per km.
router.get("/get-tyres", ...guard, handle(async (req, res) => {
  const q = { tenantId: req.user.companyId };
  if (["in_stock", "fitted", "scrapped"].includes(req.query.status)) q.status = req.query.status;
  const tyres = await Tyre.find(q).sort({ serial: 1 }).limit(1000).lean();
  const fits = await TyreFitment.find({ tenantId: req.user.companyId, tyreId: { $in: tyres.map((t) => t._id) } }).sort({ fittedAt: -1 }).lean();
  const nameOf = await assetNames(req.user, fits);
  const byTyre = new Map();
  fits.forEach((f) => { if (!byTyre.has(String(f.tyreId))) byTyre.set(String(f.tyreId), []); byTyre.get(String(f.tyreId)).push(f); });

  const out = [];
  for (const t of tyres) {
    const list = byTyre.get(String(t._id)) || [];
    let totalKm = 0;
    let known = false;
    for (const f of list) {
      const km = await fitmentKm(req.user.companyId, f);
      if (km !== null) { totalKm += km; known = true; }
    }
    const open = list.find((f) => !f.removedAt);
    out.push({
      ...t,
      fittedTo: open ? { fitmentId: open._id, assetName: nameOf(open), assetType: open.assetType, assetId: open.assetId, position: open.position, since: open.fittedAt } : null,
      totalKm: known ? Math.round(totalKm) : null,
      costPerKm: known && totalKm > 0 ? Math.round((t.cost / totalKm) * 10000) / 10000 : null,
      fitments: list.length,
    });
  }
  res.status(200).json({ success: true, tyres: out });
}));

router.put("/update-tyre/:id", ...guard, handle(async (req, res, next) => {
  const tyre = await Tyre.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!tyre) return next(new ErrorHandler("Tyre not found", 404));
  if (req.body.brand !== undefined) tyre.brand = text(req.body.brand, 60);
  if (req.body.size !== undefined) tyre.size = text(req.body.size, 30);
  if (req.body.notes !== undefined) tyre.notes = text(req.body.notes, 500);
  if (req.body.cost !== undefined) tyre.cost = round2(optNum(req.body.cost, "Cost") || 0);
  await tyre.save();
  res.status(200).json({ success: true, tyre });
}));

router.delete("/delete-tyre/:id", ...guard, handle(async (req, res, next) => {
  const tyre = await Tyre.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!tyre) return next(new ErrorHandler("Tyre not found", 404));
  if (await TyreFitment.exists({ tenantId: req.user.companyId, tyreId: tyre._id })) {
    throw new ErrorHandler("This tyre has been fitted before, so its history is kept. Mark it scrapped instead.", 409);
  }
  await tyre.deleteOne();
  res.status(200).json({ success: true, message: "Tyre deleted" });
}));

router.post("/fit-tyre", ...guard, handle(async (req, res) => {
  const tenantId = req.user.companyId;
  const tyre = mongoose.isValidObjectId(req.body.tyreId) ? await Tyre.findOne({ _id: req.body.tyreId, tenantId }) : null;
  if (!tyre) throw new ErrorHandler("Tyre not found", 404);
  if (tyre.status !== "in_stock") throw new ErrorHandler(`This tyre is ${tyre.status === "fitted" ? "already fitted" : "scrapped"}`, 409);
  await assertAsset(req.user, req.body.assetType, req.body.assetId);
  const position = text(req.body.position, 40);
  if (!position) throw new ErrorHandler("Say which wheel position it goes on", 400);
  const fittedAt = toDate(req.body.fittedAt) || new Date();
  if (await TyreFitment.exists({ tenantId, assetType: req.body.assetType, assetId: req.body.assetId, position, removedAt: { $exists: false } })) {
    throw new ErrorHandler(`There is already a tyre on ${position}. Remove it first.`, 409);
  }
  const fittedOdometer = optNum(req.body.fittedOdometer, "Odometer");
  if (fittedOdometer !== undefined && req.body.assetType === "trailer") throw new ErrorHandler("Trailers don't have an odometer", 400);
  const fitment = await TyreFitment.create({
    tenantId, tyreId: tyre._id, assetType: req.body.assetType, assetId: req.body.assetId, position, fittedAt,
    ...(fittedOdometer !== undefined ? { fittedOdometer } : {}),
  });
  tyre.status = "fitted";
  await tyre.save();
  res.status(201).json({ success: true, fitment });
}));

router.post("/remove-tyre/:id", ...guard, handle(async (req, res, next) => {
  const fit = await TyreFitment.findOne({ _id: idOf(req), tenantId: req.user.companyId });
  if (!fit) return next(new ErrorHandler("Fitment not found", 404));
  if (fit.removedAt) throw new ErrorHandler("That tyre was already removed", 409);
  const removedAt = toDate(req.body.removedAt) || new Date();
  if (removedAt < fit.fittedAt) throw new ErrorHandler("Removal can't be before it was fitted", 400);
  const removedOdometer = optNum(req.body.removedOdometer, "Odometer");
  if (removedOdometer !== undefined && Number.isFinite(fit.fittedOdometer) && removedOdometer < fit.fittedOdometer) {
    throw new ErrorHandler(`Odometer can't be lower than when it was fitted (${fit.fittedOdometer})`, 400);
  }
  fit.removedAt = removedAt;
  if (removedOdometer !== undefined) fit.removedOdometer = removedOdometer;
  fit.reason = text(req.body.reason, 100);
  await fit.save();
  await Tyre.updateOne({ _id: fit.tyreId, tenantId: req.user.companyId }, { $set: { status: req.body.scrap ? "scrapped" : "in_stock" } });
  res.status(200).json({ success: true, fitment: fit });
}));

/* ---------------- cost per km ---------------- */

// What a truck's upkeep costs per km over a period: workshop spend, plus its fitted
// tyres' cost per km so far applied to the distance driven. The tyre part is an
// estimate (tyre life isn't known until the tyres are removed), and it says so.
router.get("/truck-costs", ...guard, handle(async (req, res) => {
  const { vehicleId } = req.query;
  await assertAsset(req.user, "vehicle", vehicleId);
  const from = toDate(req.query.from) || new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const to = toDate(req.query.to) || new Date();
  const tenantId = req.user.companyId;

  const [records, jobKm, tripKm, openFits] = await Promise.all([
    MaintenanceRecord.find({ tenantId, assetType: "vehicle", assetId: vehicleId, date: { $gte: from, $lte: to } }).lean(),
    Job.aggregate([
      { $match: { vehicleId: new mongoose.Types.ObjectId(String(vehicleId)), orderDate: { $gte: from, $lte: to } } },
      { $group: { _id: null, km: { $sum: "$distance" } } },
    ]),
    Trip.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), horseId: new mongoose.Types.ObjectId(String(vehicleId)), status: { $ne: "cancelled" }, date: { $gte: from, $lte: to } } },
      { $group: { _id: null, km: { $sum: { $ifNull: ["$distanceKm", 0] } } } },
    ]),
    TyreFitment.find({ tenantId, assetType: "vehicle", assetId: vehicleId, removedAt: { $exists: false } }).lean(),
  ]);

  const km = Math.round((jobKm[0] ? jobKm[0].km : 0) + (tripKm[0] ? tripKm[0].km : 0));
  const maintenance = round2(records.reduce((s, r) => s + r.cost, 0));

  let tyreCostPerKm = 0;
  let tyresCounted = 0;
  for (const f of openFits) {
    const tyre = await Tyre.findOne({ _id: f.tyreId, tenantId }).lean();
    const run = await fitmentKm(tenantId, f);
    if (tyre && run > 0 && tyre.cost > 0) { tyreCostPerKm += tyre.cost / run; tyresCounted += 1; }
  }
  const tyreEstimate = round2(tyreCostPerKm * km);
  const perKm = (n) => (km > 0 ? Math.round((n / km) * 10000) / 10000 : null);

  res.status(200).json({
    success: true,
    from, to, km,
    maintenance, tyreEstimate, tyresCounted, tyresFitted: openFits.length,
    total: round2(maintenance + tyreEstimate),
    maintenancePerKm: perKm(maintenance),
    tyrePerKm: perKm(tyreEstimate),
    totalPerKm: perKm(maintenance + tyreEstimate),
    note: "Kilometres come from the jobs and trips recorded for this truck. The tyre figure is an estimate from each fitted tyre's cost per km so far.",
  });
}));

module.exports = router;
