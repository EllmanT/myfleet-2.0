const express = require("express");
const ErrorHandler = require("../utils/ErrorHandler");
const { upload } = require("../multer");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const EmployeeExpense = require("../model/employeeExpenses");
const OverallStats = require("../model/overallStats");
const DriverStats = require("../model/driverStats");
const Deliverer = require("../model/deliverer");

//create employee expenses
router.post(
  "/create-employee-expense",
  upload.single("file"),
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { employeeId, cost, description, date } = req.body;

      const dateExp = new Date(date);
      const month = dateExp.toLocaleString("en-US", { month: "long" });
      year = dateExp.getFullYear();

      const overallStats = await OverallStats.findOne({
        companyId: req.user.companyId,
        year: year,
      });
      const driverStats = await DriverStats.findOne({
        driverId: employeeId,
        year: year,
      });

      if (!overallStats) {
        return next(
          new ErrorHandler("OverallStats not found for this vehicle", 404)
        );
      }
      if (!driverStats) {
        return next(
          new ErrorHandler("DriverDtats not found for this vehicle", 404)
        );
      }

      let employeeExpenses = await EmployeeExpense.findOne({
        employeeId: employeeId,
      });

      if (employeeExpenses) {
        // If employee expenses exist, add a new expense to the existing expenseData array
        employeeExpenses.expenseData.push({
          date: date,
          description: description,
          cost: cost,
          employeeId: employeeId,
        });
      } else {
        // If employee expenses don't exist, create a new document with the expenseData array
        employeeExpenses = await EmployeeExpense.create({
          employeeId: employeeId,
          companyId: req.user.companyId,
          expenseData: [
            {
              date: date,
              description: description,
              cost: cost,
              employeeId: employeeId,
            },
          ],
        });
      }

      await employeeExpenses.save();
      // Sort monthlyData based on the date
      employeeExpenses.expenseData.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );
      await employeeExpenses.save();

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
          totalProfit: 0 - cost,
          totalExpenses: cost,
        };
        // Update the employeeStats fields
        overallStats.yearlyProfit -= parseFloat(cost);
        overallStats.yearlyExpenses += parseFloat(cost);
        overallStats.monthlyData.push(monthlyData);
      } else {
        // Update the totalexpenses and profit for the given month
        monthlyData.totalExpenses += parseFloat(cost);
        monthlyData.totalProfit -= parseFloat(cost);

        // Update the overallStats fields
        overallStats.yearlyProfit -= parseFloat(cost);
        overallStats.yearlyExpenses += parseFloat(cost);
      }

      // Find the monthlyData for the given month for employeestas
      let monthlyDataD = driverStats.monthlyData.find(
        (data) => data.month === month
      );

      if (!monthlyDataD) {
        // Create a new monthlyData object for the month if it doesn't exist
        monthlyData = {
          month: month,
          totalJobs: 0,
          totalRevenue: 0,
          totalProfit: 0 - cost,
          totalExpenses: cost,
        };
        // Update the driverStats fields
        driverStats.yearlyProfit -= parseFloat(cost);
        driverStats.yearlyExpenses += parseFloat(cost);
        driverStats.monthlyData.push(monthlyData);
      } else {
        // Update the totalexpenses and profit for the given month
        monthlyDataD.totalExpenses += parseFloat(cost);
        monthlyDataD.totalProfit -= parseFloat(cost);

        // Update the driverStats fields
        driverStats.yearlyProfit -= parseFloat(cost);
        driverStats.yearlyExpenses += parseFloat(cost);
      }
      // Sort the monthlyData based on the month
      driverStats.monthlyData.sort((a, b) => {
        const monthA = new Date(Date.parse(`01 ${a.month} 2000`)).getMonth();
        const monthB = new Date(Date.parse(`01 ${b.month} 2000`)).getMonth();
        return monthA - monthB;
      });

      // Sort the monthlyData based on the month
      overallStats.monthlyData.sort((a, b) => {
        const monthA = new Date(Date.parse(`01 ${a.month} 2000`)).getMonth();
        const monthB = new Date(Date.parse(`01 ${b.month} 2000`)).getMonth();
        return monthA - monthB;
      });
      // Save the updated driverStats document

      await overallStats.save();
      await driverStats.save();

      // ...

      res.status(200).json({
        success: true,
        message: "Employee expense added successfully",
        employeeExpenses: employeeExpenses,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-employee-expenses/:employeeId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const employeeId = req.params.employeeId;
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

      // Get the expenses for the employee
      const expenses = await EmployeeExpense.find({
        employeeId: employeeId,
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
      const endIndex = startIndex + pageSize;
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
module.exports = router;
