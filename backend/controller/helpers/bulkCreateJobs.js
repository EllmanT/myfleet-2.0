const Job = require("../../model/job");
const Deliverer = require("../../model/deliverer");
const Contractor = require("../../model/contractor");
const Driver = require("../../model/driver");
const Vehicle = require("../../model/vehicle");
const ContractorStats = require("../../model/contractorStats");
const ErrorHandler = require("../../utils/ErrorHandler");
const {
  asNumber,
  roundMoney,
  applyJobDeltas,
  buildJobSnapshot,
} = require("./jobStatsSync");

const sessionOpts = (session) => (session ? { session } : {});

function groupIdsBy(jobs, field) {
  const groups = new Map();
  jobs.forEach((job) => {
    const key = String(job[field]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(job._id);
  });
  return groups;
}

function addToSetOps(groups, field = "job_ids") {
  return [...groups.entries()].map(([id, jobIds]) => ({
    updateOne: {
      filter: { _id: id },
      update: { $addToSet: { [field]: { $each: jobIds } } },
    },
  }));
}

/**
 * Inserts job legs and updates every table that references jobs, with a
 * fixed number of round-trips regardless of how many legs there are:
 * one insertMany, one $addToSet per referencing collection, and one
 * load+save per affected stats document.
 *
 * Does not touch contractor.lastOrder — callers own job numbering.
 *
 * @param {object[]} payloads  job fields (jobNumber, from, customer, ...)
 * @param {object} context     { companyId, session }
 * @returns {Promise<object[]>} the created Job documents
 */
async function bulkCreateJobs(payloads, { companyId, session = null }) {
  if (!payloads.length) return [];

  const idsOf = (field) => [...new Set(payloads.map((p) => String(p[field])))];
  const contractorIds = idsOf("contractorId");
  const vehicleIds = idsOf("vehicleId");
  const driverIds = idsOf("driverId");

  const [deliverer, contractors, vehicleCount, driverCount] = await Promise.all([
    Deliverer.findById(companyId)
      .select("customer_ids contractor_ids")
      .session(session)
      .lean(),
    Contractor.find({ _id: { $in: contractorIds } })
      .select("companyName")
      .session(session)
      .lean(),
    Vehicle.countDocuments({ _id: { $in: vehicleIds } }).session(session),
    Driver.countDocuments({ _id: { $in: driverIds } }).session(session),
  ]);

  if (!deliverer) {
    throw new ErrorHandler("Deliverer not found", 404);
  }
  if (
    contractors.length !== contractorIds.length ||
    vehicleCount !== vehicleIds.length ||
    driverCount !== driverIds.length
  ) {
    throw new ErrorHandler("Invalid contractor, vehicle, or driver for job", 400);
  }

  const docs = payloads.map(
    (payload) =>
      new Job({
        ...payload,
        distance: asNumber(payload.distance),
        cost: roundMoney(payload.cost),
      })
  );
  const created = await Job.insertMany(docs, sessionOpts(session));
  const jobIds = created.map((job) => job._id);

  await Promise.all([
    Deliverer.updateOne(
      { _id: companyId },
      { $addToSet: { job_ids: { $each: jobIds } } },
      sessionOpts(session)
    ),
    Driver.bulkWrite(addToSetOps(groupIdsBy(created, "driverId")), sessionOpts(session)),
    Vehicle.bulkWrite(addToSetOps(groupIdsBy(created, "vehicleId")), sessionOpts(session)),
    Contractor.bulkWrite(
      addToSetOps(groupIdsBy(created, "contractorId")),
      sessionOpts(session)
    ),
  ]);

  const contractorNames = new Map(
    contractors.map((c) => [String(c._id), c.companyName])
  );
  const snapshots = created.map((job) =>
    buildJobSnapshot({ job, contractorName: contractorNames.get(String(job.contractorId)) })
  );

  await applyJobDeltas(snapshots, 1, {
    companyId,
    totalCustomers: (deliverer.customer_ids || []).length,
    totalContractors: (deliverer.contractor_ids || []).length,
    session,
  });

  // applyJobDeltas guarantees these ContractorStats docs exist.
  const statsGroups = new Map();
  snapshots.forEach((snapshot, index) => {
    const key = `${snapshot.contractorId}|${snapshot.year}`;
    if (!statsGroups.has(key)) {
      statsGroups.set(key, { snapshot, jobIds: [] });
    }
    statsGroups.get(key).jobIds.push(created[index]._id);
  });
  await ContractorStats.bulkWrite(
    [...statsGroups.values()].map(({ snapshot, jobIds: ids }) => ({
      updateOne: {
        filter: {
          contractorId: String(snapshot.contractorId),
          delivererId: String(companyId),
          year: snapshot.year,
        },
        update: { $addToSet: { job_ids: { $each: ids } } },
      },
    })),
    sessionOpts(session)
  );

  return created;
}

module.exports = { bulkCreateJobs };
