const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const ContractorStats = require("../model/contractorStats");
const Contractor = require("../model/contractor");
const router = express.Router();

//getting the contractorStats for the specific contractor

router.get(
  "/get-contractorStats/:contractorId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const contractorStats = await ContractorStats.findOne(
        {
          contractorId: req.params.contractorId,
          delivererId: req.user.companyId,
        },
      );
      if (!contractorStats) {
        return res.status(201).json({
          success: false,
          contractorStats,
        });
      } else {
        const statsWithGetters = contractorStats.toObject({ getters: true });

        res.status(201).json({
          success: true,
          contractorStats:statsWithGetters,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
