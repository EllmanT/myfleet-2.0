/*
 * Helpers for the finance specs (fin-*.spec.js): a "Stats Co" tenant loaded with the hand-worked
 * ANALYTICS-2026 data set from docs/qa/TEST_DATA.md (section 6), small invoice/quotation builders,
 * and a dependency-free PDF text extractor.
 */
const zlib = require("zlib");
const { createTenant } = require("./tenants");
const { ctl } = require("./control");

const find = async (collection, filter) => (await ctl("/ctl/find", { collection, filter })).docs;

const iso = (d) => `${d}T10:00:00.000Z`; // midday UTC: no timezone can move it to another day

// ---- the worked example (TEST_DATA.md section 6), one entry per job -----------------------------
const JOBS = [
  { n: "J1", date: "2026-01-10", ctr: "Lammel QA", veh: "QAA1001", drv: "Tendai", type: "local", legs: [["Depot", "Delta Mining", 1000, 1100, 100, 60]] },
  { n: "J2", date: "2026-01-25", ctr: "Lammel QA", veh: "QAA1001", drv: "Tendai", type: "local", legs: [["Delta Mining", "Depot", 1100, 1150, 50, 30]] },
  { n: "J3", date: "2026-02-03", ctr: "U-Plan QA", veh: "QAB2002", drv: "Tendai", type: "local", legs: [["Depot", "Beta Foods", 20000, 20080, 80, 80]] },
  { n: "J4", date: "2026-02-14", ctr: "Lammel QA", veh: "QAB2002", drv: "Chipo", type: "express", legs: [["Depot", "Gamma Steel", 20080, 20200, 120, 84]] },
  { n: "J5", date: "2026-02-20", ctr: "U-Plan QA", veh: "QAA1001", drv: "Tendai", type: "express", legs: [["Depot", "Beta Foods", 1150, 1190, 40, 20]] },
  { n: "J6", date: "2026-03-05", ctr: "Lammel QA", veh: "QAC3003", drv: "Chipo", type: "local", legs: [["Depot", "Delta Mining", 30000, 30060, 60, 72], ["Delta Mining", "Beta Foods", 30060, 30100, 40, 48]] },
  { n: "J7", date: "2025-12-30", ctr: "Lammel QA", veh: "QAA1001", drv: "Tendai", type: "local", legs: [["Depot", "Delta Mining", 990, 1000, 10, 6]] },
];

// [id, date, type, category, vehicle, amount, extra]
const LEDGER = [
  ["E1", "2026-01-31", "expense", "driver_salary", "QAA1001", 200, { payee: "Tendai" }],
  ["E2", "2026-02-15", "expense", "insurance", "QAB2002", 150, {}],
  ["E3", "2026-02-28", "expense", "owner_salary", null, 100, { retainedInBusiness: true }],
  ["E4", "2026-03-10", "expense", "private_fuel", "QAA1001", 30, {}],
  ["E5", "2026-01-20", "income", "cash_hire", "QAA1001", 50, {}],
  ["E6", "2026-03-01", "expense", "fuel", "QAC3003", 80, { isEstimate: true }],
];

// [date+time, odometer, litres, amount, photos]
const FILLS = [
  ["2026-03-02T08:00:00.000Z", 10000, 100, 190, true],
  ["2026-03-09T08:00:00.000Z", 10360, 80, 152, true],
  ["2026-03-16T08:00:00.000Z", 10600, 80, 152, true],
  ["2026-03-23T08:00:00.000Z", 10600, 40, 76, true],
  ["2026-03-23T12:00:00.000Z", 10640, 10, 19, false],
];

// Hand-worked results (all by the doc; see TEST_DATA.md sections 6 and 7).
const EXPECT = {
  jobs2026: { legs: 7, revenue: 394, km: 490, contractors: 2 },
  month2026: {
    January: { jobs: 2, revenue: 90, km: 150 },
    February: { jobs: 3, revenue: 184, km: 240 },
    March: { jobs: 2, revenue: 120, km: 100 },
  },
  day2026: { "2026-01-10": [1, 60, 100], "2026-01-25": [1, 30, 50], "2026-02-03": [1, 80, 80], "2026-02-14": [1, 84, 120], "2026-02-20": [1, 20, 40], "2026-03-05": [2, 120, 100] },
  byContractor2026: { "Lammel QA": { jobs: 5, revenue: 294 }, "U-Plan QA": { jobs: 2, revenue: 100 } },
  jobs2025: { legs: 1, revenue: 6, km: 10 },
  profit2026: {
    totals: { jobRevenue: 394, otherIncome: 50, revenue: 444, totalExpenses: 1039, profit: -595, cashProfit: -495, retained: 100, privateFuel: 30 },
    Jan: { jobRevenue: 90, otherIncome: 50, revenue: 140, totalExpenses: 200, profit: -60, cashProfit: -60, privateFuel: 0 },
    Feb: { jobRevenue: 184, otherIncome: 0, revenue: 184, totalExpenses: 250, profit: -66, cashProfit: 34, privateFuel: 0 },
    Mar: { jobRevenue: 120, otherIncome: 0, revenue: 120, totalExpenses: 589, profit: -469, cashProfit: -469, privateFuel: 30 },
    QAA1001: { revenue: 160, totalExpenses: 200, profit: -40, privateFuel: 30 },
    QAB2002: { revenue: 164, totalExpenses: 150, profit: 14 },
    QAC3003: { revenue: 120, totalExpenses: 589, profit: -469 },
    overhead: { totalExpenses: 100, profit: -100, cashProfit: 0 },
  },
};

const VEHICLES = [
  ["QAA1001", "Toyota Dyna", "smallVehicle"],
  ["QAB2002", "Isuzu NPR", "mediumVehicle"],
  ["QAC3003", "Hino 500", "largeVehicle"],
];
const CUSTOMERS = ["Depot", "Delta Mining", "Beta Foods", "Gamma Steel", "Spare Customer"];
const CONTRACTORS = [["Lammel QA", "LQ"], ["U-Plan QA", "UP"]];
const DRIVERS = [["Tendai", "63-1234567X63"], ["Chipo", "63-7654321Y63"]];

/**
 * Builds a company with only reference data (vehicles, customers, contractors, drivers) using the
 * same names the QA document uses. Two calls give two tenants with overlapping names on purpose.
 */
async function buildReference(label, { users, modules, billing, driverIds = true } = {}) {
  const t = await createTenant(label, {
    users: users || [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }],
    ...(modules ? { modules } : {}),
    ...(billing !== undefined ? { billing } : {}),
  });
  const api = await t.api();
  const cid = t.companyId;
  for (const [reg, make, size] of VEHICLES) await api.createVehicle(cid, { make, regNumber: reg, size });
  for (const name of CUSTOMERS) await api.createCustomer(cid, { name });
  for (const [companyName, prefix] of CONTRACTORS) await api.createContractor(cid, { companyName, prefix });
  for (const [name, idNumber] of DRIVERS) await api.createDriver(cid, { name, idNumber: driverIds ? idNumber : `${idNumber}-${t.id}` });
  const byName = async (coll, key) => Object.fromEntries((await find(coll, { tenantId: cid })).map((d) => [d[key], d]));
  const ids = {
    vehicles: await byName("vehicles", "regNumber"),
    customers: await byName("customers", "name"),
    contractors: await byName("contractors", "companyName"),
    drivers: await byName("drivers", "name"),
  };
  return { t, api, ids };
}

const jobPayload = (ids, job, leg, legIx, extra = {}) => ({
  jobNumber: job.n,
  from: ids.customers[leg[0]]._id,
  customer: ids.customers[leg[1]]._id,
  description: `${job.n} ${leg[0]} to ${leg[1]}`,
  deliveryType: job.type,
  orderDate: iso(job.date),
  contractorId: ids.contractors[job.ctr]._id,
  vehicleId: ids.vehicles[job.veh]._id,
  driverId: ids.drivers[job.drv]._id,
  mileageOut: String(leg[2]),
  mileageIn: String(leg[3]),
  distance: leg[4],
  cost: leg[5].toFixed(2),
  ...extra,
});

async function addJobs(api, ids, jobs = JOBS) {
  for (const job of jobs) await api.mustPost("/api/v2/job/create-job", job.legs.map((leg, i) => jobPayload(ids, job, leg, i)));
}

async function addLedger(api, ids) {
  for (const [, date, type, category, veh, amount, extra] of LEDGER) {
    await api.mustPost("/api/v2/expense/create-expense", {
      type, category, amount, date: iso(date), description: `ledger ${category}`,
      ...(veh ? { vehicleId: ids.vehicles[veh]._id } : {}),
      ...extra,
    });
  }
}

async function addFills(api, ids) {
  for (const [filledAt, odometer, litres, amount, photoPosted] of FILLS) {
    await api.mustPost("/api/v2/fuel/create-fill", { vehicleId: ids.vehicles.QAC3003._id, filledAt, odometer, litres, amount, photoPosted, fullTank: true });
  }
}

/** The complete QA Stats Co: reference data, 7 jobs, 6 ledger rows, 5 fuel fills. */
async function buildStatsCo(label = "StatsCo", opts = {}) {
  const ref = await buildReference(label, opts);
  await addJobs(ref.api, ref.ids);
  await addLedger(ref.api, ref.ids);
  await addFills(ref.api, ref.ids);
  return ref;
}

// ---- invoice helpers ----------------------------------------------------------------------------
const day = (offset = 0, from = new Date()) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + offset)).toISOString().slice(0, 10);

async function draft(api, over = {}) {
  const body = { customerName: "Draft Customer", issueDate: day(0), lines: [{ description: "Haulage", quantity: 1, unitPrice: 100 }], ...over };
  const r = await api.post("/api/v2/invoice/create-invoice", body);
  if (r.status !== 201) throw new Error(`create-invoice -> ${r.status} ${r.text}`);
  return r.body.invoice;
}
async function issued(api, over = {}) {
  const d = await draft(api, over);
  const r = await api.post(`/api/v2/invoice/issue/${d._id}`);
  if (r.status !== 200) throw new Error(`issue -> ${r.status} ${r.text}`);
  return r.body.invoice;
}

// ---- PDF text -----------------------------------------------------------------------------------
// pdfkit writes Flate-compressed content streams with text as <hex> or (literal) strings inside TJ/Tj.
function pdfText(buffer) {
  const raw = buffer.toString("latin1");
  const out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let chunk = buffer.subarray(start, end);
    let text;
    try {
      text = zlib.inflateSync(chunk).toString("latin1");
    } catch (e) {
      text = chunk.toString("latin1");
    }
    for (const line of text.split(/\n/)) {
      if (!/T[Jj]\s*$/.test(line.trim())) continue;
      let s = "";
      for (const piece of line.matchAll(/<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
        if (piece[1] !== undefined) {
          for (let i = 0; i < piece[1].length; i += 2) s += String.fromCharCode(parseInt(piece[1].substr(i, 2), 16));
        } else {
          s += piece[2].replace(/\\([()\\])/g, "$1");
        }
      }
      out.push(s);
    }
    re.lastIndex = end + "endstream".length;
  }
  return out.join("\n");
}

module.exports = {
  find, iso, day, JOBS, LEDGER, FILLS, EXPECT, VEHICLES, CUSTOMERS,
  buildReference, buildStatsCo, addJobs, addLedger, addFills, jobPayload, draft, issued, pdfText,
};
