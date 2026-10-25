const OverallStats = require("../../model/overallStats");
const DriverStats = require("../../model/driverStats");
const VehicleStats = require("../../model/vehicleStats");
const ContractorStats = require("../../model/contractorStats");

function asNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && typeof value.toString === "function") {
    const parsed = parseFloat(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundMoney(value) {
  return Number(asNumber(value).toFixed(2));
}

function dateParts(dateInput) {
  const date = new Date(dateInput);
  const year = date.getUTCFullYear();
  const monthNumber = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const formattedDate = `${year}-${monthNumber}-${day}`;
  return { year, month, formattedDate };
}

function upsertBucket(list, matchKey, matchValue, factory) {
  let bucket = list.find((item) => item[matchKey] === matchValue);
  if (!bucket) {
    list.push(factory());
    bucket = list[list.length - 1];
  }
  return bucket;
}

function cleanupAggregateDoc(doc, hasProfitFields) {
  doc.monthlyData = (doc.monthlyData || []).filter((item) => {
    const jobs = asNumber(item.totalJobs);
    const revenue = asNumber(item.totalRevenue);
    const mileage = asNumber(item.totalMileage);
    return jobs > 0 || revenue !== 0 || mileage !== 0;
  });

  doc.dailyData = (doc.dailyData || []).filter((item) => {
    const jobs = asNumber(item.totalJobs);
    const revenue = asNumber(item.totalRevenue);
    const mileage = asNumber(item.totalMileage);
    return jobs > 0 || revenue !== 0 || mileage !== 0;
  });

  if (doc.jobsByContractor && typeof doc.jobsByContractor.forEach === "function") {
    const keysToDelete = [];
    doc.jobsByContractor.forEach((value, key) => {
      if (asNumber(value) <= 0) keysToDelete.push(key);
    });
    keysToDelete.forEach((key) => doc.jobsByContractor.delete(key));
  }

  if (
    doc.revenueByContractor &&
    typeof doc.revenueByContractor.forEach === "function"
  ) {
    const keysToDelete = [];
    doc.revenueByContractor.forEach((value, key) => {
      if (roundMoney(value) === 0) keysToDelete.push(key);
    });
    keysToDelete.forEach((key) => doc.revenueByContractor.delete(key));
  }

  doc.monthlyData.sort((a, b) => {
    const aMonth = new Date(Date.parse(`01 ${a.month} 2000`));
    const bMonth = new Date(Date.parse(`01 ${b.month} 2000`));
    return aMonth - bMonth;
  });
  doc.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (hasProfitFields) {
    doc.monthlyData.forEach((item) => {
      item.totalProfit = roundMoney(item.totalProfit);
      item.totalExpenses = roundMoney(item.totalExpenses);
    });
  }
}

function readMapValue(mapLike, key) {
  if (!mapLike) return 0;
  if (typeof mapLike.get === "function") return asNumber(mapLike.get(key));
  return asNumber(mapLike[key]);
}

function writeMapValue(mapLike, key, value) {
  if (!mapLike) return;
  if (typeof mapLike.set === "function") {
    mapLike.set(key, value);
    return;
  }
  mapLike[key] = value;
}

function mutateAggregateDoc(doc, snapshot, multiplier, options) {
  const { includeProfit, includeContractorMaps } = options;
  const jobsDelta = multiplier;
  const distanceDelta = asNumber(snapshot.distance) * multiplier;
  const costDelta = roundMoney(asNumber(snapshot.cost) * multiplier);

  doc.yearlyJobs = asNumber(doc.yearlyJobs) + jobsDelta;
  doc.yearlyMileage = asNumber(doc.yearlyMileage) + distanceDelta;
  doc.yearlyRevenue = roundMoney(asNumber(doc.yearlyRevenue) + costDelta);

  if (includeProfit) {
    doc.yearlyProfit = roundMoney(asNumber(doc.yearlyProfit) + costDelta);
    doc.yearlyExpenses = roundMoney(asNumber(doc.yearlyExpenses));
  }

  const monthly = upsertBucket(doc.monthlyData, "month", snapshot.month, () => ({
    month: snapshot.month,
    totalMileage: 0,
    totalRevenue: 0,
    totalProfit: includeProfit ? 0 : undefined,
    totalExpenses: includeProfit ? 0 : undefined,
    totalJobs: 0,
  }));

  monthly.totalJobs = asNumber(monthly.totalJobs) + jobsDelta;
  monthly.totalMileage = asNumber(monthly.totalMileage) + distanceDelta;
  monthly.totalRevenue = roundMoney(asNumber(monthly.totalRevenue) + costDelta);
  if (includeProfit) {
    monthly.totalProfit = roundMoney(asNumber(monthly.totalProfit) + costDelta);
    monthly.totalExpenses = roundMoney(asNumber(monthly.totalExpenses));
  }

  const daily = upsertBucket(doc.dailyData, "date", snapshot.formattedDate, () => ({
    date: snapshot.formattedDate,
    totalMileage: 0,
    totalRevenue: 0,
    totalJobs: 0,
    totalExpenses: includeProfit ? 0 : undefined,
  }));

  daily.totalJobs = asNumber(daily.totalJobs) + jobsDelta;
  daily.totalMileage = asNumber(daily.totalMileage) + distanceDelta;
  daily.totalRevenue = roundMoney(asNumber(daily.totalRevenue) + costDelta);

  if (includeContractorMaps && snapshot.contractorName) {
    const jobsMap = doc.jobsByContractor || {};
    const revMap = doc.revenueByContractor || {};
    const currentJobs = readMapValue(jobsMap, snapshot.contractorName);
    const currentRevenue = readMapValue(revMap, snapshot.contractorName);
    writeMapValue(jobsMap, snapshot.contractorName, currentJobs + jobsDelta);
    writeMapValue(
      revMap,
      snapshot.contractorName,
      roundMoney(currentRevenue + costDelta)
    );
    doc.jobsByContractor = jobsMap;
    doc.revenueByContractor = revMap;
  }
}

async function ensureStatsDoc(Model, filter, defaults, session) {
  // ContractorStats.job_ids can be huge and is never changed through this
  // path (bulkCreateJobs/job.js update it with $addToSet), so don't load it.
  const query = Model.findOne(filter).session(session);
  if (Model === ContractorStats) query.select("-job_ids");
  let doc = await query;
  if (!doc) {
    doc = new Model({
      ...filter,
      yearlyJobs: 0,
      yearlyMileage: 0,
      yearlyRevenue: 0,
      yearlyProfit: 0,
      yearlyExpenses: 0,
      monthlyData: [],
      dailyData: [],
      ...defaults,
    });
  }
  return doc;
}

async function applyJobDelta(snapshot, multiplier, context) {
  return applyJobDeltas([snapshot], multiplier, context);
}

// Applies many job snapshots while loading and saving each affected stats
// document exactly once, instead of 4 reads + 4 writes per job.
async function applyJobDeltas(snapshots, multiplier, context) {
  const { companyId, totalCustomers, totalContractors, session } = context;
  const docs = new Map();

  const load = (Model, filter, defaults) => {
    const key = `${Model.modelName}:${JSON.stringify(filter)}`;
    if (!docs.has(key)) {
      docs.set(key, ensureStatsDoc(Model, filter, defaults, session));
    }
    return docs.get(key);
  };

  for (const snapshot of snapshots) {
    const [overall, driver, vehicle, contractor] = await Promise.all([
      load(
        OverallStats,
        { companyId, year: snapshot.year },
        {
          totalCustomers,
          totalContractors,
          jobsByContractor: new Map(),
          revenueByContractor: new Map(),
        }
      ),
      load(
        DriverStats,
        { driverId: String(snapshot.driverId), year: snapshot.year },
        {
          jobsByContractor: new Map(),
          revenueByContractor: new Map(),
        }
      ),
      load(
        VehicleStats,
        { vehicleId: String(snapshot.vehicleId), year: snapshot.year },
        {
          jobsByContractor: new Map(),
          revenueByContractor: new Map(),
        }
      ),
      load(
        ContractorStats,
        {
          contractorId: String(snapshot.contractorId),
          delivererId: String(companyId),
          year: snapshot.year,
        },
        { job_ids: [] }
      ),
    ]);

    mutateAggregateDoc(overall, snapshot, multiplier, {
      includeProfit: true,
      includeContractorMaps: true,
    });
    overall.totalCustomers = totalCustomers;
    overall.totalContractors = totalContractors;

    mutateAggregateDoc(driver, snapshot, multiplier, {
      includeProfit: true,
      includeContractorMaps: true,
    });
    mutateAggregateDoc(vehicle, snapshot, multiplier, {
      includeProfit: true,
      includeContractorMaps: true,
    });
    mutateAggregateDoc(contractor, snapshot, multiplier, {
      includeProfit: false,
      includeContractorMaps: false,
    });
  }

  const loaded = await Promise.all(docs.values());
  // Prune empty buckets and re-sort once per document, not once per leg.
  loaded.forEach((doc) => {
    cleanupAggregateDoc(doc, !(doc instanceof ContractorStats));
  });
  await Promise.all(loaded.map((doc) => doc.save({ session })));
}

function buildJobSnapshot({ job, contractorName }) {
  const { year, month, formattedDate } = dateParts(job.orderDate);
  return {
    year,
    month,
    formattedDate,
    distance: asNumber(job.distance),
    cost: roundMoney(job.cost),
    contractorId: String(job.contractorId),
    vehicleId: String(job.vehicleId),
    driverId: String(job.driverId),
    contractorName,
  };
}

module.exports = {
  asNumber,
  roundMoney,
  dateParts,
  applyJobDelta,
  applyJobDeltas,
  buildJobSnapshot,
};
