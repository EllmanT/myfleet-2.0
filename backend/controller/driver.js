const express = require("express");
const path = require("path");
const Driver = require("../model/driver");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const fs = require("fs");
const Deliverer = require("../model/deliverer");
const { default: mongoose } = require("mongoose");

//create driver
router.post(
  "/create-driver",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "id", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { name, phoneNumber, address, city, idNumber, companyId } =
        req.body;

      const license = req.files.license[0];
      const licenseUrl = path.join(license.path);
      const id = req.files.id[0];
      const idUrl = path.join(id.path);

      let checkDriver = await Driver.findOne({ idNumber });
      const isCompanyDeliverer = await Deliverer.findById(companyId);

      if (checkDriver) {
        //checking the deliverer table
        if (isCompanyDeliverer) {
          //check if customer already exists as a client for deliverer
          const isDeliveryDriver = isCompanyDeliverer.driver_ids.find(
            (contractor) => (contractor = checkDriver._id)
          );
          if (isDeliveryDriver) {
            const license = req.files.license;
            const licensePath = `uploads/${license}`;
            fs.unlink(licensePath, (err) => {
              if (err) {
                console.log(err);
                res.status(500).json({ message: "Error deleting file" });
              }
            });
            const id = req.files.id;
            const idPath = `uploads/${id}`;
            fs.unlink(idPath, (err) => {
              if (err) {
                console.log(err);
                res.status(500).json({ message: "Error deleting file" });
              }
            });
            return next(
              new ErrorHandler(
                `  ${checkDriver.name} is already in the system`,
                500
              )
            );
          }

          isCompanyDeliverer.driver_ids.push(checkDriver._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,

            message: "Driver added successfully",
          });
        }
      } else {
        checkDriver = await Driver.create({
          name: name,
          phoneNumber: phoneNumber,
          address: address,
          city: city,
          idNumber: idNumber,
          companyId: companyId,
          license: licenseUrl,
          id: idUrl,
        });
        //pushing the data into deliverer
        if (isCompanyDeliverer) {
          isCompanyDeliverer.driver_ids.push(checkDriver._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,
            message: "Driver created successfully",
          });
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
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
        { name: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },

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

//update driver
router.put(
  "/update-driver",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "id", maxCount: 1 },
  ]),
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { driverId, name, phoneNumber, city, address, idNumber } = req.body;

      const driver = await Driver.findById(driverId);

      if (!driver) {
        return next(new ErrorHandler("Driver not found", 400));
      }
      //the issue is how we are sending the image from the frontend

      // this is bugging
      const existingId = `/uploads/${driver.id}`;
      const existingLicense = `/uploads/${driver.license}`;

      fs.unlinkSync(existingId);
      fs.unlinkSync(existingLicense);

      const license = req.files.license[0];
      const licenseUrl = path.join(license.path);
      const drId = req.files.id[0];
      const drIdUrl = path.join(drId.path);

      driver.name = name;
      driver.phoneNumber = phoneNumber;
      driver.city = city;
      driver.address = address;
      driver.idNumber = idNumber;
      driver.id = drIdUrl;
      driver.license = licenseUrl;

      await driver.save();

      res.status(201).json({
        success: true,
        driver,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//Delete driver
router.delete(
  "/delete-driver/:driverId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const driverId = req.params.driverId;

      const driver = await Driver.findByIdAndDelete(driverId);
      if (!driver) {
        return next(new ErrorHandler("There is no driver with this id", 500));
      }
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
