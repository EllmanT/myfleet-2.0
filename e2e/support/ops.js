/*
 * Helpers shared by the ops-*.spec.js files (vehicles, drivers, jobs, trips, uploads...).
 * Additive only: nothing here changes the behaviour of support/api.js or tenants.js.
 */
const { createTenant } = require("./tenants");
const { ctl } = require("./control");
const { JPEG } = require("./api");

// Admin + Manager in one company, every module on (the default of createTenant).
const twoRoles = [
  { role: "Deliverer Admin", key: "admin" },
  { role: "Deliverer Manager", key: "manager" },
];
const makeTenant = (label, opts = {}) => createTenant(label, { users: twoRoles, ...opts });

// Files: the server decides the type from the first bytes, never from the name or MIME type.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("e2e-png-bytes")]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPe2e-webp")]);
const PDF = Buffer.from("%PDF-1.4\n% e2e tiny pdf\n%%EOF\n");
const TEXT_AS_JPG = Buffer.from("this is plain text pretending to be a picture, definitely not a jpeg");
const SVG_WITH_SCRIPT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const EXE_AS_JPG = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64, 0)]);
const jpegOfSize = (bytes) => Buffer.concat([JPEG, Buffer.alloc(Math.max(0, bytes - JPEG.length), 7)]);
const pdfOfSize = (bytes) => Buffer.concat([PDF, Buffer.alloc(Math.max(0, bytes - PDF.length), 32)]);

function form(fields = {}, files = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, String(v));
  for (const [k, spec] of Object.entries(files)) {
    const { buffer, type = "image/jpeg", name = "file.bin" } = spec;
    f.append(k, new Blob([buffer], { type }), name);
  }
  return f;
}

const driverForm = (companyId, over = {}, files) =>
  form(
    { name: "Test Driver", phoneNumber: "0772222222", address: "2 Road", city: "Harare", idNumber: "ID-1", companyId, ...over },
    files || {
      license: { buffer: JPEG, name: "licence.jpg" },
      id: { buffer: JPEG, name: "id.jpg" },
    }
  );

const find = async (collection, filter) => (await ctl("/ctl/find", { collection, filter })).docs;
const count = async (collection, filter) => (await ctl("/ctl/count", { collection, filter })).count;

// Filters on fields that are ObjectIds but not named *Id (the control API only converts *Id keys).
const ratesOf = (contractorId) => find("rates", { $expr: { $eq: [{ $toString: "$contractor" }, String(contractorId)] } });

// A company's minimum working set for jobs: one vehicle, two customers, a contractor and a driver
// (no job). Returns the raw documents, created through the real API.
async function baseline(tenant, api, { reg = "QAA1001", contractor = "Lammel QA", prefix = "LQ" } = {}) {
  const cid = tenant.companyId;
  await api.createVehicle(cid, { regNumber: reg, make: "Toyota Dyna", size: "smallVehicle" });
  await api.createCustomer(cid, { name: "Depot" });
  await api.createCustomer(cid, { name: "Delta Mining" });
  await api.createContractor(cid, { companyName: contractor, prefix });
  await api.createDriver(cid, { name: "Tendai", idNumber: `ID-${tenant.id}` });
  const one = async (c, f) => (await find(c, { tenantId: cid, ...f }))[0];
  return {
    vehicle: await one("vehicles", { regNumber: reg }),
    depot: await one("customers", { name: "Depot" }),
    delta: await one("customers", { name: "Delta Mining" }),
    contractor: await one("contractors", { companyName: contractor }),
    driver: await one("drivers", { name: "Tendai" }),
  };
}

// A valid create-job payload for a baseline() set.
const jobPayload = (b, over = {}) => ({
  jobNumber: "LQ-1",
  from: b.depot._id,
  customer: b.delta._id,
  description: "Depot to Delta Mining",
  deliveryType: "local",
  orderDate: "2026-01-10T00:00:00.000Z",
  contractorId: b.contractor._id,
  vehicleId: b.vehicle._id,
  driverId: b.driver._id,
  mileageOut: "1000",
  mileageIn: "1100",
  distance: 100,
  cost: "60.00",
  ...over,
});

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

module.exports = {
  makeTenant, twoRoles, form, driverForm, find, count, isoDay, ratesOf, baseline, jobPayload,
  PNG, WEBP, PDF, JPEG, TEXT_AS_JPG, SVG_WITH_SCRIPT, EXE_AS_JPG, jpegOfSize, pdfOfSize,
};
