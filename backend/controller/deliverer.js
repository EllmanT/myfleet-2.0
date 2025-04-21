const express = require("express");
const Path = require("path");
const Deliverer = require("../model/deliverer");
const router = express.Router();
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

router.post(
  "/create-deliverer",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const {
        companyName,
        address,
        city,
        prefix,
        goodsType,
        vehiclesType,
        deliveryType,
      } = req.body;
      const goodssType = goodsType.split(",");
      const vehiclessType = vehiclesType.split(",");
      const deliveryyType = deliveryType.split(",");

      let checkCompany = await Deliverer.findOne({ companyName });

      if (checkCompany) {
        return next(new ErrorHandler("Company Exists", 400));
      }

      checkCompany = await Deliverer.create({
        companyName: companyName,
        address: address,
        city: city,
        prefix: prefix,
        goodsType: goodssType,
        vehiclesType: vehiclessType,
        deliveryType: deliveryyType,
      });

      res.status(201).json({
        success: true,
        checkCompany,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get all contractors for deliverer
router.get(
  "/get-deliverer-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      //1. find out if the user is deliverer or supplier
      const delivererInfo = await Deliverer.findById(req.user.companyId, {
        customer_ids: 0,
        contractor_ids: 0,
      });
      // check to see if deliverer
      if (!delivererInfo) {
        return next(new ErrorHandler("Login Pleaseee", 401));
      }

      // Display the info about the particular contractors for the deliverer
      res.status(201).json({
        success: true,
        delivererInfo,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get-all-admins-page

router.get(
  "/get-all-deliverers-page",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let {
        page = 0,
        pageSize = 25,
        sort = null,

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

      // Create a search filter
      const searchFilter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },

          // Add other fields to search on as needed
        ],
      };
      // Query for the customers using the search filter
      const pageDeliverers = await Deliverer.find(searchFilter)
        .sort(sortOptions)
        .lean();

      if (pageDeliverers.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No deliverers in the system",
        });
      }

      // Paginate the results manually based on the requested page and page size
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedDeliverers = pageDeliverers.slice(startIndex, endIndex);

      const totalCount = pageDeliverers.length;

      res.status(200).json({
        success: true,
        pageDeliverers: paginatedDeliverers,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.put(
  "/update-deliverer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        id,
        companyName,
        address,
        city,
        contact,
        goodsType,
        deliveryType,
        vehiclesType,
      } = req.body;

      const deliverer = await Deliverer.findById(id);

      if (!deliverer) {
        return next(new ErrorHandler("Deliverer is not found", 400));
      }

      deliverer.companyName = companyName;
      deliverer.address = address;
      deliverer.city = city;
      deliverer.contact = contact;
      deliverer.goodsType = goodsType;
      deliverer.deliveryType = deliveryType;
      deliverer.vehiclesType = vehiclesType;

      await deliverer.save();

      res.status(201).json({
        success: true,
        deliverer,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
