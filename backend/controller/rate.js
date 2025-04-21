const express = require("express");
const path = require("path");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const Deliverer = require("../model/deliverer");
const Rate = require("../model/rate");
const Contractor = require("../model/contractor");

//get all contractors for deliverer
router.get(
  "/get-rates",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const isCompanyDeliverer = await Deliverer.findById(req.user.companyId);

      const isCompanyContractor = await Contractor.findById(req.user.companyId);

      if (isCompanyDeliverer) {
        const delivererRates = await Rate.find({
          deliverer: req.user.companyId,
        });
        if (!delivererRates) {
          return next(new ErrorHandler("The deliverer has no rates", 400));
        }
        res.status(201).json({
          success: true,
          delivererRates,
        });
      } else {
        if (isCompanyContractor) {
          const contractorRates = await Rate.find({
            contractor: companyId,
          });
          if (!delivererRates) {
            return next(new ErrorHandler("The deliverer has no rates", 400));
          }
          res.status(201).json({
            success: true,
            contractorRates,
          });
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

module.exports = router;
