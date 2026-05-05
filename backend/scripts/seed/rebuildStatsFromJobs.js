const { StatsRebuildError } = require("./errors");
const { logger, timedStep } = require("./logger");

const monthOrder = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const sortMonthly = (rows) =>
  rows.sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));

const sortDaily = (rows) => rows.sort((a, b) => a.date.localeCompare(b.date));

async function buildOverallStats(db) {
  const jobs = db.collection("jobs");
  const deliverers = await db
    .collection("deliverers")
    .find({}, { projection: { _id: 1, job_ids: 1 } })
    .toArray();

  const totalCustomers = await db.collection("customers").countDocuments();
  const totalContractors = await db.collection("contractors").countDocuments();

  const docs = [];

  for (const deliverer of deliverers) {
    const jobIds = deliverer.job_ids || [];
    if (jobIds.length === 0) continue;

    const [yearlyBase, monthly, daily] = await Promise.all([
      jobs
        .aggregate([
          { $match: { _id: { $in: jobIds }, orderDate: { $ne: null, $exists: true } } },
          {
            $lookup: {
              from: "contractors",
              localField: "contractorId",
              foreignField: "_id",
              as: "contractor",
            },
          },
          { $unwind: { path: "$contractor", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { year: { $year: "$orderDate" } },
              yearlyJobs: { $sum: 1 },
              yearlyMileage: { $sum: { $ifNull: ["$distance", 0] } },
              yearlyRevenue: { $sum: { $toDouble: "$cost" } },
              jobsByContractorPairs: {
                $push: {
                  contractor: { $ifNull: ["$contractor.companyName", "Unknown"] },
                },
              },
              revByContractorPairs: {
                $push: {
                  contractor: { $ifNull: ["$contractor.companyName", "Unknown"] },
                  value: { $toDouble: "$cost" },
                },
              },
            },
          },
          { $sort: { "_id.year": 1 } },
        ])
        .toArray(),

      jobs
        .aggregate([
          { $match: { _id: { $in: jobIds }, orderDate: { $ne: null, $exists: true } } },
          {
            $group: {
              _id: { year: { $year: "$orderDate" }, month: { $month: "$orderDate" } },
              totalJobs: { $sum: 1 },
              totalMileage: { $sum: { $ifNull: ["$distance", 0] } },
              totalRevenue: { $sum: { $toDouble: "$cost" } },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ])
        .toArray(),

      jobs
        .aggregate([
          { $match: { _id: { $in: jobIds }, orderDate: { $ne: null, $exists: true } } },
          {
            $group: {
              _id: {
                year: { $year: "$orderDate" },
                date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
              },
              totalJobs: { $sum: 1 },
              totalMileage: { $sum: { $ifNull: ["$distance", 0] } },
              totalRevenue: { $sum: { $toDouble: "$cost" } },
            },
          },
          { $sort: { "_id.year": 1, "_id.date": 1 } },
        ])
        .toArray(),
    ]);

    const byYear = new Map();

    for (const base of yearlyBase) {
      const year = base._id.year;
      if (!year) continue;

      const jobsByContractor = {};
      const revenueByContractor = {};
      for (const pair of base.jobsByContractorPairs || []) {
        jobsByContractor[pair.contractor] = (jobsByContractor[pair.contractor] || 0) + 1;
      }
      for (const pair of base.revByContractorPairs || []) {
        revenueByContractor[pair.contractor] =
          (revenueByContractor[pair.contractor] || 0) + pair.value;
      }

      byYear.set(year, {
        year,
        yearlyJobs: base.yearlyJobs,
        yearlyMileage: base.yearlyMileage,
        yearlyRevenue: Number(base.yearlyRevenue.toFixed(2)),
        yearlyExpenses: 0,
        yearlyProfit: Number(base.yearlyRevenue.toFixed(2)),
        monthlyData: [],
        dailyData: [],
        totalCustomers,
        totalContractors,
        jobsByContractor,
        revenueByContractor: Object.fromEntries(
          Object.entries(revenueByContractor).map(([k, v]) => [k, Number(v.toFixed(2))])
        ),
        companyId: deliverer._id,
      });
    }

    for (const row of monthly) {
      if (!row._id.year) continue;
      const target = byYear.get(row._id.year);
      if (!target) continue;
      target.monthlyData.push({
        month: monthOrder[row._id.month - 1],
        totalJobs: row.totalJobs,
        totalMileage: row.totalMileage,
        totalRevenue: Number(row.totalRevenue.toFixed(2)),
        totalExpenses: 0,
        totalProfit: Number(row.totalRevenue.toFixed(2)),
      });
    }

    for (const row of daily) {
      if (!row._id.year) continue;
      const target = byYear.get(row._id.year);
      if (!target) continue;
      target.dailyData.push({
        date: row._id.date,
        totalJobs: row.totalJobs,
        totalMileage: row.totalMileage,
        totalRevenue: Number(row.totalRevenue.toFixed(2)),
      });
    }

    for (const data of byYear.values()) {
      docs.push({
        ...data,
        monthlyData: sortMonthly([...data.monthlyData]),
        dailyData: sortDaily([...data.dailyData]),
      });
    }

    logger.info("Built overallstats for deliverer", {
      delivererId: deliverer._id,
      years: Array.from(byYear.keys()),
      totalDocs: byYear.size,
    });
  }

  return docs;
}

async function buildEntityStats(db, entityCollection, statsCollection, entityField) {
  const jobs = db.collection("jobs");
  const pipeline = [
    {
      $match: {
        [entityField]: { $exists: true, $ne: null },
        orderDate: { $exists: true, $ne: null },
      },
    },
    {
      $lookup: {
        from: "contractors",
        localField: "contractorId",
        foreignField: "_id",
        as: "contractor",
      },
    },
    { $unwind: { path: "$contractor", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          entityId: { $toString: `$${entityField}` },
          year: { $year: "$orderDate" },
        },
        yearlyJobs: { $sum: 1 },
        yearlyMileage: { $sum: { $ifNull: ["$distance", 0] } },
        yearlyRevenue: { $sum: { $toDouble: "$cost" } },
        jobsByContractorPairs: {
          $push: {
            contractor: { $ifNull: ["$contractor.companyName", "Unknown"] },
          },
        },
        revByContractorPairs: {
          $push: {
            contractor: { $ifNull: ["$contractor.companyName", "Unknown"] },
            value: { $toDouble: "$cost" },
          },
        },
      },
    },
    { $sort: { "_id.entityId": 1, "_id.year": 1 } },
  ];

  const monthlyPipeline = [
    {
      $match: {
        [entityField]: { $exists: true, $ne: null },
        orderDate: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: {
          entityId: { $toString: `$${entityField}` },
          year: { $year: "$orderDate" },
          month: { $month: "$orderDate" },
        },
        totalJobs: { $sum: 1 },
        totalMileage: { $sum: { $ifNull: ["$distance", 0] } },
        totalRevenue: { $sum: { $toDouble: "$cost" } },
      },
    },
  ];

  const dailyPipeline = [
    {
      $match: {
        [entityField]: { $exists: true, $ne: null },
        orderDate: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: {
          entityId: { $toString: `$${entityField}` },
          year: { $year: "$orderDate" },
          date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
        },
        totalJobs: { $sum: 1 },
        totalMileage: { $sum: { $ifNull: ["$distance", 0] } },
        totalRevenue: { $sum: { $toDouble: "$cost" } },
      },
    },
  ];

  const [yearly, monthly, daily] = await Promise.all([
    jobs.aggregate(pipeline).toArray(),
    jobs.aggregate(monthlyPipeline).toArray(),
    jobs.aggregate(dailyPipeline).toArray(),
  ]);

  const keyed = new Map();
  for (const row of yearly) {
    if (!row._id.year) continue;
    const key = `${row._id.entityId}:${row._id.year}`;
    const jobsByContractor = {};
    const revenueByContractor = {};
    for (const pair of row.jobsByContractorPairs || []) {
      jobsByContractor[pair.contractor] = (jobsByContractor[pair.contractor] || 0) + 1;
    }
    for (const pair of row.revByContractorPairs || []) {
      revenueByContractor[pair.contractor] =
        (revenueByContractor[pair.contractor] || 0) + pair.value;
    }
    keyed.set(key, {
      [statsCollection === "contractorstats" ? "contractorId" : statsCollection === "vehiclestats" ? "vehicleId" : "driverstats" === statsCollection ? "driverId" : "entityId"]:
        row._id.entityId,
      year: row._id.year,
      yearlyJobs: row.yearlyJobs,
      yearlyMileage: row.yearlyMileage,
      yearlyRevenue: Number(row.yearlyRevenue.toFixed(2)),
      yearlyExpenses: 0,
      yearlyProfit: Number(row.yearlyRevenue.toFixed(2)),
      monthlyData: [],
      dailyData: [],
      jobsByContractor,
      revenueByContractor: Object.fromEntries(
        Object.entries(revenueByContractor).map(([k, v]) => [k, Number(v.toFixed(2))])
      ),
    });
  }

  for (const row of monthly) {
    if (!row._id.year) continue;
    const key = `${row._id.entityId}:${row._id.year}`;
    const doc = keyed.get(key);
    if (!doc) continue;
    doc.monthlyData.push({
      month: monthOrder[row._id.month - 1],
      totalJobs: row.totalJobs,
      totalMileage: row.totalMileage,
      totalRevenue: Number(row.totalRevenue.toFixed(2)),
      totalExpenses: 0,
      totalProfit: Number(row.totalRevenue.toFixed(2)),
    });
  }

  for (const row of daily) {
    if (!row._id.year) continue;
    const key = `${row._id.entityId}:${row._id.year}`;
    const doc = keyed.get(key);
    if (!doc) continue;
    doc.dailyData.push({
      date: row._id.date,
      totalJobs: row.totalJobs,
      totalMileage: row.totalMileage,
      totalRevenue: Number(row.totalRevenue.toFixed(2)),
    });
  }

  const docs = [];
  for (const value of keyed.values()) {
    docs.push({
      ...value,
      monthlyData: sortMonthly(value.monthlyData),
      dailyData: sortDaily(value.dailyData),
      ...(statsCollection === "contractorstats" ? { delivererId: "" } : {}),
    });
  }

  if (statsCollection === "contractorstats") {
    const contractors = await db.collection(entityCollection).find({}, { projection: { _id: 1 } }).toArray();
    const deliverers = await db.collection("deliverers").find({}, { projection: { _id: 1 } }).toArray();
    const delivererId = deliverers[0]?._id?.toString() || "";
    const contractorSet = new Set(contractors.map((c) => c._id.toString()));
    for (const doc of docs) {
      if (!contractorSet.has(doc.contractorId)) continue;
      doc.delivererId = delivererId;
    }
  }

  return docs;
}

async function rebuildStatsFromJobs(db, derivedCollections) {
  try {
    await timedStep("drop:derivedCollections", async () => {
      for (const collectionName of derivedCollections) {
        const exists = await db.listCollections({ name: collectionName }).toArray();
        if (exists.length) await db.dropCollection(collectionName);
      }
    });

    const [overall, vehicle, driver, contractor] = await Promise.all([
      timedStep("aggregate:overallstats", () => buildOverallStats(db)),
      timedStep("aggregate:vehiclestats", () =>
        buildEntityStats(db, "vehicles", "vehiclestats", "vehicleId")
      ),
      timedStep("aggregate:driverstats", () =>
        buildEntityStats(db, "drivers", "driverstats", "driverId")
      ),
      timedStep("aggregate:contractorstats", () =>
        buildEntityStats(db, "contractors", "contractorstats", "contractorId")
      ),
    ]);

    const results = [];
    const inserts = [
      ["overallstats", overall],
      ["vehiclestats", vehicle],
      ["driverstats", driver],
      ["contractorstats", contractor],
    ];

    for (const [collectionName, docs] of inserts) {
      if (docs.length) await db.collection(collectionName).insertMany(docs, { ordered: false });
      else await db.createCollection(collectionName);
      const count = await db.collection(collectionName).countDocuments();
      results.push({ collection: collectionName, inserted: docs.length, count });
      logger.info("Derived collection rebuilt", {
        collection: collectionName,
        inserted: docs.length,
        count,
      });
    }

    return results;
  } catch (error) {
    throw new StatsRebuildError("Failed to rebuild stats from jobs", {
      cause: error.message,
    });
  }
}

module.exports = {
  rebuildStatsFromJobs,
};
