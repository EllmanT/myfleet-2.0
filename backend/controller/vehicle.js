const express = require("express");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const Vehicle = require("../model/vehicle");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Deliverer = require("../model/deliverer");
const { default: mongoose } = require("mongoose");
const router = express.Router();

router.post(
  "/create-vehicle",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const { make, regNumber, size, companyId } = req.body;

      let checkVehicle = await Vehicle.findOne({ regNumber });

      const isCompanyDeliverer = await Deliverer.findById(companyId);

      if (checkVehicle) {
        //checking to see if customer exists in the deliverers customers array list
        //we dont want to add duplicate customers into the deliverers array list

        //checking the deliverer table
        if (isCompanyDeliverer) {
          //check if customer already exists as a client for deliverer
          const isDeliveryVehicle = isCompanyDeliverer.vehicle_ids.find(
            (customer) => (customer = checkVehicle._id)
          );
          if (isDeliveryVehicle) {
            return next(
              new ErrorHandler(
                `${checkVehicle.make}   ${checkVehicle.regNumber} is already in the system`,
                500
              )
            );
          }

          isCompanyDeliverer.vehicle_ids.push(checkVehicle._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,

            message: "Vehicle added successfully",
          });
        }

        //return next(new ErrorHandler("The customer already exists", 400));
      } else {
        checkVehicle = await Vehicle.create({
          make: make,
          regNumber: regNumber,
          size: size,
          companyId: companyId,
        });
        //pushing the data into deliverer
        if (isCompanyDeliverer) {
          isCompanyDeliverer.vehicle_ids.push(checkVehicle._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,
            message: "Vehicle added successfully",
          });
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get the vehicles for the deliverer

router.get(
  "/get-all-vehicles-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const deliverer = await Deliverer.findById(req.user.companyId);

      if (!deliverer) {
        return next(new ErrorHandler("Login Please", 401));
      }

      const delivererWithVehicles = await Deliverer.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user.companyId) } },
        {
          $lookup: {
            from: "vehicles",
            let: { vehicleIds: "$vehicle_ids" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$vehicleIds"],
                  },
                },
              },
              {
                $project: {
                  companyId: 0,
                },
              },
            ],
            as: "vehicles",
          },
        },
        {
          $project: {
            vehicles: 1,
          },
        },
      ]);

      if (delivererWithVehicles.length === 0) {
        res.status(201).json({
          success: true,
          message: "No vehicles in the system",
        });
      }

      res.status(201).json({
        success: true,
        delivererWithVehicles,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-all-vehicles-page",
  isAuthenticated,
  async (req, res, next) => {
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
      const vehicleIds = deliverer.vehicle_ids;
      // Create a search filter
      const searchFilter = {
        _id: { $in: vehicleIds },
        $or: [
          { make: { $regex: search, $options: "i" } },
          { size: { $regex: search, $options: "i" } },
          { regNumber: { $regex: search, $options: "i" } },

          // Add other fields to search on as needed
        ],
      };
      // Query for the customers using the search filter
      const pageVehicles = await Vehicle.find(searchFilter)
        .sort(sortOptions)
        .lean();

      if (pageVehicles.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No vehicles in the system",
        });
      }

      // Paginate the results manually based on the requested page and page size
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedVehicles = pageVehicles.slice(startIndex, endIndex);

      const totalCount = pageVehicles.length;

      res.status(200).json({
        success: true,
        pageVehicles: paginatedVehicles,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

router.put(
  "/update-vehicle",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { id, make, size, regNumber } = req.body;

      const vehicle = await Vehicle.findById(id);

      if (!vehicle) {
        return next(new ErrorHandler("Vehicle not found", 400));
      }

      (vehicle.make = make),
        (vehicle.size = size),
        (vehicle.regNumber = regNumber);

      await vehicle.save();

      res.status(201).json({
        success: true,
        vehicle,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.delete(
  "/delete-vehicle/:vehicleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const vehicleId = req.params.vehicleId;

      const vehicle = await Vehicle.findByIdAndDelete(vehicleId);
      if (!vehicle) {
        return next(new ErrorHandler("There is no vehicle with this id", 500));
      }
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }

      // Remove the vehicleId from the deliverer's array of vehicleIds
      const updatedVehicleIds = deliverer.vehicle_ids.filter(
        (id) => id.toString() !== vehicleId
      );

      // Update the deliverer's vehicleIds array with the updated array
      deliverer.vehicle_ids = updatedVehicleIds;
      await deliverer.save();

      res.status(201).json({
        success: true,
        message: "Vehicle Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;
