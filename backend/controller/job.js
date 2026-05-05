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
const mongoose = require("mongoose");
const {
  asNumber,
  roundMoney,
  applyJobDelta,
  buildJobSnapshot,
} = require("./helpers/jobStatsSync");
const router = express.Router();

function addUniqueId(list, id) {
  const target = Array.isArray(list) ? list : [];
  const idStr = String(id);
  if (!target.some((item) => String(item) === idStr)) {
    target.push(id);
  }
  return target;
}

function removeId(list, id) {
  const idStr = String(id);
  return list.filter((item) => String(item) !== idStr);
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await work(session);
    });
  } catch (error) {
    const message = String(error?.message || "");
    const notSupported =
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("Transaction support");

    if (!notSupported) {
      throw error;
    }
    await work(null);
  } finally {
    await session.endSession();
  }
}

function getYearFilter(req) {
  const fallbackYear = new Date().getFullYear();
  const rawYear = req.query.year;

  if (rawYear === "all") {
    return { year: null, dateMatch: {} };
  }

  if (rawYear === undefined || rawYear === null || rawYear === "") {
    const start = new Date(fallbackYear, 0, 1);
    const end = new Date(fallbackYear + 1, 0, 1);
    return { year: fallbackYear, dateMatch: { orderDate: { $gte: start, $lt: end } } };
  }

  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ErrorHandler("Invalid year query parameter", 400);
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return { year, dateMatch: { orderDate: { $gte: start, $lt: end } } };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCsv(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapePdfText(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdfBuffer(lines) {
  const bodyLines = lines.length ? lines : ["No data"];
  const textOps = ["BT", "/F1 10 Tf", "40 800 Td"];
  bodyLines.forEach((line, index) => {
    if (index > 0) {
      textOps.push("T*");
    }
    textOps.push(`(${escapePdfText(line)}) Tj`);
  });
  textOps.push("ET");
  const stream = textOps.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

async function getScopedJobIds(req) {
  const { scope = "deliverer", entityId } = req.query;

  if (scope === "contractor" && entityId) {
    const contractor = await Contractor.findById(entityId);
    return contractor?.job_ids || [];
  }
  if (scope === "driver" && entityId) {
    const driver = await Driver.findById(entityId);
    return driver?.job_ids || [];
  }
  if (scope === "vehicle" && entityId) {
    const vehicle = await Vehicle.findById(entityId);
    return vehicle?.job_ids || [];
  }

  const deliverer = await Deliverer.findById(req.user.companyId);
  if (!deliverer) {
    throw new ErrorHandler("Deliverer not found", 404);
  }
  return deliverer.job_ids || [];
}

async function buildJobsForExport(req) {
  const { jobSearch = "", sort = null } = req.query;
  const searchValue = escapeRegex(jobSearch);
  const { dateMatch: yearMatch } = getYearFilter(req);
  const { startDate, endDate } = req.query;
  let dateMatch = yearMatch;
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date("2000-01-01T00:00:00.000Z");
    const end = endDate ? new Date(endDate) : new Date("2100-01-01T00:00:00.000Z");
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      dateMatch = { orderDate: { $gte: start, $lte: end } };
    }
  }
  const jobIds = await getScopedJobIds(req);

  let sortOptions = { orderDate: 1 };
  if (sort) {
    const parsed = JSON.parse(sort);
    sortOptions = { [parsed.field]: parsed.sort === "asc" ? 1 : -1 };
  }

  const pipeline = [
    { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
          { "customer.name": { $regex: `.*${searchValue}.*`, $options: "i" } },
          { "from.name": { $regex: `.*${searchValue}.*`, $options: "i" } },
          { "contractorId.companyName": { $regex: `.*${searchValue}.*`, $options: "i" } },
          { jobNumber: { $regex: `.*${searchValue}.*`, $options: "i" } },
          { deliveryType: { $regex: `.*${searchValue}.*`, $options: "i" } },
        ],
      },
    },
    { $sort: sortOptions },
  ];

  return Job.aggregate(pipeline);
}

function parsePaginationParams(query) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit ?? query.pageSize, 10);
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const limit = Number.isInteger(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 25;

  return { page, limit, skip: page * limit };
}

function buildSortOptions(sort, fallback = { orderDate: -1, _id: -1 }) {
  if (!sort) {
    return fallback;
  }

  try {
    const parsed = typeof sort === "string" ? JSON.parse(sort) : sort;
    if (!parsed?.field || !parsed?.sort) {
      return fallback;
    }

    const direction = parsed.sort === "asc" ? 1 : -1;
    return { [parsed.field]: direction, _id: direction };
  } catch (error) {
    return fallback;
  }
}

function buildJobSearchMatch(jobSearch = "") {
  return {
    $or: [
      { "customer.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
      { "from.name": { $regex: `.*${jobSearch}.*`, $options: "i" } },
      {
        "contractorId.companyName": {
          $regex: `.*${jobSearch}.*`,
          $options: "i",
        },
      },
      { deliveryType: { $regex: `.*${jobSearch}.*`, $options: "i" } },
      { jobNumber: { $regex: `.*${jobSearch}.*`, $options: "i" } },
    ],
  };
}

function buildBaseJobsPipeline(jobIds, dateMatch, jobSearch) {
  return [
    { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
    { $match: buildJobSearchMatch(jobSearch) },
  ];
}

function mapJobCost(rows) {
  return rows.map((job) => ({
    ...job,
    cost: parseFloat(job.cost?.toString() || "0"),
  }));
}

//creating the job
router.post(
  "/create-job",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const jobs = Array.isArray(req.body) ? req.body : [req.body];
      if (!jobs.length) {
        return next(new ErrorHandler("At least one job is required", 400));
      }

      const createdJobs = [];

      await runWithOptionalTransaction(async (session) => {
        const deliverer = await withSession(
          Deliverer.findById(req.user.companyId),
          session
        );
        if (!deliverer) {
          throw new ErrorHandler("Deliverer not found", 404);
        }

        const totalCustomers = (deliverer.customer_ids || []).length;
        const totalContractors = (deliverer.contractor_ids || []).length;

        for (const payload of jobs) {
          const contractor = await withSession(
            Contractor.findById(payload.contractorId),
            session
          );
          const vehicle = await withSession(
            Vehicle.findById(payload.vehicleId),
            session
          );
          const driver = await withSession(
            Driver.findById(payload.driverId),
            session
          );

          if (!contractor || !vehicle || !driver) {
            throw new ErrorHandler(
              "Invalid contractor, vehicle, or driver for job",
              400
            );
          }

          const newJob = new Job({
            ...payload,
            distance: asNumber(payload.distance),
            cost: roundMoney(payload.cost),
          });
          await newJob.save(session ? { session } : {});

          deliverer.job_ids = addUniqueId(deliverer.job_ids, newJob._id);
          driver.job_ids = addUniqueId(driver.job_ids, newJob._id);
          vehicle.job_ids = addUniqueId(vehicle.job_ids, newJob._id);
          contractor.job_ids = addUniqueId(contractor.job_ids, newJob._id);
          contractor.lastOrder = asNumber(contractor.lastOrder) + 1;

          await Promise.all([
            deliverer.save(session ? { session } : {}),
            driver.save(session ? { session } : {}),
            vehicle.save(session ? { session } : {}),
            contractor.save(session ? { session } : {}),
          ]);

          const snapshot = buildJobSnapshot({
            job: newJob,
            contractorName: contractor.companyName,
          });
          await applyJobDelta(snapshot, 1, {
            companyId: req.user.companyId,
            totalCustomers,
            totalContractors,
            session,
          });

          const contractorStats = await withSession(
            ContractorStats.findOne({
              contractorId: String(snapshot.contractorId),
              delivererId: String(req.user.companyId),
              year: snapshot.year,
            }),
            session
          );
          if (contractorStats) {
            contractorStats.job_ids = addUniqueId(contractorStats.job_ids, newJob._id);
            await contractorStats.save(session ? { session } : {});
          }

          createdJobs.push(newJob);
        }
      });

      res.status(201).json({
        success: true,
        message: "Jobs added successfully",
        jobs: createdJobs,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message || error, 400));
    }
  })
);

// update job info
router.put(
  "/update-job",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { jobId } = req.body;
      if (!jobId) {
        return next(new ErrorHandler("Job Id is required", 400));
      }

      let updatedJob;

      await runWithOptionalTransaction(async (session) => {
        const deliverer = await withSession(
          Deliverer.findById(req.user.companyId),
          session
        );
        if (!deliverer) {
          throw new ErrorHandler("Deliverer not found", 404);
        }
        const totalCustomers = (deliverer.customer_ids || []).length;
        const totalContractors = (deliverer.contractor_ids || []).length;

        const job = await withSession(Job.findById(jobId), session);
        if (!job) {
          throw new ErrorHandler("Job not found", 404);
        }

        const oldContractor = await withSession(
          Contractor.findById(job.contractorId),
          session
        );
        if (!oldContractor) {
          throw new ErrorHandler("Current contractor not found", 404);
        }
        const oldSnapshot = buildJobSnapshot({
          job,
          contractorName: oldContractor.companyName,
        });

        const nextValues = {
          jobNumber: req.body.jobNum ?? job.jobNumber,
          from: req.body.fromId ?? job.from,
          customer: req.body.pageCustomerId ?? job.customer,
          description: req.body.description ?? job.description,
          vehicleId: req.body.vehicleId ?? job.vehicleId,
          contractorId: req.body.contractorId ?? job.contractorId,
          driverId: req.body.driverId ?? job.driverId,
          mileageIn: req.body.mileageIn ?? job.mileageIn,
          mileageOut: req.body.mileageOut ?? job.mileageOut,
          deliveryType: req.body.deliveryType ?? job.deliveryType,
          cost: req.body.cost !== undefined ? roundMoney(req.body.cost) : job.cost,
          distance:
            req.body.distance !== undefined
              ? asNumber(req.body.distance)
              : asNumber(job.distance),
          orderDate: req.body.orderDate ?? job.orderDate,
        };

        const newContractor = await withSession(
          Contractor.findById(nextValues.contractorId),
          session
        );
        const newDriver = await withSession(
          Driver.findById(nextValues.driverId),
          session
        );
        const newVehicle = await withSession(
          Vehicle.findById(nextValues.vehicleId),
          session
        );
        if (!newContractor || !newDriver || !newVehicle) {
          throw new ErrorHandler(
            "Invalid contractor, vehicle, or driver for job update",
            400
          );
        }

        await applyJobDelta(oldSnapshot, -1, {
          companyId: req.user.companyId,
          totalCustomers,
          totalContractors,
          session,
        });

        Object.assign(job, nextValues);
        await job.save(session ? { session } : {});

        const newSnapshot = buildJobSnapshot({
          job,
          contractorName: newContractor.companyName,
        });
        await applyJobDelta(newSnapshot, 1, {
          companyId: req.user.companyId,
          totalCustomers,
          totalContractors,
          session,
        });

        const oldDriver = await withSession(
          Driver.findById(oldSnapshot.driverId),
          session
        );
        const oldVehicle = await withSession(
          Vehicle.findById(oldSnapshot.vehicleId),
          session
        );
        if (!oldDriver || !oldVehicle) {
          throw new ErrorHandler("Current driver or vehicle not found", 404);
        }

        oldDriver.job_ids = removeId(oldDriver.job_ids || [], job._id);
        oldVehicle.job_ids = removeId(oldVehicle.job_ids || [], job._id);
        oldContractor.job_ids = removeId(oldContractor.job_ids || [], job._id);
        await Promise.all([
          oldDriver.save(session ? { session } : {}),
          oldVehicle.save(session ? { session } : {}),
          oldContractor.save(session ? { session } : {}),
        ]);

        newDriver.job_ids = addUniqueId(newDriver.job_ids, job._id);
        newVehicle.job_ids = addUniqueId(newVehicle.job_ids, job._id);
        newContractor.job_ids = addUniqueId(newContractor.job_ids, job._id);
        await Promise.all([
          newDriver.save(session ? { session } : {}),
          newVehicle.save(session ? { session } : {}),
          newContractor.save(session ? { session } : {}),
        ]);

        const oldContractorStats = await withSession(
          ContractorStats.findOne({
            contractorId: String(oldSnapshot.contractorId),
            delivererId: String(req.user.companyId),
            year: oldSnapshot.year,
          }),
          session
        );
        if (oldContractorStats) {
          oldContractorStats.job_ids = removeId(
            oldContractorStats.job_ids || [],
            job._id
          );
          await oldContractorStats.save(session ? { session } : {});
        }

        const newContractorStats = await withSession(
          ContractorStats.findOne({
            contractorId: String(newSnapshot.contractorId),
            delivererId: String(req.user.companyId),
            year: newSnapshot.year,
          }),
          session
        );
        if (newContractorStats) {
          newContractorStats.job_ids = addUniqueId(
            newContractorStats.job_ids,
            job._id
          );
          await newContractorStats.save(session ? { session } : {});
        }

        updatedJob = job;
      });

      res.status(201).json({
        success: true,
        job: updatedJob,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message || error, 500));
    }
  })
);

//deleting the job
router.delete(
  "/delete-job/:jobId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { jobId } = req.params;

      await runWithOptionalTransaction(async (session) => {
        const deliverer = await withSession(
          Deliverer.findById(req.user.companyId),
          session
        );
        if (!deliverer) {
          throw new ErrorHandler("Deliverer not found", 404);
        }

        const job = await withSession(Job.findById(jobId), session);
        if (!job) {
          throw new ErrorHandler("There is no job with this id", 404);
        }

        const contractor = await withSession(
          Contractor.findById(job.contractorId),
          session
        );
        const driver = await withSession(Driver.findById(job.driverId), session);
        const vehicle = await withSession(
          Vehicle.findById(job.vehicleId),
          session
        );
        if (!contractor || !driver || !vehicle) {
          throw new ErrorHandler("Related job entities not found", 404);
        }

        const totalCustomers = (deliverer.customer_ids || []).length;
        const totalContractors = (deliverer.contractor_ids || []).length;

        const snapshot = buildJobSnapshot({
          job,
          contractorName: contractor.companyName,
        });
        await applyJobDelta(snapshot, -1, {
          companyId: req.user.companyId,
          totalCustomers,
          totalContractors,
          session,
        });

        deliverer.job_ids = removeId(deliverer.job_ids || [], job._id);
        driver.job_ids = removeId(driver.job_ids || [], job._id);
        vehicle.job_ids = removeId(vehicle.job_ids || [], job._id);
        contractor.job_ids = removeId(contractor.job_ids || [], job._id);
        await Promise.all([
          deliverer.save(session ? { session } : {}),
          driver.save(session ? { session } : {}),
          vehicle.save(session ? { session } : {}),
          contractor.save(session ? { session } : {}),
        ]);

        const contractorStats = await withSession(
          ContractorStats.findOne({
            contractorId: String(snapshot.contractorId),
            delivererId: String(req.user.companyId),
            year: snapshot.year,
          }),
          session
        );
        if (contractorStats) {
          contractorStats.job_ids = removeId(contractorStats.job_ids || [], job._id);
          await contractorStats.save(session ? { session } : {});
        }

        await Job.deleteOne({ _id: job._id }, session ? { session } : {});
      });

      res.status(201).json({
        success: true,
        message: "Job Deleted!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message || error, 400));
    }
  })
);

router.get(
  "/get-all-jobs-page",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { jobSearch = "", sort = null } = req.query;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const sortOptions = buildSortOptions(sort, { orderDate: -1, _id: -1 });

      // Get the deliverer (company) based on the user
      const deliverer = await Deliverer.findById(req.user.companyId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: "Deliverer not found",
        });
      }

      const jobIds = deliverer.job_ids;
      const { year: requestedYear, dateMatch } = getYearFilter(req);

      const pipeline = [
        ...buildBaseJobsPipeline(jobIds, dateMatch, jobSearch),
        { $sort: sortOptions },
        {
          $facet: {
            pageJobs: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
          },
        },
      ];

      // Execute the aggregation pipeline
      const result = await Job.aggregate(pipeline);

      const { pageJobs = [], totalCount = [] } = result[0] || {};
      const formattedJobs = mapJobCost(pageJobs);
      const total = totalCount.length ? totalCount[0].total : 0;

      res.status(200).json({
        success: true,
        pageJobs: formattedJobs,
        rows: formattedJobs,
        totalCount: total,
        page,
        limit,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/export-jobs-csv",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const rows = await buildJobsForExport(req);
      const entityName = req.query.entityName || "All Jobs";
      const entityType = req.query.entityType || "Deliverer";
      const { year } = getYearFilter(req);
      const { startDate, endDate } = req.query;

      const periodLabel =
        startDate && endDate
          ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
          : `Year: ${year}`;

      const totalJobs = rows.length;
      const totalDistance = rows.reduce((sum, job) => sum + asNumber(job.distance), 0);
      const totalCost = rows.reduce((sum, job) => sum + asNumber(job.cost), 0);

      const metaLines = [
        `"${entityType}: ${entityName}"`,
        `"Period: ${periodLabel}"`,
        `"Total Jobs: ${totalJobs}","Total Distance: ${totalDistance.toFixed(2)} km","Total Cost: $${totalCost.toFixed(2)}"`,
        `""`,
      ];

      const headers = [
        "Job Number",
        "Delivery Type",
        "Contractor",
        "From",
        "Customer",
        "Mileage Out",
        "Mileage In",
        "Distance (km)",
        "Cost ($)",
        "Order Date",
      ];
      const lines = [...metaLines, headers.map(escapeCsv).join(",")];
      rows.forEach((job) => {
        lines.push(
          [
            job.jobNumber,
            job.deliveryType,
            job.contractorId?.companyName,
            job.from?.name,
            job.customer?.name,
            job.mileageOut ?? "",
            job.mileageIn ?? "",
            asNumber(job.distance).toFixed(2),
            asNumber(job.cost).toFixed(2),
            new Date(job.orderDate).toISOString().split("T")[0],
          ]
            .map(escapeCsv)
            .join(",")
        );
      });
      const sanitizePart = (s) => String(s || "").trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const scope = req.query.scope || "deliverer";
      const vehicleMake = req.query.vehicleMake;
      const today = new Date().toISOString().split("T")[0];
      const csvFilename = scope === "vehicle" && vehicleMake
        ? `${sanitizePart(vehicleMake)}-${sanitizePart(entityName)}-${today}-jobs.csv`
        : `${sanitizePart(entityName)}-${today}-jobs.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${csvFilename}"`);
      return res.status(200).send(lines.join("\n"));
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

router.get(
  "/export-jobs-pdf",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const rows = await buildJobsForExport(req);
      const entityName = req.query.entityName || "All Jobs";
      const entityType = req.query.entityType || "Deliverer";
      const { year } = getYearFilter(req);
      const { startDate, endDate } = req.query;

      const periodLabel =
        startDate && endDate
          ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
          : `Year: ${year}`;

      const totalJobs = rows.length;
      const totalDistance = rows.reduce((sum, job) => sum + asNumber(job.distance), 0);
      const totalCost = rows.reduce((sum, job) => sum + asNumber(job.cost), 0);

      const lines = [
        `${entityType}: ${entityName}`,
        `Period: ${periodLabel}`,
        `Total Jobs: ${totalJobs} | Total Distance: ${totalDistance.toFixed(2)} km | Total Cost: $${totalCost.toFixed(2)}`,
        `---`,
        `Job Number | Delivery Type | Contractor | Customer | Mileage Out | Mileage In | Distance | Cost | Date`,
      ];
      rows.forEach((job) => {
        lines.push(
          `${job.jobNumber || ""} | ${job.deliveryType || ""} | ${
            job.contractorId?.companyName || ""
          } | ${job.customer?.name || ""} | ${job.mileageOut ?? ""} | ${job.mileageIn ?? ""} | ${asNumber(job.distance).toFixed(2)} | ${asNumber(job.cost).toFixed(2)} | ${
            new Date(job.orderDate).toISOString().split("T")[0]
          }`
        );
      });
      const sanitizePart = (s) => String(s || "").trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const scope = req.query.scope || "deliverer";
      const vehicleMake = req.query.vehicleMake;
      const today = new Date().toISOString().split("T")[0];
      const pdfFilename = scope === "vehicle" && vehicleMake
        ? `${sanitizePart(vehicleMake)}-${sanitizePart(entityName)}-${today}-jobs.pdf`
        : `${sanitizePart(entityName)}-${today}-jobs.pdf`;
      const pdfBuffer = buildSimplePdfBuffer(lines);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pdfFilename}"`);
      return res.status(200).send(pdfBuffer);
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
      const { year: requestedYear, dateMatch: requestedDateMatch } = getYearFilter(req);
      let effectiveYear = requestedYear;
      let dateMatch = requestedDateMatch;

      // If requested year has no jobs, fall back to the latest available job year for this company.
      const requestedYearCount = await Job.countDocuments({
        _id: { $in: jobIds },
        ...requestedDateMatch,
      });
      if (requestedYearCount === 0 && jobIds.length > 0) {
        const latestYearResult = await Job.aggregate([
          { $match: { _id: { $in: jobIds } } },
          { $project: { year: { $year: "$orderDate" } } },
          { $group: { _id: null, maxYear: { $max: "$year" } } },
        ]);
        if (latestYearResult.length > 0 && Number.isInteger(latestYearResult[0].maxYear)) {
          effectiveYear = latestYearResult[0].maxYear;
          const start = new Date(effectiveYear, 0, 1);
          const end = new Date(effectiveYear + 1, 0, 1);
          dateMatch = { orderDate: { $gte: start, $lt: end } };
        }
      }

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
        ...dateMatch,
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

      if (!getContractorStats || getContractorStats.length === 0) {
        return res.status(200).json({
          success: true,
          latestContractorJobs: [],
          totalCount: 0,
          message: "No stats found for this contractor",
        });
      }

      let { dateMatch } = getYearFilter(req);
      const requestedJobIds = getContractorStats[0]?.job_ids || [];

      const requestedCount = await Job.countDocuments({
        _id: { $in: requestedJobIds },
        ...dateMatch,
      });

      let jobIds = requestedJobIds;
      if (requestedCount === 0) {
        const allIds = getContractorStats.flatMap((s) => s.job_ids || []);
        if (allIds.length > 0) {
          const latestYearResult = await Job.aggregate([
            { $match: { _id: { $in: allIds } } },
            { $project: { year: { $year: "$orderDate" } } },
            { $group: { _id: null, maxYear: { $max: "$year" } } },
          ]);
          if (latestYearResult.length > 0) {
            const fallbackYear = latestYearResult[0].maxYear;
            const start = new Date(fallbackYear, 0, 1);
            const end = new Date(fallbackYear + 1, 0, 1);
            dateMatch = { orderDate: { $gte: start, $lt: end } };
            jobIds = allIds;
          }
        }
      }

      if (jobIds.length === 0) {
        return res.status(200).json({
          success: true,
          latestContractorJobs: [],
          totalCount: 0,
        });
      }
      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
        ...dateMatch,
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
      const { dateMatch } = getYearFilter(req);

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
        ...dateMatch,
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
      const { dateMatch } = getYearFilter(req);

      // Update the pipeline with the revised $match stage
      const pipeline = [
        { $match: { _id: { $in: jobIds }, ...dateMatch } },
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
        ...dateMatch,
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
      const { jobSearch = "", sort = null } = req.query;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const sortOptions = buildSortOptions(sort, { orderDate: 1, _id: 1 });

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
      let { dateMatch } = getYearFilter(req);
      const { startDate, endDate } = req.query;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(req.query.year || new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date((parseInt(req.query.year || new Date().getFullYear())) + 1, 0, 1);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dateMatch = { orderDate: { $gte: start, $lte: end } };
        }
      }

      const pipeline = [
        ...buildBaseJobsPipeline(jobIds, dateMatch, jobSearch),
        { $sort: sortOptions },
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
            periodTotals: [
              { $group: { _id: null, totalDistance: { $sum: "$distance" }, totalCost: { $sum: { $toDouble: "$cost" } }, totalJobs: { $sum: 1 } } },
            ],
          },
        },
      ];
      const [{ rows = [], totalCount = [], periodTotals = [] } = {}] = await Job.aggregate(pipeline);
      const formattedJobs = mapJobCost(rows);
      const total = totalCount.length ? totalCount[0].total : 0;
      const periodTotalsResult = periodTotals[0] || { totalDistance: 0, totalCost: 0, totalJobs: 0 };
      res.status(200).json({
        success: true,
        delivererWithJobsReport: formattedJobs,
        rows: formattedJobs,
        totalCount: total,
        periodTotals: periodTotalsResult,
        page,
        limit,
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
      const { jobSearch = "", sort = null } = req.query;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const sortOptions = buildSortOptions(sort, { orderDate: 1, _id: 1 });

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
      let { dateMatch } = getYearFilter(req);
      const { startDate, endDate } = req.query;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(req.query.year || new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date((parseInt(req.query.year || new Date().getFullYear())) + 1, 0, 1);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dateMatch = { orderDate: { $gte: start, $lte: end } };
        }
      }

      const pipeline = [
        ...buildBaseJobsPipeline(jobIds, dateMatch, jobSearch),
        { $sort: sortOptions },
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
            periodTotals: [
              { $group: { _id: null, totalDistance: { $sum: "$distance" }, totalCost: { $sum: { $toDouble: "$cost" } }, totalJobs: { $sum: 1 } } },
            ],
          },
        },
      ];
      const [{ rows = [], totalCount = [], periodTotals = [] } = {}] = await Job.aggregate(pipeline);
      const formattedJobs = mapJobCost(rows);
      const total = totalCount.length ? totalCount[0].total : 0;
      const periodTotalsResult = periodTotals[0] || { totalDistance: 0, totalCost: 0, totalJobs: 0 };
      res.status(200).json({
        success: true,
        contractorWithJobsReport: formattedJobs,
        rows: formattedJobs,
        totalCount: total,
        periodTotals: periodTotalsResult,
        page,
        limit,
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
      const { jobSearch = "", sort = null } = req.query;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const sortOptions = buildSortOptions(sort, { orderDate: 1, _id: 1 });

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
      let { dateMatch } = getYearFilter(req);
      const { startDate, endDate } = req.query;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(req.query.year || new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date((parseInt(req.query.year || new Date().getFullYear())) + 1, 0, 1);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dateMatch = { orderDate: { $gte: start, $lte: end } };
        }
      }

      const pipeline = [
        ...buildBaseJobsPipeline(jobIds, dateMatch, jobSearch),
        { $sort: sortOptions },
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
            periodTotals: [
              { $group: { _id: null, totalDistance: { $sum: "$distance" }, totalCost: { $sum: { $toDouble: "$cost" } }, totalJobs: { $sum: 1 } } },
            ],
          },
        },
      ];
      const [{ rows = [], totalCount = [], periodTotals = [] } = {}] = await Job.aggregate(pipeline);
      const formattedJobs = mapJobCost(rows);
      const total = totalCount.length ? totalCount[0].total : 0;
      const periodTotalsResult = periodTotals[0] || { totalDistance: 0, totalCost: 0, totalJobs: 0 };

      res.status(200).json({
        success: true,
        driverWithJobsReport: formattedJobs,
        rows: formattedJobs,
        totalCount: total,
        periodTotals: periodTotalsResult,
        page,
        limit,
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

      const { jobSearch = "", sort = null } = req.query;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const sortOptions = buildSortOptions(sort, { orderDate: 1, _id: 1 });

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
      let { dateMatch } = getYearFilter(req);
      const { startDate, endDate } = req.query;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(req.query.year || new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date((parseInt(req.query.year || new Date().getFullYear())) + 1, 0, 1);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dateMatch = { orderDate: { $gte: start, $lte: end } };
        }
      }

      const pipeline = [
        ...buildBaseJobsPipeline(jobIds, dateMatch, jobSearch),
        { $sort: sortOptions },
        {
          $facet: {
            rows: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "total" }],
            periodTotals: [
              { $group: { _id: null, totalDistance: { $sum: "$distance" }, totalCost: { $sum: { $toDouble: "$cost" } }, totalJobs: { $sum: 1 } } },
            ],
          },
        },
      ];
      const [{ rows = [], totalCount = [], periodTotals = [] } = {}] = await Job.aggregate(pipeline);
      const formattedJobs = mapJobCost(rows);
      const total = totalCount.length ? totalCount[0].total : 0;
      const periodTotalsResult = periodTotals[0] || { totalDistance: 0, totalCost: 0, totalJobs: 0 };

      res.status(200).json({
        success: true,
        vehicleWithJobsReport: formattedJobs,
        rows: formattedJobs,
        totalCount: total,
        periodTotals: periodTotalsResult,
        page,
        limit,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
