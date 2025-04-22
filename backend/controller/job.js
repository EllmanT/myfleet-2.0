const express = require("express");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const Job = require("../model/job");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Deliverer = require("../model/deliverer");
const Contractor = require("../model/contractor");
const DriverStats = require("../model/driverStats");
const VehicleStats = require("../model/vehicleStats");
const OverallStats = require("../model/overallStats");
const ContractorStats = require("../model/contractorStats");
const Driver = require("../model/driver");
const Vehicle = require("../model/vehicle");
const router = express.Router();

const { Decimal128 } = require("mongodb");

// ...
//creating the job
router.post(
  "/create-job",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const jobs = req.body;

      const driverIds = new Set();
      const vehicleIds = new Set();
      const bulkDriverStats = [];
      const bulkVehicleStats = [];
      const bulkOverallStats = [];
      const bulkContractorStats = [];
      const jobIds = [];

      const deliverer = await Deliverer.findById(req.user.companyId);

      if (!deliverer) {
        return next(new ErrorHandler("Deliverer not found", 500));
      }
      const delivererId = req.user.companyId;
      const totalCustomers = deliverer.customer_ids.length;
      const totalContractors = deliverer.contractor_ids.length;
      const companyId = req.user.companyId;
      let year;
      let contractorId;
      contractorId = jobs[0].contractorId;
      const vehicleId = jobs[0].vehicleId;
      const driverId = jobs[0].driverId;

      const contractor = await Contractor.findById(contractorId);
      const vehicle = await Vehicle.findById(vehicleId);
      const driver = await Driver.findById(driverId);
      const contractorName = contractor.companyName;

      for (const job of jobs) {
        const newJob = new Job(job);
        const date = new Date(job.orderDate);
        year = date.getFullYear();
        const month = date.toLocaleString("default", { month: "long" }); // Get month name
        //const currentDate = date.getDate();

        const day = String(date.getDate()).padStart(2, "0"); // Get the day component and pad with leading zero if necessary
        const monthNumber = String(date.getMonth() + 1).padStart(2, "0"); // Get the month component and pad with leading zero if necessary

        const formattedDate = `${year}-${monthNumber}-${day}`;
        const distance = parseFloat(job.distance).toFixed(2);
        const cost = parseFloat(job.cost).toFixed(2);

        if (!driverId || !vehicleId || !companyId || !year || !distance) {
          continue; // Skip this job and proceed to the next iteration
        }

        driverIds.add(driverId);
        vehicleIds.add(vehicleId);
        //START OF THE DRIVERSTATS UPDATING
        bulkDriverStats.push({
          updateOne: {
            filter: { driverId, year },
            update: {
              $inc: {
                yearlyMileage: distance,
                yearlyRevenue: cost,
                yearlyProfit: cost,
                yearlyExpenses: 0,
                [`revenueByContractor.${contractorName}`]: cost,
                [`jobsByContractor.${contractorName}`]: 1,
                yearlyJobs: 1, // Increment yearlyJobs by 1
              },
              $setOnInsert: {
                monthlyData: [],
                dailyData: [],
                // yearlyJobs: 1,
                totalCustomers: totalCustomers,
              },
            },
            upsert: true,
          },
        });

        bulkDriverStats.push({
          updateOne: {
            filter: { driverId, year, "monthlyData.month": month },
            update: {
              $inc: {
                // yearlyJobs: 1,

                "monthlyData.$.totalMileage": distance,
                "monthlyData.$.totalRevenue": cost,
                "monthlyData.$.totalProfit": cost,
                "monthlyData.$.totalExpenses": 0,
                "monthlyData.$.totalJobs": 1,
              },

              arrayFilters: [{ "elem.month": month }],
            },
          },
        });

        bulkDriverStats.push({
          updateOne: {
            filter: { driverId, year, "monthlyData.month": { $ne: month } },
            update: {
              $push: {
                monthlyData: {
                  $each: [
                    {
                      month,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalProfit: cost,
                      totalExpenses: 0,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { month: -1 },
                },
              },
            },
          },
        });
        //Updating the daily data and soring
        bulkDriverStats.push({
          updateOne: {
            filter: { driverId, year, "dailyData.date": formattedDate },
            update: {
              $inc: {
                "dailyData.$.totalMileage": distance,
                "dailyData.$.totalRevenue": cost,
                "dailyData.$.totalJobs": 1,
              },
            },
          },
        });

        bulkDriverStats.push({
          updateOne: {
            filter: {
              driverId,
              year,
              "dailyData.date": { $ne: formattedDate },
            },
            update: {
              $push: {
                dailyData: {
                  $each: [
                    {
                      date: formattedDate,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { date: -1 },
                },
              },
            },
          },
        });

        //END OF THE DRIVERSTATS UPDATING

        //START OF THE VEHICLESTATS UPDATING

        bulkVehicleStats.push({
          updateOne: {
            filter: { vehicleId, year },
            update: {
              $inc: {
                yearlyMileage: distance,
                yearlyRevenue: cost,
                yearlyProfit: cost,
                yearlyExpenses: 0,
                [`revenueByContractor.${contractorName}`]: cost,
                [`jobsByContractor.${contractorName}`]: 1,
                yearlyJobs: 1, // Increment yearlyJobs by 1
              },
              $setOnInsert: {
                monthlyData: [],
                dailyData: [],
                // yearlyJobs: 1,
                totalCustomers: totalCustomers,
              },
            },
            upsert: true,
          },
        });

        bulkVehicleStats.push({
          updateOne: {
            filter: { vehicleId, year, "monthlyData.month": month },
            update: {
              $inc: {
                // yearlyJobs: 1,

                "monthlyData.$.totalMileage": distance,
                "monthlyData.$.totalRevenue": cost,
                "monthlyData.$.totalProfit": cost,
                "monthlyData.$.totalExpenses": 0,
                "monthlyData.$.totalJobs": 1,
              },

              arrayFilters: [{ "elem.month": month }],
            },
          },
        });

        bulkVehicleStats.push({
          updateOne: {
            filter: { vehicleId, year, "monthlyData.month": { $ne: month } },
            update: {
              $push: {
                monthlyData: {
                  $each: [
                    {
                      month,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalProfit: cost,
                      totalExpenses: 0,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { month: -1 },
                },
              },
            },
          },
        });
        //Updating the daily data and soring
        bulkVehicleStats.push({
          updateOne: {
            filter: { vehicleId, year, "dailyData.date": formattedDate },
            update: {
              $inc: {
                "dailyData.$.totalMileage": distance,
                "dailyData.$.totalRevenue": cost,
                "dailyData.$.totalJobs": 1,
              },
            },
          },
        });

        bulkVehicleStats.push({
          updateOne: {
            filter: {
              vehicleId,
              year,
              "dailyData.date": { $ne: formattedDate },
            },
            update: {
              $push: {
                dailyData: {
                  $each: [
                    {
                      date: formattedDate,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { date: -1 },
                },
              },
            },
          },
        });

        //END OF THE  VEHICLESTATS UPDATING

        //START OF THE CONTRACTORSTATS UPDATING

        bulkContractorStats.push({
          updateOne: {
            filter: { contractorId, delivererId, year },
            update: {
              $inc: {
                yearlyMileage: distance,
                yearlyRevenue: cost,
                yearlyJobs: 1, // Increment yearlyJobs by 1
              },
              $setOnInsert: {
                monthlyData: [],
                dailyData: [],
              },
            },
            upsert: true,
          },
        });

        bulkContractorStats.push({
          updateOne: {
            filter: {
              contractorId,
              delivererId,
              year,
              "monthlyData.month": month,
            },
            update: {
              $inc: {
                // yearlyJobs: 1,

                "monthlyData.$.totalMileage": distance,
                "monthlyData.$.totalRevenue": cost,
                "monthlyData.$.totalProfit": cost,
                "monthlyData.$.totalExpenses": 0,
                "monthlyData.$.totalJobs": 1,
              },

              arrayFilters: [{ "elem.month": month }],
            },
          },
        });

        bulkContractorStats.push({
          updateOne: {
            filter: {
              contractorId,
              delivererId,
              year,
              "monthlyData.month": { $ne: month },
            },
            update: {
              $push: {
                monthlyData: {
                  $each: [
                    {
                      month,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { month: -1 },
                },
              },
            },
          },
        });
        //Updating the daily data and soring
        bulkContractorStats.push({
          updateOne: {
            filter: {
              contractorId,
              delivererId,
              year,
              "dailyData.date": formattedDate,
            },
            update: {
              $inc: {
                "dailyData.$.totalMileage": distance,
                "dailyData.$.totalRevenue": cost,
                "dailyData.$.totalJobs": 1,
              },
            },
          },
        });

        bulkContractorStats.push({
          updateOne: {
            filter: {
              contractorId,
              delivererId,
              year,
              "dailyData.date": { $ne: formattedDate },
            },
            update: {
              $push: {
                dailyData: {
                  $each: [
                    {
                      date: formattedDate,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { date: -1 },
                },
              },
            },
          },
        });
        //END OF THE CONTRACTORSTATS UPDATING

        //START OF THE OVERALLSTATS UPDATING

        bulkOverallStats.push({
          updateOne: {
            filter: { companyId, year },
            update: {
              $inc: {
                yearlyMileage: distance,
                yearlyRevenue: parseFloat(cost).toFixed(2),
                yearlyProfit: cost,
                yearlyExpenses: 0,
                [`revenueByContractor.${contractorName}`]: cost,
                [`jobsByContractor.${contractorName}`]: 1,
                yearlyJobs: 1, // Increment yearlyJobs by 1
              },
              $setOnInsert: {
                monthlyData: [],
                dailyData: [],
                // yearlyJobs: 1,
                totalCustomers: totalCustomers,
              },
            },
            upsert: true,
          },
        });

        bulkOverallStats.push({
          updateOne: {
            filter: { companyId, year, "monthlyData.month": month },
            update: {
              $inc: {
                // yearlyJobs: 1,

                "monthlyData.$.totalMileage": distance,
                "monthlyData.$.totalRevenue": cost,
                "monthlyData.$.totalProfit": cost,
                "monthlyData.$.totalExpenses": 0,
                "monthlyData.$.totalJobs": 1,
              },

              arrayFilters: [{ "elem.month": month }],
            },
          },
        });

        bulkOverallStats.push({
          updateOne: {
            filter: { companyId, year, "monthlyData.month": { $ne: month } },
            update: {
              $push: {
                monthlyData: {
                  $each: [
                    {
                      month,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalProfit: cost,
                      totalExpenses: 0,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { month: -1 },
                },
              },
            },
          },
        });
        //Updating the daily data and soring
        bulkOverallStats.push({
          updateOne: {
            filter: { companyId, year, "dailyData.date": formattedDate },
            update: {
              $inc: {
                "dailyData.$.totalMileage": distance,
                "dailyData.$.totalRevenue": cost,
                "dailyData.$.totalJobs": 1,
              },
            },
          },
        });

        bulkOverallStats.push({
          updateOne: {
            filter: {
              companyId,
              year,
              "dailyData.date": { $ne: formattedDate },
            },
            update: {
              $push: {
                dailyData: {
                  $each: [
                    {
                      date: formattedDate,
                      totalMileage: distance,
                      totalRevenue: cost,
                      totalJobs: 1,
                    },
                  ],
                  $sort: { date: -1 },
                },
              },
            },
          },
        });

        //END OF THE DRIVERSTATS UPDATING

        await newJob.save();

        const jobId = newJob._id;
        jobIds.push(jobId);
      }
      //checking the deliverer table

      // Perform bulk operations for DriverStats, VehicleStats, and OverallStats
      await DriverStats.bulkWrite(bulkDriverStats);
      await VehicleStats.bulkWrite(bulkVehicleStats);
      await OverallStats.bulkWrite(bulkOverallStats);
      await ContractorStats.bulkWrite(bulkContractorStats);

      await OverallStats.updateOne(
        { companyId, year },
        {
          $set: {
            totalCustomers: totalCustomers,
            totalContractors: totalContractors,
          },
        },
        {}
      );

      await Contractor.updateOne(
        { _id: contractorId },
        { $inc: { lastOrder: 1 } }
      );

      await deliverer.job_ids.push(...jobIds);
      await driver.job_ids.push(...jobIds);
      await vehicle.job_ids.push(...jobIds);
      await contractor.job_ids.push(...jobIds);

      await driver.save();
      await vehicle.save();
      await deliverer.save();
      await contractor.save();

      const vehStats = await VehicleStats.findOne({ vehicleId: vehicleId });
      const drStats = await DriverStats.findOne({ driverId: driverId });
      const ovStats = await OverallStats.findOne({ companyId: companyId });

      // Sort the monthlyData array by month in ascending order
      drStats.monthlyData.sort(
        (a, b) =>
          new Date(Date.parse(`01 ${a.month} 2000`)) -
          new Date(Date.parse(`01 ${b.month} 2000`))
      );
      // Sort the dailyData array by date in ascending order
      // the a.date is date is the name of he field in the dailyData
      drStats.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

      await drStats.save();

      // Sort the monthlyData array by month in ascending order
      vehStats.monthlyData.sort(
        (a, b) =>
          new Date(Date.parse(`01 ${a.month} 2000`)) -
          new Date(Date.parse(`01 ${b.month} 2000`))
      );
      // Sort the dailyData array by date in ascending order
      // the a.date is date is the name of he field in the dailyData
      vehStats.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Save the sorted dailyData array
      await vehStats.save();

      // Sort the monthlyData array by month in ascending order
      ovStats.monthlyData.sort(
        (a, b) =>
          new Date(Date.parse(`01 ${a.month} 2000`)) -
          new Date(Date.parse(`01 ${b.month} 2000`))
      );
      // Sort the dailyData array by date in ascending order
      // the a.date is date is the name of he field in the dailyData
      ovStats.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Save the sorted dailyData array
      await ovStats.save();

      // Update driver and vehicle collections

      const contrStats = await ContractorStats.find({
        contractorId: contractorId,
        delivererId: companyId,
      });
      if (!contrStats) {
        return next(new ErrorHandler("Contractor not found", 400));
      }
      await contrStats[0].job_ids.push(...jobIds);
      await contrStats[0].save();
      // ...

      res.status(201).json({
        success: true,
        message: "Jobs added successfully",
        jobs,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// update job info
router.put(
  "/update-job",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        jobId,
        jobNum,
        fromId,
        pageCustomerId,
        description,
        vehicleId,
        contractorId,
        driverId,
        mileageIn,
        mileageOut,
        deliveryType,
        cost,
        distance,
        orderDatee,
      } = req.body;

      const job = await Job.findById(jobId);

      if (!job) {
        return next(new ErrorHandler("Job not found", 400));
      }
      if (!jobId) {
        return next(new ErrorHandler("Job Id is required"));
      }

      //START updating the stats

      const deliverer = await Deliverer.findById(req.user.companyId);

      const companyId = deliverer._id;
      console.log(companyId);

      const contractor = await Contractor.findById(contractorId);
      if (!contractor || !contractor.companyName) {
        return next(new ErrorHandler("Contractor not found ", 500));
      }

      const jobDate = job.orderDate;
      year = jobDate.getFullYear();

      // Validate year
      if (!year) {
        console.error("Year is not defined.");
        throw new Error("Year is required for the filter.");
      }
      const month = jobDate.toLocaleString("default", { month: "long" }); // Get month name

      //const currentDate = date.getDate();

      const day = String(jobDate.getDate()).padStart(2, "0"); // Get the day component and pad with leading zero if necessary
      const monthNumber = String(jobDate.getMonth() + 1).padStart(2, "0"); // Get the month component and pad with leading zero if necessary

      const formattedDate = `${year}-${monthNumber}-${day}`;

      const jobCostDecimal128 = Decimal128.fromString(job.cost.toString());
      const newOldCostDecimal128 = Decimal128.fromString(cost.toString());
      let updatedCost;


      // Helper function to subtract Decimal128 values
      function addDecimal128(a, b) {
        // Ensure both are Decimal128

        // Convert Decimal128 to string for correct subtraction
        const aValue = parseFloat(a.toString());
        const bValue = parseFloat(b.toString());

        console.log("a", a)
        console.log("b",b)
        // Subtract and return as a new Decimal128
        return parseFloat((aValue + bValue).toFixed(2));
      }
      // Helper function to subtract Decimal128 values
      function subtractDecimal128(a, b) {
        // Ensure both are Decimal128

        // Convert Decimal128 to string for correct subtraction
        const aValue = parseFloat(a.toString());
        const bValue = parseFloat(b.toString());

        // Subtract and return as a new Decimal128
        return parseFloat((aValue - bValue).toFixed(2));
      }

      const costDifference = subtractDecimal128(cost, jobCostDecimal128);

    
      const mileageDifference = distance - job.distance;
      const contractorFieldKey = `revenueByContractor.${contractor.companyName}`;
      updatedCost = parseFloat(costDifference).toFixed(2);


      //start of updating the overall stats

      const overallStats = await OverallStats.findOne({
        companyId: req.user.companyId,
        year: year,
      });

      const vehStats = await VehicleStats.findOne({
        vehicleId: vehicleId,
        year: year,
      });
      
      const drStats = await DriverStats.findOne({
        driverId: driverId,
        year: year,
      });
      const contrStats = await ContractorStats.findOne({
        contractorId: contractorId,
        delivererId: req.user.companyId,
        year: year,
      });


      if (overallStats) {
        const dailyStatsToUpdate = overallStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = overallStats.monthlyData.find(
          (item) => item.month === month
        );
        console.log("now herer 1")
        
        console.log("now herer 1",overallStats.yearlyRevenue)
        console.log("cost", cost)
        console.log("jobCostDecimal", jobCostDecimal128)
        console.log("costDiffer", costDifference)
        
        overallStats.yearlyMileage += mileageDifference;
        overallStats.yearlyRevenue = addDecimal128(
          overallStats.yearlyRevenue,
          costDifference
        );
        console.log("now herer 2", overallStats.yearlyRevenue)
        overallStats.yearlyProfit = addDecimal128(
          overallStats.yearlyProfit,
          costDifference
        );

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalMileage += mileageDifference;
          dailyStatsToUpdate.totalRevenue = addDecimal128(
            dailyStatsToUpdate.totalRevenue,
            costDifference
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalMileage += mileageDifference;
          monthlyStatsToUpdate.totalRevenue = addDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            costDifference
          );
          monthlyStatsToUpdate.totalProfit = addDecimal128(
            monthlyStatsToUpdate.totalProfit,
            costDifference
          );
        }

        // Log the dynamic field key

        const updateRevenueOverallStats = [];
        updateRevenueOverallStats.push({
          updateOne: {
            filter: { companyId, year },
            update: {
              $inc: {
                [contractorFieldKey]: updatedCost,
              },
            },
            upsert: true,
          },
        });

        try {
          const resultOverall = await OverallStats.bulkWrite(
            updateRevenueOverallStats
          );
        } catch (error) {
          console.error("Error writing update to OverallStats:", error);
          throw new Error("Failed to write update to OverallStats.");
        }
        await overallStats.save();
      }

      //end of updateing the overall stats
      if (vehStats) {
        const dailyStatsToUpdate = vehStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = vehStats.monthlyData.find(
          (item) => item.month === month
        );

        vehStats.yearlyMileage += mileageDifference;
        vehStats.yearlyRevenue = addDecimal128(
          vehStats.yearlyRevenue,
          costDifference
        );
        vehStats.yearlyProfit = addDecimal128(
          vehStats.yearlyProfit,
          costDifference
        );

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalMileage += mileageDifference;
          dailyStatsToUpdate.totalRevenue = addDecimal128(
            dailyStatsToUpdate.totalRevenue,
            costDifference
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalMileage += mileageDifference;
          monthlyStatsToUpdate.totalRevenue = addDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            costDifference
          );
          monthlyStatsToUpdate.totalProfit = addDecimal128(
            monthlyStatsToUpdate.totalProfit,
            costDifference
          );
        }

        const updateRevenuevehStats = [];
        updateRevenuevehStats.push({
          updateOne: {
            filter: { vehicleId, year },
            update: {
              $inc: {
                [contractorFieldKey]: updatedCost,
              },
            },
            upsert: true,
          },
        });

        try {
          const resultveh = await VehicleStats.bulkWrite(
            updateRevenuevehStats
          );
        } catch (error) {
          console.error("Error writing update to vehStats:", error);
          throw new Error("Failed to write update to vehStats.");
        }
        await vehStats.save();
      }

      if (drStats) {
        const dailyStatsToUpdate = drStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = drStats.monthlyData.find(
          (item) => item.month === month
        );

        drStats.yearlyMileage += mileageDifference;
        drStats.yearlyRevenue = addDecimal128(
          drStats.yearlyRevenue,
          costDifference
        );
        drStats.yearlyProfit = addDecimal128(
          drStats.yearlyProfit,
          costDifference
        );

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalMileage += mileageDifference;
          dailyStatsToUpdate.totalRevenue = addDecimal128(
            dailyStatsToUpdate.totalRevenue,
            costDifference
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalMileage += mileageDifference;
          monthlyStatsToUpdate.totalRevenue = addDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            costDifference
          );
          monthlyStatsToUpdate.totalProfit = addDecimal128(
            monthlyStatsToUpdate.totalProfit,
            costDifference
          );
        }

        const updateRevenuedrStats = [];
        updateRevenuedrStats.push({
          updateOne: {
            filter: { driverId, year },
            update: {
              $inc: {
                [contractorFieldKey]: updatedCost,
              },
            },
            upsert: true,
          },
        });

        try {
          const resultdr = await DriverStats.bulkWrite(
            updateRevenuedrStats
          );
          console.log("Update result:", resultdr);
        } catch (error) {
          console.error("Error writing update to drStats:", error);
          throw new Error("Failed to write update to drStats.");
        }
        await drStats.save();
      }

      
      if (contrStats) {
        const dailyStatsToUpdate = contrStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = contrStats.monthlyData.find(
          (item) => item.month === month
        );

        contrStats.yearlyMileage += mileageDifference;
        // Perform subtraction and round to 2 decimal places
        contrStats.yearlyRevenue = addDecimal128(
          contrStats.yearlyRevenue,
          costDifference
        );

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalMileage += mileageDifference
          dailyStatsToUpdate.totalRevenue = addDecimal128(
            dailyStatsToUpdate.totalRevenue,
            costDifference
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalMileage += mileageDifference;
          monthlyStatsToUpdate.totalRevenue = addDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            costDifference
          );
        }

      
        await contrStats.save();
      }
      

      // Remove the jobId from the deliverer's array of jobIds

      try {
        job.jobNumber = jobNum;
        job.from = fromId;
        job.customer = pageCustomerId;
        job.distance = distance;
        job.cost = cost;
        job.mileageIn = mileageIn;
        job.mileageOut = mileageOut;
        job.orderDate = orderDatee;
        job.description = description;
        job.deliveryType = deliveryType;
        job.contractorId = contractorId;
        job.driverId = driverId;
        job.vehicleId = vehicleId;

        await job.save();
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }

      res.status(201).json({
        success: true,
        job,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//deleting the job
router.delete(
  "/delete-job/:jobId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const jobId = req.params.jobId;

      const job = await Job.findById(jobId);

      if (!job) {
        return next(new ErrorHandler("There is no job with this id", 500));
      }

      const vehicleId = job.vehicleId;
      const driverId = job.driverId;
      const contractorId = job.contractorId;
      const deliverer = await Deliverer.findById(req.user.companyId);

      if (!deliverer) {
        return next(
          new ErrorHandler("There is no deliverer with this id", 500)
        );
      }
      const driver = await Driver.findById(driverId);

      if (!driver) {
        return next(new ErrorHandler("Driver not found", 500));
      }
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return next(new ErrorHandler("Driver not found ", 500));
      }

      const contractor = await Contractor.findById(contractorId);
      if (!contractor) {
        return next(new ErrorHandler("Contractor not found ", 500));
      }

      // Remove the jobId from the deliverer's array of jobIds
      const updatedJobIds = deliverer.job_ids.filter(
        (id) => id.toString() !== jobId
      );

      // Update the deliverer's jobIds array with the updated array
      deliverer.job_ids = updatedJobIds;

      await deliverer.save();

      const jobDate = job.orderDate;
      year = jobDate.getFullYear();
      const month = jobDate.toLocaleString("default", { month: "long" }); // Get month name

      //const currentDate = date.getDate();

      const day = String(jobDate.getDate()).padStart(2, "0"); // Get the day component and pad with leading zero if necessary
      const monthNumber = String(jobDate.getMonth() + 1).padStart(2, "0"); // Get the month component and pad with leading zero if necessary

      const formattedDate = `${year}-${monthNumber}-${day}`;
      const jobCostDecimal128 = Decimal128.fromString(job.cost.toString());

      // Helper function to round Decimal128 to 2 decimal places
      // Helper function to subtract Decimal128 values
      function subtractDecimal128(a, b) {
        // Ensure both are Decimal128

        // Convert Decimal128 to string for correct subtraction
        const aValue = parseFloat(a.toString());
        const bValue = parseFloat(b.toString());

        // Subtract and return as a new Decimal128
        return parseFloat((aValue - bValue).toFixed(2));
      }
      //END updating overall stats
      const overallStats = await OverallStats.findOne({
        companyId: req.user.companyId,
        year: year,
      });

      const vehStats = await VehicleStats.findOne({
        vehicleId: vehicleId,
        year: year,
      });
      const drStats = await DriverStats.findOne({
        driverId: driverId,
        year: year,
      });
      const contrStats = await ContractorStats.findOne({
        contractorId: contractorId,
        delivererId: req.user.companyId,
        year: year,
      });

      if (overallStats) {
        const dailyStatsToUpdate = overallStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = overallStats.monthlyData.find(
          (item) => item.month === month
        );
        const jobsByContractorStatsToUpdate = overallStats.jobsByContractor;

        console.log("Jobs by contractor stats to update", jobsByContractorStatsToUpdate)
        overallStats.yearlyJobs -= 1;
        overallStats.yearlyMileage -= job.distance;
        console.log(overallStats.yearlyRevenue);
        console.log(jobCostDecimal128);
        // Perform subtraction and round to 2 decimal places
        overallStats.yearlyRevenue = subtractDecimal128(
          overallStats.yearlyRevenue,
          jobCostDecimal128
        );
        overallStats.yearlyProfit = subtractDecimal128(
          overallStats.yearlyProfit,
          jobCostDecimal128
        );

        // console.log("jobs by contractor stats to update", jobsByContractorStatsToUpdate);

        // // Convert to a Map
        // const jobsByContractorStatsMap = new Map(Object.entries(jobsByContractorStatsToUpdate));
        
        // const contractorJobsEntry = Array.from(jobsByContractorStatsMap.entries())
        //   .find(([key]) => key === contractor.companyName);
        
        // if (!contractorJobsEntry) {
        //   console.log("An error occurred here");
        //   return next(new ErrorHandler("Non contractor", 500));
        // }
        
        // const [key, contractorJobValue] = contractorJobsEntry;
        // const newContrJobs = contractorJobValue - 1;
        // jobsByContractorStatsMap.set(key, newContrJobs);
        
        // // Optional: convert back to object
        // jobsByContractorStatsToUpdate = Object.fromEntries(jobsByContractorStatsMap);
        
        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalJobs -= 1;
          dailyStatsToUpdate.totalMileage -= job.distance;
          dailyStatsToUpdate.totalRevenue = subtractDecimal128(
            dailyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalJobs -= 1;
          monthlyStatsToUpdate.totalMileage -= job.distance;
          monthlyStatsToUpdate.totalRevenue = subtractDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
          monthlyStatsToUpdate.totalProfit = subtractDecimal128(
            monthlyStatsToUpdate.totalProfit,
            jobCostDecimal128
          );
        }

        //END updating overall stats

        // Parse and convert the cost to Decimal128
        let updatedCost;
        try {
          updatedCost = Decimal128.fromString(parseFloat(job.cost).toFixed(2));
          console.log(`Parsed cost as Decimal128: ${updatedCost.toString()}`);
        } catch (error) {
          console.error("Error parsing job cost to Decimal128:", error);
          throw new Error("Failed to parse job cost to Decimal128.");
        }

        // Validate contractor name
        if (!contractor || !contractor.companyName) {
          console.error("Invalid contractor object:", contractor);
          throw new Error("Contractor name is missing or invalid.");
        }

        // Validate year
        if (!year) {
          console.error("Year is not defined.");
          throw new Error("Year is required for the filter.");
        }

        //END updating overall stats

        const companyId = deliverer._id;

        // Build dynamic keys
        const revenueFieldKey = `revenueByContractor.${contractor.companyName}`;
        const jobsFieldKey = `jobsByContractor.${contractor.companyName}`;
        
        console.log(`Dynamic revenue field key: ${revenueFieldKey}`);
        console.log(`Dynamic jobs field key: ${jobsFieldKey}`);
        
        // Format cost
       updatedCost = parseFloat(job.cost).toFixed(2);
        
        // Build the bulkWrite operations array
        const updateStatsOperations = [
          {
            updateOne: {
              filter: { companyId, year },
              update: {
                $inc: {
                  [revenueFieldKey]: -updatedCost,
                },
              },
              upsert: true,
            },
          },
          {
            updateOne: {
              filter: { companyId, year },
              update: {
                $inc: {
                  [jobsFieldKey]: -1,
                },
              },
              upsert: true,
            },
          },
        ];
        
        try {
          // Perform bulkWrite operation
          const result = await OverallStats.bulkWrite(updateStatsOperations);
          console.log("Update result:", result);
        } catch (error) {
          console.error("Error writing update to OverallStats:", error);
          throw new Error("Failed to write update to OverallStats.");
        }
        
        await overallStats.save();
      }

      if (vehStats) {
        const dailyStatsToUpdate = vehStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = vehStats.monthlyData.find(
          (item) => item.month === month
        );
        const jobsByContractorStatsToUpdate = vehStats.jobsByContractor;

        console.log("jobs by contractor",jobsByContractorStatsToUpdate)

        vehStats.yearlyJobs -= 1;
        vehStats.yearlyMileage -= job.distance;
        // Perform subtraction and round to 2 decimal places
        vehStats.yearlyRevenue = subtractDecimal128(
          vehStats.yearlyRevenue,
          jobCostDecimal128
        );
        vehStats.yearlyProfit = subtractDecimal128(
          vehStats.yearlyProfit,
          jobCostDecimal128
        );

        // const contractorJobsEntry = Array.from(
        //   jobsByContractorStatsToUpdate.entries()
        // ).find(([key]) => key === contractor.companyName);

        // if (contractorJobsEntry) {
        //   const [key, contractorJobValue] = contractorJobsEntry;
        //   const newContrJobs = contractorJobValue - 1;
        //   jobsByContractorStatsToUpdate.set(key, newContrJobs);
        // }

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalJobs -= 1;
          dailyStatsToUpdate.totalMileage -= job.distance;
          dailyStatsToUpdate.totalRevenue = subtractDecimal128(
            dailyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalJobs -= 1;
          monthlyStatsToUpdate.totalMileage -= job.distance;
          monthlyStatsToUpdate.totalRevenue = subtractDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
          monthlyStatsToUpdate.totalProfit = subtractDecimal128(
            monthlyStatsToUpdate.totalProfit,
            jobCostDecimal128
          );
        }

        //END updating overall stats

        // Parse and convert the cost to Decimal128
        let updatedCost;
        try {
          updatedCost = Decimal128.fromString(parseFloat(job.cost).toFixed(2));
          console.log(`Parsed cost as Decimal128: ${updatedCost.toString()}`);
        } catch (error) {
          console.error("Error parsing job cost to Decimal128:", error);
          throw new Error("Failed to parse job cost to Decimal128.");
        }

        // Validate contractor name
        if (!contractor || !contractor.companyName) {
          console.error("Invalid contractor object:", contractor);
          throw new Error("Contractor name is missing or invalid.");
        }

        // Validate year
        if (!year) {
          console.error("Year is not defined.");
          throw new Error("Year is required for the filter.");
        }

        //END updating overall stats

        // Build dynamic keys
        const revenueFieldKey = `revenueByContractor.${contractor.companyName}`;
        const jobsFieldKey = `jobsByContractor.${contractor.companyName}`;
        
        console.log(`Dynamic revenue field key: ${revenueFieldKey}`);
        console.log(`Dynamic jobs field key: ${jobsFieldKey}`);
        
        // Format cost
       updatedCost = parseFloat(job.cost).toFixed(2);
        
        // Build the bulkWrite operations array
        const updateStatsOperations = [
          {
            updateOne: {
              filter: { vehicleId, year },
              update: {
                $inc: {
                  [revenueFieldKey]: -updatedCost,
                },
              },
              upsert: true,
            },
          },
          {
            updateOne: {
              filter: { vehicleId, year },
              update: {
                $inc: {
                  [jobsFieldKey]: -1,
                },
              },
              upsert: true,
            },
          },
        ];
        
        try {
          // Perform bulkWrite operation
          const result = await VehicleStats.bulkWrite(updateStatsOperations);
          console.log("Update result:", result);
        } catch (error) {
          console.error("Error writing update to OverallStats:", error);
          throw new Error("Failed to write update to OverallStats.");
        }


        // Remove the jobId from the vehicle's array of jobIds
        const updatedJobIdsVeh = vehicle.job_ids.filter(
          (id) => id.toString() !== jobId
        );

        // Update the vehicle's jobIds array with the updated array
        vehicle.job_ids = updatedJobIdsVeh;
        await vehicle.save();
        await vehStats.save();
      }
      if (drStats) {
        const dailyStatsToUpdate = drStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = drStats.monthlyData.find(
          (item) => item.month === month
        );
        const jobsByContractorStatsToUpdate = drStats.jobsByContractor;

        drStats.yearlyJobs -= 1;
        drStats.yearlyMileage -= job.distance;
        // Perform subtraction and round to 2 decimal places
        drStats.yearlyRevenue = subtractDecimal128(
          drStats.yearlyRevenue,
          jobCostDecimal128
        );
        drStats.yearlyProfit = subtractDecimal128(
          drStats.yearlyProfit,
          jobCostDecimal128
        );

       

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalJobs -= 1;
          dailyStatsToUpdate.totalMileage -= job.distance;
          dailyStatsToUpdate.totalRevenue = subtractDecimal128(
            dailyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalJobs -= 1;
          monthlyStatsToUpdate.totalMileage -= job.distance;
          monthlyStatsToUpdate.totalRevenue = subtractDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
          monthlyStatsToUpdate.totalProfit = subtractDecimal128(
            monthlyStatsToUpdate.totalProfit,
            jobCostDecimal128
          );
        }

        //END updating overall stats

        // Parse and convert the cost to Decimal128
        let updatedCost;
        try {
          updatedCost = Decimal128.fromString(parseFloat(job.cost).toFixed(2));
          console.log(`Parsed cost as Decimal128: ${updatedCost.toString()}`);
        } catch (error) {
          console.error("Error parsing job cost to Decimal128:", error);
          throw new Error("Failed to parse job cost to Decimal128.");
        }

        // Validate contractor name
        if (!contractor || !contractor.companyName) {
          console.error("Invalid contractor object:", contractor);
          throw new Error("Contractor name is missing or invalid.");
        }

        // Validate year
        if (!year) {
          console.error("Year is not defined.");
          throw new Error("Year is required for the filter.");
        }

        //END updating overall stats

             // Build dynamic keys
             const revenueFieldKey = `revenueByContractor.${contractor.companyName}`;
             const jobsFieldKey = `jobsByContractor.${contractor.companyName}`;
             
             console.log(`Dynamic revenue field key: ${revenueFieldKey}`);
             console.log(`Dynamic jobs field key: ${jobsFieldKey}`);
             
             // Format cost
            updatedCost = parseFloat(job.cost).toFixed(2);
             
             // Build the bulkWrite operations array
             const updateStatsOperations = [
               {
                 updateOne: {
                   filter: { driverId, year },
                   update: {
                     $inc: {
                       [revenueFieldKey]: -updatedCost,
                     },
                   },
                   upsert: true,
                 },
               },
               {
                 updateOne: {
                   filter: { driverId, year },
                   update: {
                     $inc: {
                       [jobsFieldKey]: -1,
                     },
                   },
                   upsert: true,
                 },
               },
             ];
             
             try {
               // Perform bulkWrite operation
               const result = await DriverStats.bulkWrite(updateStatsOperations);
               console.log("Update result:", result);
             } catch (error) {
               console.error("Error writing update to OverallStats:", error);
               throw new Error("Failed to write update to OverallStats.");
             }
      // Remove the jobId from the driver's array of jobIds
        const updatedJobIdsDr = driver.job_ids.filter(
          (id) => id.toString() !== jobId
        );

        // Update the driver's jobIds array with the updated array
        driver.job_ids = updatedJobIdsDr;
        await driver.save();
        await drStats.save();
      }

      if (contrStats) {
        const dailyStatsToUpdate = contrStats.dailyData.find(
          (item) => item.date === formattedDate
        );
        const monthlyStatsToUpdate = contrStats.monthlyData.find(
          (item) => item.month === month
        );

        contrStats.yearlyJobs -= 1;
        contrStats.yearlyMileage -= job.distance;
        // Perform subtraction and round to 2 decimal places
        contrStats.yearlyRevenue = subtractDecimal128(
          contrStats.yearlyRevenue,
          jobCostDecimal128
        );

        if (dailyStatsToUpdate) {
          dailyStatsToUpdate.totalJobs -= 1;
          dailyStatsToUpdate.totalMileage -= job.distance;
          dailyStatsToUpdate.totalRevenue = subtractDecimal128(
            dailyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
        }
        if (monthlyStatsToUpdate) {
          monthlyStatsToUpdate.totalJobs -= 1;
          monthlyStatsToUpdate.totalMileage -= job.distance;
          monthlyStatsToUpdate.totalRevenue = subtractDecimal128(
            monthlyStatsToUpdate.totalRevenue,
            jobCostDecimal128
          );
        }

        // Remove the jobId from the driver's array of jobIds
        const updatedJobIdsContr = contractor.job_ids.filter(
          (id) => id.toString() !== jobId
        );
        // Remove the jobId from the driver's array of jobIds
        const updatedJobIdsContrStats = contrStats.job_ids.filter(
          (id) => id.toString() !== jobId
        );

        // Update the driver's jobIds array with the updated array
        contractor.job_ids = updatedJobIdsContr;
        contrStats.job_ids = updatedJobIdsContrStats;

        await contractor.save();
        await contrStats.save();
      }

      const jobToDelete = await Job.findByIdAndDelete({ _id: jobId });
      if (!jobToDelete) {
        return next(new ErrorHandler("There is no job with this id", 500));
      }

      res.status(201).json({
        success: true,
        message: "Job Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

router.get(
  "/get-all-jobs-page",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let {
        page = 0,
        pageSize = 25,
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      console.log("sort",sort)

      // Parse sort option if available
      const generateSort = () => {
        // if (!sort) return { orderDate: -1 };
        const sortParsed = JSON.parse(sort);
        return {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };
      };
      

      // const sortOptions = generateSort();
        // Formatted sort should look like { field: 1 } or { field: -1 }
        // const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };
 // Formatted sort should look like { field: 1 } or { field: -1 }
 const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };

      // Get the deliverer (company) based on the user
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      const jobIds = deliverer.job_ids;

      // MongoDB aggregation pipeline for optimization
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },
            ],
          },
        },
        { $sort: { orderDate: -1 } }, // Sort by orderDate in descending order

        
        {
          $facet: {
            pageJobs: [
              { $skip: page * parseInt(pageSize, 10) },
              { $limit: parseInt(pageSize, 10) },

            ],
            totalCount: [{ $count: "total" }],
          },
        },

        // { $sort: sortOptions },

      ];

      // Execute the aggregation pipeline
      const result = await Job.aggregate(pipeline);

      if (result.length === 0 || result[0].pageJobs.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      const { pageJobs, totalCount } = result[0];

      // Format the 'cost' field if needed
      const formattedJobs = pageJobs.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()).toFixed(2), // Format the cost to 2 decimal places
      }));

      // Return the paginated jobs with the total count
      res.status(200).json({
        success: true,
        pageJobs: formattedJobs,
        totalCount: totalCount.length ? totalCount[0].total : 0,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the latest jobs for the vdeliverer
router.get(
  "/get-latest-jobs-deliverer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      //.log(vehicleId, "show")
      //const { vehicleId } = req.body;
      let {
        page = 1,
        pageSize = 25,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };

      // Find the deliverer based on the company ID
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      // Get the job IDs associated with the deliverer
      const jobIds = deliverer.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        { $sort: { orderDate: -1 } }, // Sort by orderDate in descending order
        { $limit: 5 }, // Limit the results to 5 jobs
        { $sort: sortOptions }, // Apply the requested sort options
      ];

      // Execute the aggregation pipeline
      const latestDelivererJobs = await Job.aggregate(pipeline);
      if (latestDelivererJobs.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });

      // Format the 'cost' field if needed
      const formattedJobs = latestDelivererJobs.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));

      res.status(200).json({
        success: true,
        latestDelivererJobs: formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the latest jobs for the contractor
router.get(
  "/get-latest-jobs-contractor/:contractorId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const contractorId = req.params.contractorId;

      let {
        page = 1,
        pageSize = 20,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };

      // Find the deliverer based on the company ID

      const getContractorStats = await ContractorStats.find({
        contractorId: contractorId,
        delivererId: req.user.companyId,
      });

      if (!getContractorStats) {
        return res.status(404).json({
          success: false,
          message: "Contractor Stats not found",
        });
      }

      // Get the job IDs associated with the deliverer
      const jobIds = getContractorStats[0].job_ids;

      if (!jobIds.length === 0) {
        res.status(201).json({
          success: false,
          message: "No Jobs for Contractor",
        });
      }
      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        { $sort: { orderDate: -1 } }, // Sort by orderDate in descending order
        { $limit: 5 }, // Limit the results to 5 jobs
        { $sort: sortOptions }, // Apply the requested sort options
      ];

      // Execute the aggregation pipeline
      const latestContractorJobs = await Job.aggregate(pipeline);
      if (latestContractorJobs.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });

      const formattedJobs = latestContractorJobs.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));

      res.status(200).json({
        success: true,
        latestContractorJobs:formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the latest jobs for the vehicle
router.get(
  "/get-latest-jobs-vehicle/:vehicleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const vehicleId = req.params.vehicleId;
      let {
        page = 1,
        pageSize = 20,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };

      // Find the deliverer based on the company ID
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // Get the customer IDs associated with the deliverer
      const jobIds = vehicle.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        { $sort: { orderDate: -1 } }, // Sort by orderDate in descending order
        { $limit: 5 }, // Limit the results to 5 jobs
        { $sort: sortOptions }, // Apply the requested sort options
      ];

      // Execute the aggregation pipeline
      const latestVehicleJobs = await Job.aggregate(pipeline);
      if (latestVehicleJobs.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });
      const formattedJobs = latestVehicleJobs.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));
      res.status(200).json({
        success: true,
        latestVehicleJobs:formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the latest jobs for the driver
router.get(
  "/get-latest-jobs-driver/:driverId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const driverId = req.params.driverId;
      let {
        page = 1,
        pageSize = 20,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: -1 };

      // Find the deliverer based on the company ID
      const driver = await Driver.findById(driverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found",
        });
      }

      // Get the customer IDs associated with the deliverer
      const jobIds = driver.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        { $sort: { orderDate: -1 } }, // Sort by orderDate in descending order
        { $limit: 5 }, // Limit the results to 5 jobs
        { $sort: sortOptions }, // Apply the requested sort options
      ];

      // Execute the aggregation pipeline
      const latestDriverJobs = await Job.aggregate(pipeline);

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });
      if (!latestDriverJobs) {
        return res.status(200).json({
          success: false,
          message: "No jobs in the system for this driver",
        });
      } else {
        const formattedJobs = latestDriverJobs.map((job) => ({
          ...job,
          cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
        }));
        res.status(200).json({
          success: true,
          latestDriverJobs:formattedJobs,
          totalCount,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the jobs for the reports processing deliverer
router.get(
  "/get-all-jobsReport-deliverer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let {
        page = 0,
        pageSize = 25,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: 1 };

      // Find the deliverer based on the company ID
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      // Get the customer IDs associated with the deliverer
      const jobIds = deliverer.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },
              { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        // { $sort: { orderDate: 1 } }, // Sort by orderDate in descending order

        { $sort: sortOptions },
      ];
      // Execute the aggregation pipeline
      const delivererWithJobsReport = await Job.aggregate(pipeline);
      if (delivererWithJobsReport.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });
      const formattedJobs = delivererWithJobsReport.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));
      res.status(200).json({
        success: true,
        delivererWithJobsReport:formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the jobs for the reports processing contractor
router.get(
  "/get-all-jobsReport-contractor/:contractorId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const contractorId = req.params.contractorId;
      let {
        //page = 0,
        //pageSize = 25,
        //searcha = "",
        jobSearch = "",

        sort = null,
        //sorta = null,
        //sortField = "_id",
        //sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: 1 };

      // Find the deliverer based on the company ID
      const contractor = await Contractor.findById(contractorId);
      if (!contractor) {
        return res.status(404).json({
          success: false,
          message: "Contractor not found",
        });
      }

      // Get the customer IDs associated with the contractor
      const jobIds = contractor.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },
              { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        // { $sort: { orderDate: 1 } }, // Sort by orderDate in descending order

        { $sort: sortOptions },
      ];
      // Execute the aggregation pipeline
      const contractorWithJobsReport = await Job.aggregate(pipeline);
      if (contractorWithJobsReport.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });

      const formattedJobs = contractorWithJobsReport.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));
      res.status(200).json({
        success: true,
        contractorWithJobsReport:formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the jobs for the reports processing --driver
router.get(
  "/get-all-jobsReport-driver/:driverId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const driverId = req.params.driverId;
      let {
        page = 0,
        pageSize = 25,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: 1 };

      // Find the deliverer based on the company ID
      const driver = await Driver.findById(driverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found",
        });
      }

      // Get the customer IDs associated with the driver
      const jobIds = driver.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },
              { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        // { $sort: { orderDate: 1 } }, // Sort by orderDate in descending order

        { $sort: sortOptions },
      ];
      // Execute the aggregation pipeline
      const driverWithJobsReport = await Job.aggregate(pipeline);
      if (driverWithJobsReport.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });
      const formattedJobs = driverWithJobsReport.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));

      res.status(200).json({
        success: true,
        driverWithJobsReport: formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//getting the jobs for the reports processing --vehicle
router.get(
  "/get-all-jobsReport-vehicle/:vehicleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const vehicleId = req.params.vehicleId;

      let {
        page = 0,
        pageSize = 25,
        searcha = "",
        jobSearch = "",
        contractor,
        sort = null,
        sorta = null,
        sortField = "_id",
        sortOrder = "desc",
      } = req.query;

      const generateSort = () => {
        const sortParsed = JSON.parse(sort);
        const sortOptions = {
          [sortParsed.field]: sortParsed.sort === "asc" ? 1 : -1,
        };

        return sortOptions;
      };

      // Formatted sort should look like { field: 1 } or { field: -1 }
      const sortOptions = Boolean(sort) ? generateSort() : { orderDate: 1 };

      // Find the vehicle based on the company ID
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // Get the customer IDs associated with the vehicle
      const jobIds = vehicle.job_ids;

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds } } },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "customers",
            localField: "from",
            foreignField: "_id",
            as: "from",
          },
        },
        { $unwind: "$from" },
        {
          $lookup: {
            from: "contractors",
            let: { contractorId: "$contractorId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$contractorId"] } } },
              { $project: { companyName: 1 } },
            ],
            as: "contractorId",
          },
        },
        { $unwind: "$contractorId" },
        {
          $match: {
            $or: [
              // Add your alternative search conditions here
              {
                "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" },
              }, // Example: search in field1 using regex
              { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
              {
                "contractorId.companyName": {
                  $regex: `.*${jobSearch}.*`,
                  $options: "i",
                },
              },
              { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },
              { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },

              // Add more conditions as needed
            ],
          },
        },
        // { $sort: { orderDate: 1 } }, // Sort by orderDate in descending order

        { $sort: sortOptions },
      ];
      // Execute the aggregation pipeline
      const vehicleWithJobsReport = await Job.aggregate(pipeline);
      if (vehicleWithJobsReport.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No jobs in the system",
        });
      }

      // Get the total count of jobs
      const totalCount = await Job.countDocuments({
        _id: { $in: jobIds },
      });
      // Format the 'cost' field if needed
      const formattedJobs = vehicleWithJobsReport.map((job) => ({
        ...job,
        cost: parseFloat(job.cost.toString()), // Format the cost to 2 decimal places
      }));

      res.status(200).json({
        success: true,
        vehicleWithJobsReport: formattedJobs,
        totalCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
