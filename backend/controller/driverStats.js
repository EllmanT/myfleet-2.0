const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const DriverStats = require("../model/driverStats");
const Contractor = require("../model/contractor");
const router = express.Router();

router.get(
  "/get-driverStats/:driverId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const currentYear = new Date().getFullYear();
      const driverStats = await DriverStats.findOne(
        { year: currentYear,
            driverId:req.params.driverId },
      );

      if (!driverStats) {
        return res.status(201).json({
          success: false,
        });
      } else {
        const driverStatsWithGetters = driverStats.toObject({getters:true});
        res.status(201).json({
          success: true,
          driverStats:driverStatsWithGetters,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);



router.get(
  "/get-total-jobs-driverStats-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const delivererWithDriverStatstj = await DriverStats.findOne(
        { companyId: req.user.companyId },
        { jobsByContractor: 1 } // Specify the fields to include in the resultc
      );

      if (!delivererWithDriverStatstj) {
        return next(new ErrorHandler("Can't find deliverer", 400));
      } else {

        res.status(201).json({
          success: true,
          jobsByContractor: delivererWithDriverStatstj.jobsByContractor, // Return the jobsByCategory array
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-total-rev-driverStats-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const delivererWithDriverStats = await DriverStats.findOne(
        { companyId: req.user.companyId },
        { revenueByContractor: 1 } // Specify the fields to include in the result
      );

      if (!delivererWithDriverStats) {
        return next(new ErrorHandler("Can't find deliverer", 400));
      } else {

        res.status(201).json({
          success: true,
          jobsByCategory: delivererWithDriverStats.jobsByCategory, // Return the jobsByCategory array
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
