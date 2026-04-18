const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const VehicleStats = require("../model/vehicleStats");
const Contractor = require("../model/contractor");
const router = express.Router();

const parseYear = (rawYear) => {
  const fallbackYear = new Date().getFullYear();
  if (rawYear === undefined || rawYear === null || rawYear === "") {
    return fallbackYear;
  }

  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ErrorHandler("Invalid year query parameter", 400);
  }
  return year;
};

//getting the vehicleStats for the specific vehicle
router.get(
  "/get-vehicleStats/:vehicleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const currentYear = parseYear(req.query.year);
      const vehicleStats = await VehicleStats.findOne(
      
        {year:currentYear,
           vehicleId: req.params.vehicleId },
      );

      if (!vehicleStats) {
        return res.status(201).json({
          success: false,
        });
      } else {
        const statsWithGetters = vehicleStats.toObject({ getters: true });

        res.status(201).json({
          success: true,
          vehicleStats:statsWithGetters,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);
module.exports = router;
