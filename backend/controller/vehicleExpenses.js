const express = require("express");
const Customer = require("../model/customer");
const ErrorHandler = require("../utils/ErrorHandler");
const { upload } = require("../multer");
const Deliverer = require("../model/deliverer");
const Contractor = require("../model/contractor");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { requireOwnership, companyOwns } = require("../middleware/tenantAccess");
const { asNumber, roundMoney } = require("./helpers/jobStatsSync");

// Stats money fields read back as text ("10.00"), so `+=` would join strings ("10.00" + 5 =
// "10.005"). Always add as numbers.
const addMoney = (current, delta) => roundMoney(asNumber(current) + asNumber(delta));
const mongoose = require("mongoose");
const router = express.Router();
const VehicleExpense = require("../model/vehicleExpense");
const OverallStats = require("../model/overallStats");
const VehicleStats = require("../model/vehicleStats");

//create vehicle expenses
router.post(
  "/create-vehicle-expense",
  isAuthenticated,
  upload.single("file"),
  requireOwnership("vehicle_ids", (req) => req.body.vehicleId),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { vehicleId, driverId, cost, description, date } = req.body;
      if (driverId && !(await companyOwns(req.user, "driver_ids", driverId))) {
        return next(new ErrorHandler("Not found", 404));
      }

      const dateExp = new Date(date);
      const month = dateExp.toLocaleString("en-US", { month: "long" });
      const year = dateExp.getFullYear();

      const overallStats = await OverallStats.findOne({
        companyId: req.user.companyId,
        year: year,
      });
      const vehicleStats = await VehicleStats.findOne({
        vehicleId: vehicleId,
        year: year,
      });

      if (!overallStats) {
        return next(
          new ErrorHandler("OverallStats not found for this vehicle", 404)
        );
      }
      if (!vehicleStats) {
        return next(
          new ErrorHandler("VehicleStats not found for this vehicle", 404)
        );
      }

      let vehicleExpenses = await VehicleExpense.findOne({
        vehicleId: vehicleId,
        companyId: String(req.user.companyId),
      });

      if (vehicleExpenses) {
        // If vehicle expenses exist, add a new expense to the existing expenseData array
        vehicleExpenses.expenseData.push({
          date: date,
          description: description,
          cost: cost,
          employeeId: driverId,
        });
      } else {
        // If vehicle expenses don't exist, create a new document with the expenseData array
        vehicleExpenses = await VehicleExpense.create({
          vehicleId: vehicleId,
          companyId: String(req.user.companyId),
          expenseData: [
            {
              date: date,
              description: description,
              cost: cost,
              employeeId: driverId,
            },
          ],
        });
      }

      await vehicleExpenses.save();
      // Sort monthlyData based on the date
      vehicleExpenses.expenseData.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );
      await vehicleExpenses.save();

      // Find the overallStats document for the given year

      // Find the monthlyData for the given month for overallstas
      let monthlyData = overallStats.monthlyData.find(
        (data) => data.month === month
      );

      if (!monthlyData) {
        // Create a new monthlyData object for the month if it doesn't exist
        monthlyData = {
          month: month,
          totalJobs: 0,
          totalRevenue: 0,
          totalMileage:0,
          totalProfit: 0 - cost,
          totalExpenses: cost,
        };
        // Update the vehicleStats fields
        overallStats.yearlyProfit = addMoney(overallStats.yearlyProfit, -asNumber(cost));
        overallStats.yearlyExpenses = addMoney(overallStats.yearlyExpenses, cost);
        overallStats.monthlyData.push(monthlyData);
      } else {
        // Update the totalexpenses and profit for the given month
        monthlyData.totalExpenses = addMoney(monthlyData.totalExpenses, cost);
        monthlyData.totalProfit = addMoney(monthlyData.totalProfit, -asNumber(cost));

        // Update the overallStats fields
        overallStats.yearlyProfit = addMoney(overallStats.yearlyProfit, -asNumber(cost));
        overallStats.yearlyExpenses = addMoney(overallStats.yearlyExpenses, cost);
      }

      // Find the monthlyData for the given month for vehiclestas
      let monthlyDataV = vehicleStats.monthlyData.find(
        (data) => data.month === month
      );
      // console.log(monthlyDataV)

      if (!monthlyDataV) {
        // Create a new monthlyData object for the month if it doesn't exist
        monthlyData = {
          month: month,
          totalJobs: 0,
          totalRevenue: 0,
          totalMileage:0,
          totalProfit: 0 - cost,
          totalExpenses: cost,
        };
        // Update the vehicleStats fields
        vehicleStats.yearlyProfit = addMoney(vehicleStats.yearlyProfit, -asNumber(cost));
        vehicleStats.yearlyExpenses = addMoney(vehicleStats.yearlyExpenses, cost);
        vehicleStats.monthlyData.push(monthlyData);
      } else {
        // Update the totalexpenses and profit for the given month
        monthlyDataV.totalExpenses = addMoney(monthlyDataV.totalExpenses, cost);
        monthlyDataV.totalProfit = addMoney(monthlyDataV.totalProfit, -asNumber(cost));

        // Update the vehicleStats fields
        vehicleStats.yearlyProfit = addMoney(vehicleStats.yearlyProfit, -asNumber(cost));
        vehicleStats.yearlyExpenses = addMoney(vehicleStats.yearlyExpenses, cost);
      }

      // Sort the monthlyData based on the month
      // Sort the monthlyData based on the month
      overallStats.monthlyData.sort((a, b) => {
        const monthA = new Date(Date.parse(`01 ${a.month} 2000`)).getMonth();
        const monthB = new Date(Date.parse(`01 ${b.month} 2000`)).getMonth();
        return monthA - monthB;
      });
      vehicleStats.monthlyData.sort((a, b) => {
        const monthA = new Date(Date.parse(`01 ${a.month} 2000`)).getMonth();
        const monthB = new Date(Date.parse(`01 ${b.month} 2000`)).getMonth();
        return monthA - monthB;
      });

      // Save the updated vehicleStats document

      await overallStats.save();
      await vehicleStats.save();

      // ...

      res.status(200).json({
        success: true,
        message: "Vehicle expense added successfully",
        vehicleExpenses: vehicleExpenses,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-vehicle-expenses/:vehicleId",
  isAuthenticated,
  requireOwnership("vehicle_ids", (req) => req.params.vehicleId),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const vehicleId = req.params.vehicleId;
      let {
        page = 1,
        pageSize = 20,
        sort = null,
        sortField = "_id",
        sortOrder = "desc",
        search = "",
      } = req.query;

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      const sortOptions = Boolean(sort) ? generateSort() : {};

      // Find the deliverer based on the company ID
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      // Get the expenses for the vehicle
      const expenses = await VehicleExpense.find({
        vehicleId: vehicleId,
        companyId: req.user.companyId,
      })
        .sort(sortOptions)
        .lean();

      if (expenses.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No expenses found",
        });
      }

      // Apply search filter
      const filteredExpenses = expenses.filter((expense) =>
        expenses.some((field) =>
          String(field).toLowerCase().includes(search.toLowerCase())
        )
      );

      // Paginate the filtered results manually based on the requested page and page size
      const totalCount = filteredExpenses.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + Number(pageSize);
      const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        expenses: paginatedExpenses,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update customer info
router.delete(
  "/delete-vehicle-expense/:expenseId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { expenseId } = req.params;
      if (!mongoose.isValidObjectId(expenseId)) return next(new ErrorHandler("Expense not found", 404));
      // Only this company's expense records can ever match.
      const owner = await VehicleExpense.findOne({
        companyId: String(req.user.companyId),
        "expenseData._id": expenseId,
      });
      const item = owner && owner.expenseData.id(expenseId);
      if (!item) return next(new ErrorHandler("Expense not found", 404));
      const cost = asNumber(item.cost);
      const when = new Date(item.date);

      const result = await VehicleExpense.updateOne(
        { _id: owner._id, companyId: String(req.user.companyId) },
        { $pull: { expenseData: { _id: expenseId } } }
      );
      if (!result.modifiedCount) {
        return next(new ErrorHandler("Expense not found", 404));
      }

      // Take the amount back out of the statistics it was added to when it was created.
      if (!Number.isNaN(when.getTime()) && cost) {
        const month = when.toLocaleString("en-US", { month: "long" });
        const year = when.getFullYear();
        const reverse = (stats) => {
          if (!stats) return;
          stats.yearlyExpenses = addMoney(stats.yearlyExpenses, -cost);
          stats.yearlyProfit = addMoney(stats.yearlyProfit, cost);
          const m = stats.monthlyData.find((data) => data.month === month);
          if (m) {
            m.totalExpenses = addMoney(m.totalExpenses, -cost);
            m.totalProfit = addMoney(m.totalProfit, cost);
          }
        };
        const [overallStats, vehicleStats] = await Promise.all([
          OverallStats.findOne({ companyId: req.user.companyId, year }),
          VehicleStats.findOne({ vehicleId: owner.vehicleId, year }),
        ]);
        reverse(overallStats);
        reverse(vehicleStats);
        if (overallStats) await overallStats.save();
        if (vehicleStats) await vehicleStats.save();
      }

      res.status(200).json({
        success: true,
        message: "Expense deleted successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
