const mongoose = require("mongoose");
const Job = require("../model/job");
const FuelFill = require("../model/fuelFill");
const Trip = require("../model/trip");
const MaintenanceRecord = require("../model/maintenanceRecord");
const TyreFitment = require("../model/tyreFitment");

const DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 14;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// The highest odometer reading we know for a truck, from every place one is
// recorded: job legs (stored as text), fuel fills, workshop records and tyre fits.
async function currentOdometer(tenantId, vehicleId) {
  const id = oid(vehicleId);
  const t = oid(tenantId);
  const [jobs, fuel, work, fits] = await Promise.all([
    Job.aggregate([
      { $match: { vehicleId: id } },
      { $group: { _id: null, max: { $max: { $convert: { input: "$mileageIn", to: "double", onError: null, onNull: null } } } } },
    ]),
    FuelFill.aggregate([{ $match: { vehicleId: id } }, { $group: { _id: null, max: { $max: "$odometer" } } }]),
    MaintenanceRecord.aggregate([{ $match: { tenantId: t, assetType: "vehicle", assetId: id } }, { $group: { _id: null, max: { $max: "$odometer" } } }]),
    TyreFitment.aggregate([
      { $match: { tenantId: t, assetType: "vehicle", assetId: id } },
      { $group: { _id: null, a: { $max: "$fittedOdometer" }, b: { $max: "$removedOdometer" } } },
    ]),
  ]);
  const values = [jobs[0] && jobs[0].max, fuel[0] && fuel[0].max, work[0] && work[0].max, fits[0] && fits[0].a, fits[0] && fits[0].b]
    .filter((v) => Number.isFinite(v));
  return values.length ? Math.max(...values) : null;
}

// Trailers have no odometer: their distance is the sum of the trips they were on.
async function trailerKm(tenantId, trailerId, from, to) {
  const q = { tenantId: oid(tenantId), trailerId: oid(trailerId), status: { $ne: "cancelled" } };
  if (from || to) q.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const r = await Trip.aggregate([{ $match: q }, { $group: { _id: null, km: { $sum: { $ifNull: ["$distanceKm", 0] } } } }]);
  return r[0] ? r[0].km : 0;
}

// Pure: is a service plan due? `kmSince` is the distance covered since it was
// last done (null if unknown). Overdue beats due soon beats ok.
function planStatus({ intervalKm, intervalDays, lastDate, kmSince, now = new Date() }) {
  const out = { kmLeft: null, daysLeft: null, status: "ok", reasons: [] };
  if (intervalKm && kmSince !== null && kmSince !== undefined) {
    out.kmLeft = Math.round(intervalKm - kmSince);
    const soonKm = Math.min(1000, Math.round(intervalKm * 0.1));
    if (out.kmLeft < 0) { out.status = "overdue"; out.reasons.push(`${Math.abs(out.kmLeft).toLocaleString()} km overdue`); }
    else if (out.kmLeft <= soonKm) { out.status = "due_soon"; out.reasons.push(`${out.kmLeft.toLocaleString()} km left`); }
  }
  if (intervalDays && lastDate) {
    const due = new Date(lastDate).getTime() + intervalDays * DAY;
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    out.daysLeft = Math.floor((due - today) / DAY);
    if (out.daysLeft < 0) { out.status = "overdue"; out.reasons.push(`${Math.abs(out.daysLeft)} day(s) overdue`); }
    else if (out.daysLeft <= DUE_SOON_DAYS && out.status !== "overdue") { out.status = "due_soon"; out.reasons.push(`${out.daysLeft} day(s) left`); }
  }
  return out;
}

// Distance a fitment has run: odometer difference for trucks (when both readings
// exist), trip distance over the period for trailers.
async function fitmentKm(tenantId, fit, now = new Date()) {
  if (fit.assetType === "vehicle") {
    const end = fit.removedAt ? fit.removedOdometer : await currentOdometer(tenantId, fit.assetId);
    if (!Number.isFinite(fit.fittedOdometer) || !Number.isFinite(end)) return null;
    return Math.max(0, end - fit.fittedOdometer);
  }
  return trailerKm(tenantId, fit.assetId, fit.fittedAt, fit.removedAt || now);
}

module.exports = { currentOdometer, trailerKm, planStatus, fitmentKm, round2, DAY };
