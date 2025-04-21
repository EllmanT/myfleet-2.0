const express = require("express");
const Contractor = require("../model/contractor");
const { upload } = require("../multer");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Deliverer = require("../model/deliverer");
const { default: mongoose } = require("mongoose");
const Rate = require("../model/rate");

router.post("/create-contractor", upload.none(), async (req, res, next) => {
  try {
    const {
      companyName,
      address,
      city,
      contact,
      goodsTypes,
      vehiclesTypes,
      deliveryTypes,
      companyId,
      prefix,
      lastOrder,
      vrates,
    } = req.body;

    const goodssTypes = goodsTypes.split(",");
    const vehiclessTypes = vehiclesTypes.split(",");
    const deliveryyTypes = deliveryTypes.split(",");

    let formattedRates;
    try {
      formattedRates = JSON.parse(vrates);
    } catch (error) {
      return next(new ErrorHandler("Invalid JSON format for rates", 400));
    }

    let checkCompany = await Contractor.findOne({ companyName });
    const isCompanyDeliverer = await Deliverer.findById(companyId);

    if (checkCompany) {
      //checking the deliverer table
      if (isCompanyDeliverer) {
        //check if customer already exists as a client for deliverer
        const isDeliveryContractor = isCompanyDeliverer.contractor_ids.find(
          (contractor) => (contractor = checkCompany._id)
        );
        if (isDeliveryContractor) {
          return next(
            new ErrorHandler(
              `  ${checkCompany.name} is already your contractor`,
              500
            )
          );
        }

        isCompanyDeliverer.contractor_ids.push(checkCompany._id);
        await isCompanyDeliverer.save();

        let checkRate = await Rate.findOne({
          deliverer: companyId,
          contractor: checkCompany._id,
        });
        if (checkRate) {
          return next(
            new ErrorHandler(
              "You already have set rates with this contractor",
              400
            )
          );
        } else {
          try {
            checkRate = await Rate.create({
              deliverer: companyId,
              contractor: checkCompany._id,
              rateTypes: formattedRates,
            });

            if (!checkRate) {
              return next(
                new ErrorHandler("Error with the rate creation", 400)
              );
            } else {
              res.status(201).json({
                success: true,
                message: "Contractor added successfully",
              });
            }
          } catch (error) {
            return next(new ErrorHandler(error.message, 500));
          }
        }
      }
    } else {
      checkCompany = await Contractor.create({
        companyName: companyName,
        address: address,
        contact: contact,
        city: city,
        prefix: prefix,
        lastOrder: lastOrder,
        goodsTypes: goodssTypes,
        vehiclesTypes: vehiclessTypes,
        deliveryTypes: deliveryyTypes,
      });

      //pushing the data into deliverer
      if (isCompanyDeliverer) {
        isCompanyDeliverer.contractor_ids.push(checkCompany._id);
        await isCompanyDeliverer.save();

        let checkRate = await Rate.findOne({
          deliverer: companyId,
          contractor: checkCompany._id,
        });
        if (checkRate) {
          return next(
            new ErrorHandler(
              "You already have set rates with this contractor",
              400
            )
          );
        } else {
          try {
            checkRate = await Rate.create({
              deliverer: companyId,
              contractor: checkCompany._id,
              rateTypes: formattedRates,
            });

            if (!checkRate) {
              return next(
                new ErrorHandler("Error with the rate creation", 400)
              );
            } else {
              res.status(201).json({
                success: true,
                message: "Contractor added successfully",
              });
            }
          } catch (error) {
            return next(new ErrorHandler(error.message, 500));
          }
        }
      }

      // res.status(201).json({
      //   success: true,
      //    checkCompany,
      //  });
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

//get all contractors for deliverer
router.get(
  "/get-all-contractors-deliverer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      //1. find out if the user is deliverer or supplier
      const deliverer = await Deliverer.findById(req.user.companyId);
      // check to see if deliverer
      if (!deliverer) {
        return next(new ErrorHandler("Login Pleaseee", 401));
      }

      //2.Getting the array of the customers for the deliverer

      const delivererWithContractors = await Deliverer.aggregate([
        //get only information about the one deliverer
        {
          $match: { _id: new mongoose.Types.ObjectId(req.user.companyId) },
        },
        {
          $lookup: {
            from: "contractors",
            let: { contractorIds: "$contractor_ids" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$contractorIds"],
                  },
                },
              },
              {
                $project: {
                  rates: 0,
                  customers: 0,
                },
              },
            ],
            as: "contractors",
          },
        },
        {
          $project: {
            contractors: 1,
          },
        },
      ]);
      if (delivererWithContractors.length === 0) {
        res.status(201).json({
          success: false,
          message: "no results",
        });
      }
      // Display the info about the particular contractors for the deliverer
      res.status(201).json({
        success: true,
        delivererWithContractors,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/get-all-contractors-page",
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
      const contractorIds = deliverer.contractor_ids;

      // Create a search filter
      const searchFilter = {
        _id: { $in: contractorIds },
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { goodsTypes: { $regex: search, $options: "i" } },
          { vehiclesTypes: { $regex: search, $options: "i" } },
          { deliveryTypes: { $regex: search, $options: "i" } },

          // Add other fields to search on as needed
        ],
      };
      // Query for the customers using the search filter
      const pageContractors = await Contractor.find(searchFilter)
        .sort(sortOptions)
        .lean();

      if (pageContractors.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No customers in the system",
        });
      }

      // Paginate the results manually based on the requested page and page size
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedContractors = pageContractors.slice(startIndex, endIndex);

      const totalCount = pageContractors.length;

      res.status(200).json({
        success: true,
        pageContractors: paginatedContractors,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

router.put(
  "/update-contractor",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        compId,
        companyName,
        address,
        city,
        contact,
        goodsTypes,
        deliveryTypes,
        vehiclesTypes,
        rateId,
        stringRates,
      } = req.body;

      let formattedRates;
      try {
        formattedRates = JSON.parse(stringRates);
      } catch (error) {
        return next(new ErrorHandler("Invalid JSON format for rates", 400));
      }

      const contractor = await Contractor.findById(compId);

      if (!contractor) {
        return next(new ErrorHandler("Contractor is not found", 400));
      }

      contractor.companyName = companyName;
      contractor.address = address;
      contractor.city = city;
      contractor.contact = contact;
      contractor.goodsTypes = goodsTypes;
      contractor.deliveryTypes = deliveryTypes;
      contractor.vehiclesTypes = vehiclesTypes;

      //updating the rates
      let checkRate = await Rate.findById(rateId);
      if (!checkRate) {
        return next(new ErrorHandler("Error finding the rate", 400));
      } else {
        try {
          checkRate.rateTypes = formattedRates;

          await checkRate.save();

          if (!checkRate) {
            return next(new ErrorHandler("Error with updating the rate", 400));
          } else {
            await contractor.save();

            res.status(201).json({
              success: true,
              contractor,
              checkRate,
            });
          }
        } catch (error) {
          return next(new ErrorHandler(error.message, 500));
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.delete(
  "/delete-contractor/:contractorId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const contractorId = req.params.contractorId;

      const contractor = await Contractor.findByIdAndDelete(contractorId);
      if (!contractor) {
        return next(new ErrorHandler("There is no contractor with this id", 500));
      }
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }

      // Remove the contractorId from the deliverer's array of contractorIds
      const updatedContractorIds = deliverer.contractor_ids.filter(
        (id) => id.toString() !== contractorId
      );

      // Update the deliverer's contractorIds array with the updated array
      deliverer.contractor_ids = updatedContractorIds;
      await deliverer.save();

      res.status(201).json({
        success: true,
        message: "Contractor Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;
