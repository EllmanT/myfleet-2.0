const express = require("express");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { requireRole, GLOBAL_ROLES } = require("../middleware/tenantAccess");
const ErrorHandler = require("../utils/ErrorHandler");
const OverallStats = require("../model/overallStats");
const Contractor = require("../model/contractor");
const { rebuildStatsForCompany } = require("../scripts/seed/rebuildStatsFromJobs");
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

//getting all the overall stats info 
router.get(
  "/get-all-overallStats-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const requestedYear = parseYear(req.query.year);


    try {
      let effectiveYear = requestedYear;
      let delivererWithOverallStats = await OverallStats.findOne(
        { companyId: req.user.companyId, year: effectiveYear },
      );

      let yearsForCompany = [];
      if (req.user.companyId) {
        yearsForCompany = await OverallStats.distinct("year", {
          companyId: req.user.companyId,
        });
        if (!delivererWithOverallStats && yearsForCompany.length > 0) {
          effectiveYear = Math.max(...yearsForCompany);
          delivererWithOverallStats = await OverallStats.findOne({
            companyId: req.user.companyId,
            year: effectiveYear,
          });
        }
      }

      if (!delivererWithOverallStats) {
        return next(new ErrorHandler("Can't find deliverer", 400));
      } else {
        const statsWithGetters = delivererWithOverallStats.toObject({ getters: true, virtuals: true });

        // console.log('With getters:', statsWithGetters.jobsByContractor);
        // // console.log(delivererWithOverallStats)
        // console.log('jobsContractor:', JSON.stringify(statsWithGetters.jobsContractor, null, 2));

        res.status(201).json({
          success: true,
          delivererWithOverallStats: statsWithGetters,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-total-jobs-overallStats-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const delivererWithOverallStatstj = await OverallStats.findOne(
        { companyId: req.user.companyId, year: parseYear(req.query.year) },
        { jobsByContractor: 1 } // Specify the fields to include in the resultc
      );

      if (!delivererWithOverallStatstj) {
        return next(new ErrorHandler("Can't find deliverer", 400));
      } else {

        res.status(201).json({
          success: true,
          jobsByContractor: delivererWithOverallStatstj.jobsByContractor, // Return the jobsByCategory array
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-total-rev-overallStats-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const delivererWithOverallStats = await OverallStats.findOne(
        { companyId: req.user.companyId, year: parseYear(req.query.year) },
        { revenueByContractor: 1 } // Specify the fields to include in the result
      );

      if (!delivererWithOverallStats) {
        return next(new ErrorHandler("Can't find deliverer", 400));
      } else {

        res.status(201).json({
          success: true,
          jobsByCategory: delivererWithOverallStats.jobsByCategory, // Return the jobsByCategory array
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// Rebuilds ONE company's statistics from its jobs. Platform admins only, and the company must be
// named: there is no "rebuild everything" route any more.
router.post(
  "/rebuild-stats",
  isAuthenticated,
  requireRole(...GLOBAL_ROLES),
  catchAsyncErrors(async (req, res, next) => {
    const companyId = req.body && req.body.companyId;
    if (!mongoose.isValidObjectId(companyId)) {
      return next(new ErrorHandler("Say which company to rebuild (companyId)", 400));
    }
    try {
      const results = await rebuildStatsForCompany(
        mongoose.connection.db,
        new mongoose.Types.ObjectId(companyId)
      );
      res.status(200).json({ success: true, message: "Stats rebuilt successfully", results });
    } catch (error) {
      const notFound = /Company not found/.test(error.message);
      return next(new ErrorHandler(notFound ? "Company not found" : error.message, notFound ? 404 : 500));
    }
  })
);

module.exports = router;
