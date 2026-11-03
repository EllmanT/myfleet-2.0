const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireFinance } = require("../middleware/financeAccess");
const { requireModule } = require("../middleware/moduleAccess");
const Expense = require("../model/expense");
const FuelFill = require("../model/fuelFill");
const Vehicle = require("../model/vehicle");
const Job = require("../model/job");
const router = express.Router();

const toDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Checks the body and returns a clean document, or throws ErrorHandler.
async function cleanBody(body, companyId) {
  const type = body.type === "income" ? "income" : "expense";
  const allowed = type === "income" ? Expense.INCOME_CATEGORIES : Expense.EXPENSE_CATEGORIES;
  if (!allowed.includes(body.category)) {
    throw new ErrorHandler(`Category must be one of: ${allowed.join(", ")}`, 400);
  }
  const date = toDate(body.date);
  if (!date) throw new ErrorHandler("A valid date is required", 400);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ErrorHandler("Amount must be a number of 0 or more", 400);
  }
  const doc = {
    type,
    date,
    category: body.category,
    description: String(body.description || "").trim(),
    amount: Math.round(amount * 100) / 100,
    payee: String(body.payee || "").trim(),
    notes: String(body.notes || "").trim(),
    isEstimate: !!body.isEstimate,
    retainedInBusiness: !!body.retainedInBusiness,
    // private fuel is tracked but never counted
    countsInProfit: body.category === "private_fuel" ? false : body.countsInProfit !== false,
  };
  for (const k of ["litres", "pricePerLitre"]) {
    if (body[k] !== undefined && body[k] !== "" && body[k] !== null) {
      const n = Number(body[k]);
      if (!Number.isFinite(n) || n < 0) throw new ErrorHandler(`${k} must be 0 or more`, 400);
      doc[k] = n;
    }
  }
  if (body.vehicleId) {
    if (!mongoose.isValidObjectId(body.vehicleId)) throw new ErrorHandler("Invalid vehicle", 400);
    const v = await Vehicle.findOne({ _id: body.vehicleId, companyId: String(companyId) });
    if (!v) throw new ErrorHandler("Vehicle not found for your company", 404);
    doc.vehicleId = v._id;
  }
  return doc;
}

router.post(
  "/create-expense",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const doc = await cleanBody(req.body, req.user.companyId);
      const expense = await Expense.create({
        ...doc,
        companyId: req.user.companyId,
        createdBy: req.user._id,
      });
      res.status(201).json({ success: true, expense });
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  })
);

router.get(
  "/get-expenses",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { from, to, category, vehicleId, type } = req.query;
      const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 500);
      const q = { companyId: req.user.companyId };
      if (from || to) {
        q.date = {};
        if (from && toDate(from)) q.date.$gte = toDate(from);
        if (to && toDate(to)) q.date.$lte = toDate(to);
      }
      if (category) q.category = category;
      if (type === "income" || type === "expense") q.type = type;
      if (vehicleId && mongoose.isValidObjectId(vehicleId)) q.vehicleId = vehicleId;
      const [expenses, total] = await Promise.all([
        Expense.find(q).sort({ date: -1, _id: -1 }).skip(page * pageSize).limit(pageSize).lean(),
        Expense.countDocuments(q),
      ]);
      res.status(200).json({ success: true, expenses, total, page, pageSize });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

router.put(
  "/update-expense/:id",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
      const existing = await Expense.findOne({ _id: req.params.id, companyId: req.user.companyId });
      if (!existing) return next(new ErrorHandler("Entry not found", 404));
      const doc = await cleanBody({ ...existing.toObject(), ...req.body }, req.user.companyId);
      existing.set(doc);
      if (!req.body.vehicleId && "vehicleId" in req.body) existing.vehicleId = undefined;
      await existing.save();
      res.status(200).json({ success: true, expense: existing });
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  })
);

router.delete(
  "/delete-expense/:id",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return next(new ErrorHandler("Invalid id", 400));
      const r = await Expense.deleteOne({ _id: req.params.id, companyId: req.user.companyId });
      if (!r.deletedCount) return next(new ErrorHandler("Entry not found", 404));
      res.status(200).json({ success: true });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// Read-only: revenue (jobs + extra income) minus expenses, by month and by vehicle.
router.get(
  "/profitability",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      const vehicles = await Vehicle.find({ companyId: String(req.user.companyId) }).lean();
      const vIds = vehicles.map((v) => v._id);
      const vName = {};
      vehicles.forEach((v) => (vName[String(v._id)] = `${v.make || ""} ${v.regNumber || ""}`.trim()));

      const [jobsByMV, entries, fills] = await Promise.all([
        Job.aggregate([
          { $match: { vehicleId: { $in: vIds }, orderDate: { $gte: start, $lt: end } } },
          {
            $group: {
              _id: { m: { $month: "$orderDate" }, v: "$vehicleId" },
              revenue: { $sum: { $toDouble: "$cost" } },
              km: { $sum: "$distance" },
              jobs: { $sum: 1 },
            },
          },
        ]),
        Expense.find({ companyId: req.user.companyId, date: { $gte: start, $lt: end } }).lean(),
        FuelFill.find({ companyId: req.user.companyId, filledAt: { $gte: start, $lt: end } }).lean(),
      ]);
      // Real fill-ups replace the monthly fuel ESTIMATES for the same truck and month.
      const hasFills = new Set(fills.map((f) => `${new Date(f.filledAt).getUTCMonth()}-${f.vehicleId}`));
      const replaced = (e) =>
        e.isEstimate && ["fuel", "private_fuel"].includes(e.category) && e.vehicleId &&
        hasFills.has(`${new Date(e.date).getUTCMonth()}-${e.vehicleId}`);

      const blank = () => ({
        jobRevenue: 0, otherIncome: 0, km: 0, jobs: 0,
        expenses: {}, totalExpenses: 0, retained: 0, privateFuel: 0, privateFuelLitres: 0,
      });
      const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...blank() }));
      const perVehicle = {};
      const veh = (id) => (perVehicle[id] = perVehicle[id] || { vehicle: vName[id] || "Unassigned", ...blank() });
      const overhead = blank();

      jobsByMV.forEach((g) => {
        const m = months[g._id.m - 1];
        m.jobRevenue += g.revenue; m.km += g.km; m.jobs += g.jobs;
        const v = veh(String(g._id.v));
        v.jobRevenue += g.revenue; v.km += g.km; v.jobs += g.jobs;
      });
      fills.forEach((f) => {
        entries.push({
          type: "expense",
          date: f.filledAt,
          category: f.purpose === "private" ? "private_fuel" : "fuel",
          amount: f.amount,
          litres: f.litres,
          vehicleId: f.vehicleId,
          countsInProfit: f.purpose !== "private",
          retainedInBusiness: false,
          isEstimate: false,
          fromFill: true,
        });
      });
      entries.forEach((e) => {
        if (!e.fromFill && replaced(e)) return;
        const m = months[new Date(e.date).getUTCMonth()];
        const v = e.vehicleId ? veh(String(e.vehicleId)) : overhead;
        if (e.type === "income") {
          m.otherIncome += e.amount; v.otherIncome += e.amount;
        } else if (!e.countsInProfit) {
          // private fuel: recorded, never in profit
          m.privateFuel += e.amount; m.privateFuelLitres += e.litres || 0;
          v.privateFuel += e.amount; v.privateFuelLitres += e.litres || 0;
        } else {
          [m, v].forEach((t) => {
            t.expenses[e.category] = (t.expenses[e.category] || 0) + e.amount;
            t.totalExpenses += e.amount;
            if (e.retainedInBusiness) t.retained += e.amount;
          });
        }
      });
      const finish = (o) => {
        const revenue = o.jobRevenue + o.otherIncome;
        const profit = revenue - o.totalExpenses;
        return { ...o, revenue, profit, cashProfit: profit + o.retained };
      };
      const monthsOut = months.map(finish);
      const totals = finish(
        months.reduce((t, m) => {
          t.jobRevenue += m.jobRevenue; t.otherIncome += m.otherIncome; t.km += m.km; t.jobs += m.jobs;
          t.totalExpenses += m.totalExpenses; t.retained += m.retained;
          t.privateFuel += m.privateFuel; t.privateFuelLitres += m.privateFuelLitres;
          Object.entries(m.expenses).forEach(([k, a]) => (t.expenses[k] = (t.expenses[k] || 0) + a));
          return t;
        }, blank())
      );
      res.status(200).json({
        success: true,
        year,
        months: monthsOut,
        vehicles: Object.values(perVehicle).map(finish),
        overhead: finish(overhead),
        totals,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

router.get(
  "/meta",
  isAuthenticated,
  requireFinance,

  requireModule("expenses"),
  catchAsyncErrors(async (req, res, next) => {
    const vehicles = await Vehicle.find({ companyId: String(req.user.companyId) }).select("make regNumber").lean();
    res.status(200).json({
      success: true,
      expenseCategories: Expense.EXPENSE_CATEGORIES,
      incomeCategories: Expense.INCOME_CATEGORIES,
      vehicles,
    });
  })
);

module.exports = router;
