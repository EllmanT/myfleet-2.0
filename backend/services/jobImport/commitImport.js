const Customer = require("../../model/customer");
const Deliverer = require("../../model/deliverer");
const Contractor = require("../../model/contractor");
const ErrorHandler = require("../../utils/ErrorHandler");
const { runWithOptionalTransaction } = require("../../controller/helpers/transaction");
const { bulkCreateJobs } = require("../../controller/helpers/bulkCreateJobs");
const { buildImportPreview, NEW_PREFIX } = require("./buildImportPreview");
const { normalizeName } = require("./matching");

// Placeholder details for customers created from a log — only the name
// matters; the rest can be edited later on the Customers page.
const NEW_CUSTOMER_DEFAULTS = {
  city: "Harare",
  address: "Added via Excel import",
  phoneNumber: "N/A",
};

async function createMissingCustomers(names, session) {
  const idByName = new Map();
  if (!names.length) return { idByName, createdNames: [] };

  // Reuse an existing customer with the same name rather than duplicate it.
  const existing = await Customer.find({})
    .select("name")
    .session(session)
    .lean();
  const existingByName = new Map(existing.map((c) => [normalizeName(c.name), c._id]));

  const toCreate = [];
  names.forEach((name) => {
    const key = normalizeName(name);
    if (existingByName.has(key)) {
      idByName.set(name, existingByName.get(key));
    } else if (!toCreate.some((doc) => normalizeName(doc.name) === key)) {
      toCreate.push({ name, ...NEW_CUSTOMER_DEFAULTS });
    }
  });

  const created = toCreate.length
    ? await Customer.insertMany(toCreate, session ? { session } : {})
    : [];
  created.forEach((doc) => existingByName.set(normalizeName(doc.name), doc._id));
  names.forEach((name) => idByName.set(name, existingByName.get(normalizeName(name))));

  return { idByName, createdNames: created.map((doc) => doc.name) };
}

// Atomically claims `count` consecutive job numbers per contractor.
async function reserveJobNumbers(countByContractor, session) {
  const startByContractor = new Map();
  for (const [contractorId, count] of countByContractor) {
    // eslint-disable-next-line no-await-in-loop
    const before = await Contractor.findOneAndUpdate(
      { _id: contractorId },
      { $inc: { lastOrder: count } },
      { new: false, session, projection: { lastOrder: 1, prefix: 1 } }
    ).lean();
    startByContractor.set(contractorId, {
      start: Number(before.lastOrder) || 1,
      prefix: before.prefix || "",
    });
  }
  return startByContractor;
}

/**
 * Re-runs the preview with the user's choices, then writes it. Nothing is
 * written unless every remaining leg is resolvable.
 */
async function commitImport({ files, companyId, choices = {}, options = {} }) {
  const preview = await buildImportPreview({ files, companyId, choices, options });
  if (!preview.canCommit) {
    const reason = preview.summary.blocked
      ? `${preview.summary.blocked} trip(s) still need a driver, vehicle or contractor chosen`
      : "Nothing new to import";
    throw new ErrorHandler(reason, 400);
  }

  const legsById = new Map(preview.legs.map((leg) => [leg.id, leg]));
  const jobs = [...preview.jobs].sort((a, b) => a.date.localeCompare(b.date));

  let result;
  await runWithOptionalTransaction(async (session) => {
    const { idByName, createdNames } = await createMissingCustomers(
      preview.newCustomerNames,
      session
    );
    const customerId = (value) =>
      value.startsWith(NEW_PREFIX)
        ? idByName.get(value.slice(NEW_PREFIX.length).trim())
        : value;

    const countByContractor = new Map();
    jobs.forEach((job) =>
      countByContractor.set(job.contractorId, (countByContractor.get(job.contractorId) || 0) + 1)
    );
    const numbering = await reserveJobNumbers(countByContractor, session);

    const payloads = [];
    const usedCustomerIds = new Set();
    const createdJobs = jobs.map((job) => {
      const slot = numbering.get(job.contractorId);
      const jobNumber = `${slot.prefix}${String(slot.start).padStart(4, "0")}`;
      slot.start += 1;

      job.legIds.forEach((legId) => {
        const leg = legsById.get(legId);
        const from = customerId(leg.fromValue);
        const customer = customerId(leg.toValue);
        usedCustomerIds.add(String(from));
        usedCustomerIds.add(String(customer));
        payloads.push({
          jobNumber,
          from,
          customer,
          description: `${leg.fromName} -> ${leg.toName}`,
          deliveryType: leg.deliveryType,
          orderDate: new Date(`${leg.date}T00:00:00.000Z`),
          contractorId: leg.contractorId,
          vehicleId: leg.vehicleId,
          driverId: leg.driverId,
          mileageOut: String(leg.mileageOut),
          mileageIn: String(leg.mileageIn),
          distance: leg.distance,
          cost: leg.cost,
        });
      });

      return {
        jobNumber,
        date: job.date,
        contractorName: job.contractorName,
        route: job.route,
        legs: job.legIds.length,
        distance: job.distance,
        cost: job.cost,
      };
    });

    // Make every customer used (new or matched) one of this deliverer's
    // customers, as the Add Customer popup would.
    await Deliverer.updateOne(
      { _id: companyId },
      { $addToSet: { customer_ids: { $each: [...usedCustomerIds] } } },
      session ? { session } : {}
    );

    await bulkCreateJobs(payloads, { companyId, session });

    result = {
      jobsCreated: createdJobs.length,
      legsCreated: payloads.length,
      newCustomers: createdNames,
      jobs: createdJobs,
      summary: preview.summary,
    };
  });

  return result;
}

module.exports = { commitImport };
