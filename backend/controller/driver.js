const express = require("express");
const { escapeRegex } = require("../utils/escapeRegex");
const path = require("path");
const Driver = require("../model/driver");
const { upload } = require("../multer");
const { saveFile, deleteFile } = require("../services/fileStorage");
const { ownRecordFilter } = require("../services/customerScope");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const fs = require("fs");
const Deliverer = require("../model/deliverer");
const {
  forceOwnCompany,
  requireOwnership,
} = require("../middleware/tenantAccess");
const { default: mongoose } = require("mongoose");

//create driver
router.post(
  "/create-driver",
  isAuthenticated,
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "id", maxCount: 1 },
  ]),
  forceOwnCompany,
  async (req, res, next) => {
    const saved = [];
    try {
      const { name, phoneNumber, address, city, idNumber, companyId } = req.body;

      const licenseFile = req.files && req.files.license && req.files.license[0];
      const idFile = req.files && req.files.id && req.files.id[0];
      if (!licenseFile || !idFile) {
        return next(new ErrorHandler("Upload both the driver's licence and ID", 400));
      }

      const company = await Deliverer.findById(companyId);
      if (!company) return next(new ErrorHandler("Company not found", 404));

      // Only this company's own drivers count as duplicates. Matching by ID number across
      // every company would link one company to another company's driver record.
      const existing = await Driver.findOne({
        idNumber,
        ...ownRecordFilter(company._id, company.driver_ids),
      });
      if (existing) {
        return next(new ErrorHandler(`${existing.name} is already in the system`, 409));
      }

      // Files are checked (type by content, size) and stored privately before the record exists.
      const license = await saveFile({ tenantId: String(company._id), kind: "driver-licence", buffer: licenseFile.buffer });
      saved.push(license.key);
      const idDoc = await saveFile({ tenantId: String(company._id), kind: "driver-id", buffer: idFile.buffer });
      saved.push(idDoc.key);

      const driver = await Driver.create({
        tenantId: company._id,
        name,
        phoneNumber,
        address,
        city,
        idNumber,
        companyId,
        license: license.key,
        id: idDoc.key,
      });
      company.driver_ids.push(driver._id);
      await company.save();

      res.status(201).json({ success: true, message: "Driver created successfully" });
    } catch (error) {
      // do not leave files behind for a driver that was never saved
      await Promise.all(saved.map((key) => deleteFile(key)));
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  }
);

//get all drivers for the job creation login 
router.get(
  "/get-all-drivers-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const deliverer = await Deliverer.findById(req.user.companyId);

      if (!deliverer) {
        return next(new ErrorHandler("Please login to continue", 401));
      }

      const delivererWithDrivers = await Deliverer.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user.companyId) } },
        {
          $lookup: {
            from: "drivers",
            let: { driverIds: "$driver_ids" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$driverIds"],
                  },
                },
              },
              {
                $project: {
                  companyId: 0,
                },
              },
            ],
            as: "drivers",
          },
        },
        {
          $project: {
            drivers: 1,
          },
        },
      ]);

      if (delivererWithDrivers.length === 0) {
        res.status(201).json({
          success: true,
          message: "No drivers in the system",
        });
      }
      // Display the info about the particular drivers for the deliverer

      res.status(201).json({
        success: true,
        delivererWithDrivers,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get all drivers of the DriversPage
router.get("/get-all-drivers-page", isAuthenticated, async (req, res, next) => {
  try {
    let {
      page = 1,
      pageSize = 20,
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

    // Find the deliverer based on the company ID
    const deliverer = await Deliverer.findById(req.user.companyId);
    if (!deliverer) {
      return res.status(404).json({
        success: false,
        message: "Deliverer not found",
      });
    }

    // Get the customer IDs associated with the deliverer
    const driverIds = deliverer.driver_ids;

    // Create a search filter
    const searchFilter = {
      _id: { $in: driverIds },
      $or: [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { city: { $regex: escapeRegex(search), $options: "i" } },
        { address: { $regex: escapeRegex(search), $options: "i" } },
        { phoneNumber: { $regex: escapeRegex(search), $options: "i" } },

        // Add other fields to search on as needed
      ],
    };
    // Query for the customers using the search filter
    const pageDrivers = await Driver.find(searchFilter)
      .sort(sortOptions)
      .lean();

    if (pageDrivers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No Drivers in the system",
      });
    }

    // Paginate the results manually based on the requested page and page size
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedDrivers = pageDrivers.slice(startIndex, endIndex);

    const totalCount = pageDrivers.length;

    res.status(200).json({
      success: true,
      pageDrivers: paginatedDrivers,
      totalCount,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

//update driver. The licence and ID files are optional here: send a new one to replace it.
router.put(
  "/update-driver",
  isAuthenticated,
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "id", maxCount: 1 },
  ]),
  requireOwnership("driver_ids", (req) => req.body.driverId),
  catchAsyncErrors(async (req, res, next) => {
    const saved = [];
    try {
      const { driverId, name, phoneNumber, city, address, idNumber } = req.body;

      const driver = await Driver.findById(driverId);
      if (!driver) {
        return next(new ErrorHandler("Driver not found", 404));
      }

      const replaced = [];
      for (const [field, kind] of [
        ["license", "driver-licence"],
        ["id", "driver-id"],
      ]) {
        const file = req.files && req.files[field] && req.files[field][0];
        if (!file) continue;
        const stored = await saveFile({
          tenantId: String(driver.tenantId || req.user.companyId),
          kind,
          buffer: file.buffer,
        });
        saved.push(stored.key);
        replaced.push(driver[field]); // the old file, removed once the record is saved
        driver[field] = stored.key;
      }

      if (name !== undefined) driver.name = name;
      if (phoneNumber !== undefined) driver.phoneNumber = phoneNumber;
      if (city !== undefined) driver.city = city;
      if (address !== undefined) driver.address = address;
      if (idNumber !== undefined) driver.idNumber = idNumber;

      await driver.save();
      await Promise.all(replaced.map((key) => deleteFile(key)));

      res.status(201).json({ success: true, driver });
    } catch (error) {
      await Promise.all(saved.map((key) => deleteFile(key)));
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 500));
    }
  })
);

//Delete driver
router.delete(
  "/delete-driver/:driverId",
  isAuthenticated,
  requireOwnership("driver_ids", (req) => req.params.driverId),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const driverId = req.params.driverId;

      const driver = await Driver.findByIdAndDelete(driverId);
      if (!driver) {
        return next(new ErrorHandler("There is no driver with this id", 500));
      }
      // the driver's ID and licence documents go with the record
      await Promise.all([deleteFile(driver.id), deleteFile(driver.license)]);
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }

      // Remove the driverId from the deliverer's array of driverIds
      const updatedDriverIds = deliverer.driver_ids.filter(
        (id) => id.toString() !== driverId
      );

      // Update the deliverer's driverIds array with the updated array
      deliverer.driver_ids = updatedDriverIds;
      await deliverer.save();

      res.status(201).json({
        success: true,
        message: "Driver Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);



module.exports = router;
