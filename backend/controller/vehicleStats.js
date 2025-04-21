const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const VehicleStats = require("../model/vehicleStats");
const Contractor = require("../model/contractor");
const router = express.Router();

//getting the vehicleStats for the specific vehicle
router.get(
  "/get-vehicleStats/:vehicleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const vehicleStats = await VehicleStats.findOne(
        { vehicleId: req.params.vehicleId },
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
