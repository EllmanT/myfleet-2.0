const express = require("express");
const Customer = require("../model/customer");
const ErrorHandler = require("../utils/ErrorHandler");
const { upload } = require("../multer");
const Deliverer = require("../model/deliverer");
const Contractor = require("../model/contractor");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const mongoose = require("mongoose");
//create customer
router.post(
  "/create-customer",

  upload.single("file"),
  async (req, res, next) => {
    try {
      const { name, phoneNumber, address, city, companyId } = req.body;
      let checkCustomer = await Customer.findOne({ name });

      const isCompanyDeliverer = await Deliverer.findById(companyId);

      const isCompanyContractor = await Contractor.findById(companyId);

      if (checkCustomer) {
        //checking to see if customer exists in the deliverers customers array list
        //we dont want to add duplicate customers into the deliverers array list

        //checking the deliverer table
        if (isCompanyDeliverer) {
          //check if customer already exists as a client for deliverer
          const isDeliveryCustomer = isCompanyDeliverer.customer_ids.find(
            (customer) => (customer = checkCustomer._id)
          );
          if (isDeliveryCustomer) {
            return next(
              new ErrorHandler(
                `  ${checkCustomer.name} is already your customer`,
                500
              )
            );
          }

          isCompanyDeliverer.customer_ids.push(checkCustomer._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,

            message: "Customer added successfully",
          });
        } else {
          //check if customer already exists as a client for contractor
          if (isCompanyContractor) {
            isContractorCustomer = isCompanyContractor.customer_ids.find(
              (customer) => customer === checkCustomer._id
            );
            if (isContractorCustomer) {
              return next(
                new ErrorHandler(
                  `${checkCustomer.name} is already your customer`,
                  500
                )
              );
            }
            isCompanyContractor.customer_ids.push(checkCustomer._id);
            await isCompanyContractor.save();
            res.status(201).json({
              success: true,
              message: "Customer added successfully",
            });
          }
        }

        //return next(new ErrorHandler("The customer already exists", 400));
      } else {
        checkCustomer = await Customer.create({
          name: name,
          phoneNumber: phoneNumber,
          city: city,
          address: address,
        });

        //pushing the data into deliverer
        if (isCompanyDeliverer) {
          isCompanyDeliverer.customer_ids.push(checkCustomer._id);
          await isCompanyDeliverer.save();
          res.status(201).json({
            success: true,
            message: "User created successfully",
          });
        } else {
          //pushing the data into the contractor
          if (isCompanyContractor) {
            isCompanyContractor.customer_ids.push(checkCustomer._id);
            await isCompanyContractor.save();
            res.status(201).json({
              success: true,
              message: "User created successfully",
            });
          }
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get all customers for deliverer
router.get(
  "/get-all-customers-company",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      //1. find out if the user is deliverer or supplier
      const deliverer = await Deliverer.findById(req.user.companyId);

      // check to see if deliverer
      if (!deliverer) {
        // const contractor = await Contractor.findById(req.user.id);
        return next(new ErrorHandler("Herer we are", 400));
      }

      //2.Getting the array of the customers for the deliverer

      const delivererWithCustomers = await Deliverer.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user.companyId) } },

        {
          $lookup: {
            from: "customers",
            let: { customerIds: "$customer_ids" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$customerIds"],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,

                  address: 1,
                },
              },
            ],
            as: "customers",
          },
        },

        {
          $project: {
            customers: 1,
          },
        },
      ]);
      if (delivererWithCustomers.length === 0) {
        res.status(201).json({
          success: true,
          message: "No customer in the system",
        });
      }

      res.status(201).json({
        success: true,
        delivererWithCustomers,
      });

      // Display the info about the particular customers for the deliverer
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get all the customers for the Customers Page
router.get(
  "/get-all-customers-page",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let {
        page = 0,
        pageSize = 25,
        sort = null,
        sortField = "_id",
        sortOrder = "desc",
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
      const customerIds = deliverer.customer_ids;

      // Create a search filter
      const searchFilter = {
        _id: { $in: customerIds },
        $or: [
          { name: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },

          // Add other fields to search on as needed
        ],
      };
      // Query for the customers using the search filter
      const pageCustomers = await Customer.find(searchFilter)
        .sort(sortOptions)
        .lean();

      if (pageCustomers.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No customers in the system",
        });
      }

      // Paginate the results manually based on the requested page and page size
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedCustomers = pageCustomers.slice(startIndex, endIndex);

      const totalCount = pageCustomers.length;

      res.status(200).json({
        success: true,
        pageCustomers: paginatedCustomers,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update customer info
router.put(
  "/update-customer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { id, name, phoneNumber, city, address } = req.body;

      const customer = await Customer.findById(id);

      if (!customer) {
        return next(new ErrorHandler("User not found", 400));
      }
      if (!id) {
        return next(new ErrorHandler("name required"));
      }

      customer.name = name;
      customer.city = city;
      customer.address = address;
      customer.phoneNumber = phoneNumber;

      await customer.save();

      res.status(201).json({
        success: true,
        customer,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//delete customer
router.delete(
  "/delete-customer/:customerId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const customerId = req.params.customerId;

      const customer = await Customer.findByIdAndDelete(customerId);
      if (!customer) {
        return next(new ErrorHandler("There is no customer with this id", 500));
      }
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }

      // Remove the customerId from the deliverer's array of customerIds
      const updatedCustomerIds = deliverer.customer_ids.filter(
        (id) => id.toString() !== customerId
      );

      // Update the deliverer's customerIds array with the updated array
      deliverer.customer_ids = updatedCustomerIds;
      await deliverer.save();

      res.status(201).json({
        success: true,
        message: "Customer Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;
