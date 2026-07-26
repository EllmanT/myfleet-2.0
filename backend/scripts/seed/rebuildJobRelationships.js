const { ObjectId } = require("mongodb");
const { timedStep } = require("./logger");

async function rebuildJobRelationships(db) {
  return timedStep("rebuild:job_ids", async () => {
    const jobs = await db
      .collection("jobs")
      .find(
        {},
        { projection: { _id: 1, contractorId: 1, driverId: 1, vehicleId: 1 } }
      )
      .toArray();

    const jobsByContractor = new Map();
    const jobsByDriver = new Map();
    const jobsByVehicle = new Map();
    const allJobIds = jobs.map((j) => j._id);

    for (const job of jobs) {
      if (job.contractorId) {
        const key = job.contractorId.toString();
        if (!jobsByContractor.has(key)) jobsByContractor.set(key, []);
        jobsByContractor.get(key).push(job._id);
      }
      if (job.driverId) {
        const key = job.driverId.toString();
        if (!jobsByDriver.has(key)) jobsByDriver.set(key, []);
        jobsByDriver.get(key).push(job._id);
      }
      if (job.vehicleId) {
        const key = job.vehicleId.toString();
        if (!jobsByVehicle.has(key)) jobsByVehicle.set(key, []);
        jobsByVehicle.get(key).push(job._id);
      }
    }

    await db.collection("contractors").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("drivers").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("vehicles").updateMany({}, { $set: { job_ids: [] } });
    await db.collection("deliverers").updateMany({}, { $set: { job_ids: allJobIds } });

    const contractorOps = Array.from(jobsByContractor.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));
    const driverOps = Array.from(jobsByDriver.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));
    const vehicleOps = Array.from(jobsByVehicle.entries()).map(([id, ids]) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { job_ids: ids } },
      },
    }));

    if (contractorOps.length) await db.collection("contractors").bulkWrite(contractorOps);
    if (driverOps.length) await db.collection("drivers").bulkWrite(driverOps);
    if (vehicleOps.length) await db.collection("vehicles").bulkWrite(vehicleOps);

    return {
      contractorsUpdated: contractorOps.length,
      driversUpdated: driverOps.length,
      vehiclesUpdated: vehicleOps.length,
      deliverersUpdated: await db.collection("deliverers").countDocuments(),
    };
  });
}

module.exports = { rebuildJobRelationships };
