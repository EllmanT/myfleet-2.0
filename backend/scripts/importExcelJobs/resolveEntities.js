const { ObjectId } = require("mongodb");
const { VEHICLES, DRIVER_BY_VEHICLE } = require("./fileManifest");

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function jobNumberPrefix(jobNumber) {
  const match = String(jobNumber).match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Reads everything needed to resolve rows into Job documents. Read-only.
 */
async function loadReferenceData(db) {
  const [contractors, vehicles, drivers, customers] = await Promise.all([
    db.collection("contractors").find({}).toArray(),
    db.collection("vehicles").find({}).toArray(),
    db.collection("drivers").find({}).toArray(),
    db.collection("customers").find({}).toArray(),
  ]);

  const contractorIdByPrefix = new Map();
  for (const c of contractors) {
    if (c.prefix) contractorIdByPrefix.set(String(c.prefix).toUpperCase(), c._id);
  }

  const vehicleIdByReg = new Map();
  for (const v of vehicles) {
    if (v.regNumber) vehicleIdByReg.set(String(v.regNumber).trim().toUpperCase(), v._id);
  }
  for (const reg of Object.keys(VEHICLES)) {
    if (!vehicleIdByReg.has(reg)) {
      throw new Error(`Vehicle ${reg} referenced in fileManifest.js not found in DB`);
    }
  }

  const driverIdByName = new Map();
  for (const d of drivers) {
    if (d.name) driverIdByName.set(normalizeName(d.name), d._id);
  }

  const driverIdByVehicleReg = new Map();
  for (const [reg, driverName] of Object.entries(DRIVER_BY_VEHICLE)) {
    const id = driverIdByName.get(normalizeName(driverName));
    if (!id) throw new Error(`Driver "${driverName}" (mapped to vehicle ${reg}) not found in DB`);
    driverIdByVehicleReg.set(reg, id);
  }

  const customerIdByName = new Map();
  for (const c of customers) {
    if (c.name) customerIdByName.set(normalizeName(c.name), c._id);
  }

  return {
    contractorIdByPrefix,
    vehicleIdByReg,
    driverIdByVehicleReg,
    customerIdByName, // mutated in place as new customers are registered/created
  };
}

/**
 * Resolves a customer/location name to an id, recording it as "new" if it
 * doesn't exist yet. Does not touch the DB — caller decides when/whether to
 * actually create the pending customers.
 */
function resolveOrStageCustomer(name, refData, pendingNewCustomers) {
  const key = normalizeName(name);
  if (!key) return { id: null, issue: "empty customer/location name" };

  const existing = refData.customerIdByName.get(key);
  if (existing) return { id: existing };

  if (!pendingNewCustomers.has(key)) {
    pendingNewCustomers.set(key, { name: String(name).trim() });
  }
  // Placeholder id resolved later once the customer is actually created.
  return { id: null, pendingKey: key };
}

/**
 * Resolves one parsed row into a Job-shaped document (minus _id/timestamps).
 * Returns { job, issues, pendingRefs } where pendingRefs lists which fields
 * are still waiting on a not-yet-created customer (keyed by normalized name).
 */
function resolveRow(row, vehicleRegNumber, refData, pendingNewCustomers) {
  const issues = [];

  const vehicleId = refData.vehicleIdByReg.get(vehicleRegNumber);
  if (!vehicleId) issues.push(`unknown vehicle ${vehicleRegNumber}`);

  const driverId = refData.driverIdByVehicleReg.get(vehicleRegNumber);
  if (!driverId) issues.push(`no driver mapped for vehicle ${vehicleRegNumber}`);

  const prefix = jobNumberPrefix(row.jobNumber);
  const contractorId = prefix ? refData.contractorIdByPrefix.get(prefix) : null;
  if (!contractorId) {
    issues.push(`no contractor for job number prefix "${prefix}" (job ${row.jobNumber})`);
  }

  const fromResolved = resolveOrStageCustomer(row.from, refData, pendingNewCustomers);
  const customerResolved = resolveOrStageCustomer(row.customer, refData, pendingNewCustomers);
  if (fromResolved.issue) issues.push(`from: ${fromResolved.issue}`);
  if (customerResolved.issue) issues.push(`customer: ${customerResolved.issue}`);

  if (!Number.isFinite(row.distance) || row.distance < 0) issues.push("invalid distance");
  if (!Number.isFinite(row.cost) || row.cost < 0) issues.push("invalid cost");
  if (!(row.orderDate instanceof Date) || Number.isNaN(row.orderDate.getTime())) {
    issues.push("invalid orderDate");
  }

  return {
    issues,
    pendingRefs: {
      from: fromResolved.pendingKey || null,
      customer: customerResolved.pendingKey || null,
    },
    jobDraft: {
      jobNumber: row.jobNumber,
      fromKey: fromResolved.pendingKey ? null : fromResolved.id,
      fromNameKey: normalizeName(row.from),
      customerKey: customerResolved.pendingKey ? null : customerResolved.id,
      customerNameKey: normalizeName(row.customer),
      distance: row.distance,
      cost: row.cost,
      mileageOut: row.mileageOut,
      mileageIn: row.mileageIn,
      orderDate: row.orderDate,
      description: `${row.from} -> ${row.customer}`,
      deliveryType: row.deliveryType || "local",
      contractorId,
      vehicleId,
      driverId,
      sourceFile: row.sourceFile,
      sourceSheet: row.sourceSheet,
    },
  };
}

/**
 * Once pending customers have been created (id assigned in refData), turns a
 * jobDraft into the final Job document ready for insertMany.
 */
function finalizeJobDraft(jobDraft, refData) {
  const fromId =
    jobDraft.fromKey || refData.customerIdByName.get(jobDraft.fromNameKey);
  const customerId =
    jobDraft.customerKey || refData.customerIdByName.get(jobDraft.customerNameKey);
  if (!fromId || !customerId) {
    throw new Error(
      `Could not finalize job ${jobDraft.jobNumber}: missing from/customer id (from="${jobDraft.fromNameKey}", customer="${jobDraft.customerNameKey}")`
    );
  }

  return {
    _id: new ObjectId(),
    jobNumber: jobDraft.jobNumber,
    from: fromId,
    customer: customerId,
    distance: jobDraft.distance,
    cost: jobDraft.cost,
    mileageOut: jobDraft.mileageOut,
    mileageIn: jobDraft.mileageIn,
    orderDate: jobDraft.orderDate,
    description: jobDraft.description,
    deliveryType: jobDraft.deliveryType,
    contractorId: jobDraft.contractorId,
    vehicleId: jobDraft.vehicleId,
    driverId: jobDraft.driverId,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };
}

module.exports = {
  normalizeName,
  jobNumberPrefix,
  loadReferenceData,
  resolveRow,
  finalizeJobDraft,
};
