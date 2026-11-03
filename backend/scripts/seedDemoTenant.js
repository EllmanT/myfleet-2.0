/*
 * Creates (or resets) a DEMO haulage company full of invented but realistic data,
 * for product screenshots, demo videos and sales demos. Nothing in it is real.
 *
 * Safe by design:
 *   - it only ever creates, resets or deletes companies flagged isDemo: true,
 *     and everything owned by them; it never touches a real company
 *   - the same --seed and --today always produce the same data
 *   - the target is always explicit; writing to live also needs --confirm-live
 *
 * Usage (run from backend/):
 *   node scripts/seedDemoTenant.js --target=local --apply            create (or refresh)
 *   node scripts/seedDemoTenant.js --target=local --reset            delete the demo company only
 *   node scripts/seedDemoTenant.js --target=local                    dry run: says what it would do
 *   options: --today=2026-11-03   --seed=7   (a staging database is just another --target=local URI)
 *
 * Demo login created with the company:  demo@myfleet.app  /  demo-password-1
 */
const path = require("path");

const DEMO_NAME = "Kudu Haulage (Demo)";
const DEMO_EMAIL = "demo@myfleet.app";
const DEMO_PASSWORD = "demo-password-1";

// small deterministic random generator, so the data is the same every run
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

async function deleteDemo(mongoose) {
  const Deliverer = require("../model/deliverer");
  const demos = await Deliverer.find({ isDemo: true }).select("_id").lean();
  const summary = { companies: demos.length };
  for (const { _id } of demos) {
    const id = String(_id);
    const db = mongoose.connection.db;
    const byTenant = ["customers", "contractors", "vehicles", "drivers", "jobs", "trailers", "trips", "invoices", "payments",
      "quotations", "compliancedocs", "serviceplans", "maintenancerecords", "tyres", "tyrefitments", "counters", "aiusages",
      "vehiclestats", "driverstats"];
    for (const coll of byTenant) await db.collection(coll).deleteMany({ $or: [{ tenantId: _id }, { tenantId: id }] });
    for (const coll of ["expenses", "fuelfills", "overallstats", "users"]) {
      await db.collection(coll).deleteMany({ $or: [{ companyId: _id }, { companyId: id }] });
    }
    await db.collection("rates").deleteMany({ $or: [{ deliverer: _id }, { deliverer: id }] });
    await db.collection("contractorstats").deleteMany({ $or: [{ delivererId: id }, { delivererId: _id }] });
    await db.collection("deliverers").deleteOne({ _id });
  }
  return summary;
}

async function seedDemo(mongoose, { today = new Date(), seed = 7 } = {}) {
  const Deliverer = require("../model/deliverer");
  const User = require("../model/user");
  const Vehicle = require("../model/vehicle");
  const Driver = require("../model/driver");
  const Contractor = require("../model/contractor");
  const Customer = require("../model/customer");
  const Rate = require("../model/rate");
  const Trailer = require("../model/trailer");
  const Trip = require("../model/trip");
  const Invoice = require("../model/invoice");
  const Payment = require("../model/payment");
  const Quotation = require("../model/quotation");
  const ComplianceDoc = require("../model/complianceDoc");
  const ServicePlan = require("../model/servicePlan");
  const MaintenanceRecord = require("../model/maintenanceRecord");
  const Tyre = require("../model/tyre");
  const TyreFitment = require("../model/tyreFitment");
  const Expense = require("../model/expense");
  const FuelFill = require("../model/fuelFill");
  const Job = require("../model/job");
  const { bulkCreateJobs } = require("../controller/helpers/bulkCreateJobs");
  const { nextNumber } = require("../services/documentNumber");
  const { computeTotals, lineAmount } = require("../utils/invoiceMath");
  const { recomputePaid } = require("../services/invoicing");
  const { MODULES } = require("../config/modules");

  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const daysAgo = (n) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - n * DAY);

  await deleteDemo(mongoose);

  const company = await Deliverer.create({
    companyName: DEMO_NAME, address: "14 Samora Machel Avenue", city: "Harare",
    goodsType: ["general freight"], vehiclesType: ["horse", "mediumVehicle"], deliveryType: ["local", "express"],
    prefix: "KD", plan: "free", isDemo: true,
    modules: Object.fromEntries(MODULES.map((m) => [m.key, m.available && m.key !== "aiImport"])),
  });
  const tenantId = company._id;

  await User.create({
    name: "Rudo Chikwanha", email: DEMO_EMAIL, password: DEMO_PASSWORD, phoneNumber: "+263 77 000 0000",
    role: "Deliverer Admin", address: "14 Samora Machel Avenue", city: "Harare", companyId: tenantId,
  });

  // trucks, trailers, drivers
  const vehicles = await Vehicle.create([
    { make: "DAF XF 480", regNumber: "ADE 4821", size: "horse", companyId: String(tenantId), tenantId, expectedKmPerLitre: 3.4 },
    { make: "Scania R450", regNumber: "ADF 1093", size: "horse", companyId: String(tenantId), tenantId, expectedKmPerLitre: 3.6 },
    { make: "Isuzu FTR 800", regNumber: "ACX 7762", size: "mediumVehicle", companyId: String(tenantId), tenantId, expectedKmPerLitre: 7.2 },
  ]);
  const [daf, scania, isuzu] = vehicles;
  const trailers = await Trailer.create([
    { tenantId, regNumber: "ABC 1201", regKey: "ABC1201", type: "tautliner", axles: 3, capacityTons: 34 },
    { tenantId, regNumber: "ABC 1388", regKey: "ABC1388", type: "flatbed", axles: 3, capacityTons: 30 },
  ]);
  const drivers = await Driver.create(
    ["Tendai Moyo", "Farai Chuma", "Blessing Dube"].map((name, i) => ({
      name, phoneNumber: `+263 71 55${i}0 12${i}`, address: "Harare", city: "Harare",
      idNumber: `00-000${i}-X00`, id: "demo", license: "demo", companyId: String(tenantId), tenantId,
    }))
  );

  // places and clients for local work
  const placeNames = ["Msasa Industrial", "Ruwa Depot", "Norton Mill", "Graniteside Yard", "Southerton Warehouse", "Belvedere Depot", "Willowvale Plant", "Chitungwiza Market"];
  const places = await Customer.create(placeNames.map((name) => ({ name, city: "Harare", address: name, phoneNumber: "N/A", tenantId })));
  const contractors = await Contractor.create([
    { companyName: "Mutare Fresh Produce", prefix: "MF", lastOrder: 1, tenantId, address: "Mutare", city: "Mutare", goodsTypes: ["produce"], vehiclesTypes: ["mediumVehicle", "horse"], deliveryTypes: ["local", "express"] },
    { companyName: "Zambezi Building Supplies", prefix: "ZB", lastOrder: 1, tenantId, address: "Harare", city: "Harare", goodsTypes: ["building"], vehiclesTypes: ["mediumVehicle", "horse"], deliveryTypes: ["local", "express"] },
  ]);
  for (const c of contractors) {
    await Rate.create({ contractor: c._id, deliverer: tenantId, rateTypes: [
      { rateType: "local", smallVehicle: 0.9, mediumVehicle: 1.2, largeVehicle: 1.6, horse: 1.8 },
      { rateType: "express", smallVehicle: 1.3, mediumVehicle: 1.7, largeVehicle: 2.2, horse: 2.4 },
    ] });
  }
  company.vehicle_ids = vehicles.map((v) => v._id);
  company.driver_ids = drivers.map((d) => d._id);
  company.customer_ids = places.map((p) => p._id);
  company.contractor_ids = contractors.map((c) => c._id);
  await company.save();

  // ~90 days of local job legs, with an odometer that only ever goes up
  const odo = { [daf._id]: 412300, [scania._id]: 287450, [isuzu._id]: 198820 };
  const legsByContractor = new Map(contractors.map((c) => [String(c._id), []]));
  const driverFor = { [daf._id]: drivers[0], [scania._id]: drivers[1], [isuzu._id]: drivers[2] };
  for (let day = 90; day >= 1; day -= 1) {
    const date = daysAgo(day);
    if (date.getUTCDay() === 0) continue; // no Sunday work
    for (const v of [isuzu, daf]) {
      if (rand() < 0.35) continue;
      const contractor = pick(contractors);
      const legs = between(1, 3);
      for (let k = 0; k < legs; k += 1) {
        const from = pick(places);
        let to = pick(places);
        if (to._id.equals(from._id)) to = places[(places.indexOf(from) + 1) % places.length];
        const distance = between(8, v === isuzu ? 38 : 64);
        const out = odo[v._id];
        odo[v._id] += distance;
        const express = rand() < 0.2;
        const rate = (express ? { medium: 1.7, horse: 2.4 } : { medium: 1.2, horse: 1.8 })[v.size === "horse" ? "horse" : "medium"];
        legsByContractor.get(String(contractor._id)).push({
          from: from._id, customer: to._id, distance, cost: (rate * distance).toFixed(2),
          mileageOut: String(out), mileageIn: String(out + distance), orderDate: new Date(date.getTime() + (8 + k * 2) * 3600 * 1000),
          description: `${from.name} to ${to.name}`, deliveryType: express ? "express" : "local",
          contractorId: contractor._id, vehicleId: v._id, driverId: driverFor[v._id]._id,
        });
      }
    }
  }
  let jobLegs = 0;
  for (const contractor of contractors) {
    const legs = legsByContractor.get(String(contractor._id));
    let n = contractor.lastOrder;
    // job numbers: one number per day-vehicle-contractor group keeps them short and tidy
    const numbered = legs.map((leg) => ({ ...leg, jobNumber: `${contractor.prefix}${String(n++).padStart(4, "0")}` }));
    for (let i = 0; i < numbered.length; i += 100) {
      await bulkCreateJobs(numbered.slice(i, i + 100), { companyId: tenantId });
    }
    await Contractor.updateOne({ _id: contractor._id }, { $set: { lastOrder: n } });
    jobLegs += legs.length;
  }
  // fuel fills for the trucks from the odometer (so the fuel check has something to say)
  const fills = [];
  for (const v of [daf, scania, isuzu]) {
    let reading = odo[v._id] - 4200;
    for (let i = 9; i >= 0; i -= 1) {
      const km = v === isuzu ? 380 : 520;
      reading += km;
      const litres = Math.round((km / v.expectedKmPerLitre) * (0.94 + rand() * 0.16) * 10) / 10;
      fills.push({ companyId: tenantId, vehicleId: v._id, filledAt: daysAgo(i * 8 + 2), odometer: reading, litres, amount: Math.round(litres * 1.62 * 100) / 100, fullTank: true, purpose: "business", station: pick(["Zuva Msasa", "Puma Borrowdale", "Engen Beitbridge"]) });
    }
  }
  await FuelFill.create(fills);
  await Expense.create([
    { companyId: tenantId, type: "expense", date: daysAgo(20), category: "insurance", description: "Fleet insurance, quarterly", amount: 1450, vehicleId: daf._id },
    { companyId: tenantId, type: "expense", date: daysAgo(34), category: "driver_salary", description: "Driver wages", amount: 1260, payee: "Tendai Moyo" },
    { companyId: tenantId, type: "expense", date: daysAgo(12), category: "service", description: "Brake pads, front axle", amount: 385, vehicleId: scania._id },
  ]);

  // cross-border trips
  const routes = [
    { stops: [["Harare", "ZW"], ["Beitbridge", "ZW"], ["Johannesburg", "SA"]], km: 1100, cargo: "Tobacco bales", price: [1900, 2400], post: "Beitbridge" },
    { stops: [["Harare", "ZW"], ["Forbes", "ZW"], ["Beira", "MZ"]], km: 600, cargo: "Fertiliser, 30t", price: [1300, 1700], post: "Forbes" },
    { stops: [["Harare", "ZW"], ["Chirundu", "ZW"], ["Lusaka", "ZM"]], km: 480, cargo: "Building materials", price: [1100, 1500], post: "Chirundu" },
    { stops: [["Johannesburg", "SA"], ["Beitbridge", "ZW"], ["Harare", "ZW"]], km: 1100, cargo: "Mixed retail goods", price: [1700, 2200], post: "Beitbridge" },
  ];
  const clients = ["Highveld Distributors", "Eastern Agri Supplies", "Copperbelt Traders", "Limpopo Retail Group"];
  const trips = [];
  for (let i = 0; i < 14; i += 1) {
    const r = routes[i % routes.length];
    const date = daysAgo(80 - i * 5);
    const days = Math.round(r.km / 450) + 1;
    const price = between(r.price[0], r.price[1]);
    const horse = i % 2 ? scania : daf;
    trips.push({
      tenantId, clientRef: `KD.${String(i + 1).padStart(2, "0")}`, date, status: date < daysAgo(6) ? "delivered" : "in_transit",
      transporterName: DEMO_NAME, customerName: clients[i % clients.length], supplierName: pick(["Agri-Chem Zimbabwe", "Delta Industrial", "Marondera Mills"]),
      stops: r.stops.map(([place, country]) => ({ place, country })), isCrossBorder: true,
      borderCrossings: [{ post: r.post, direction: "out", arrivedAt: new Date(date.getTime() + 8 * 3600 * 1000), clearedAt: new Date(date.getTime() + 15 * 3600 * 1000) }],
      cargoDescription: r.cargo, distanceKm: r.km, price, currency: "USD", horseId: horse._id, trailerId: trailers[i % 2]._id,
      driverId: drivers[i % 2]._id, deliveredAt: date < daysAgo(6) ? new Date(date.getTime() + days * DAY) : undefined,
      costLines: [
        { type: "fuel", description: "Diesel", amount: Math.round(r.km * 0.46), currency: "USD" },
        { type: "border_fee", description: `${r.post} border fees`, amount: between(90, 160), currency: "USD" },
        { type: "toll", description: "Tolls", amount: between(25, 70), currency: "USD" },
        { type: "allowance", description: "Driver allowance", amount: days * 25, currency: "USD" },
      ],
    });
  }
  const createdTrips = await Trip.create(trips);

  // invoices: some paid, one part paid, one overdue, one not yet due; plus work left unbilled
  const issueInvoice = async ({ customerName, issueDate, dueDate, lines, tripIds = [], jobIds = [] }) => {
    const inv = new Invoice({ tenantId, customerName, issueDate, dueDate, currency: "USD", lines });
    Object.assign(inv, computeTotals(inv.lines, 0));
    inv.number = await nextNumber(tenantId, "invoice");
    inv.status = "issued";
    await inv.save();
    if (tripIds.length) await Trip.updateMany({ _id: { $in: tripIds } }, { $set: { invoiceId: inv._id } });
    if (jobIds.length) await Job.updateMany({ _id: { $in: jobIds } }, { $set: { invoiceId: inv._id } });
    return inv;
  };
  const pay = async (inv, cents, daysBack, method = "ecocash") => {
    await Payment.create({ tenantId, customerName: inv.customerName, date: daysAgo(daysBack), amountCents: cents, currency: "USD", method, reference: `REF${between(10000, 99999)}`, allocations: [{ invoiceId: inv._id, amountCents: cents }] });
    await recomputePaid(tenantId, [inv._id]);
  };
  const tripLine = (t) => ({ description: `${t.clientRef} - ${t.stops.map((s) => s.place).join(" to ")} - ${t.cargoDescription}`, quantity: 1, unitPriceCents: t.price * 100, amountCents: t.price * 100, tripId: t._id });
  const byClient = (name) => createdTrips.filter((t) => t.customerName === name && t.date < daysAgo(10));
  const issuedTrips = [];
  for (const [i, name] of clients.entries()) {
    const list = byClient(name).slice(0, 2);
    if (!list.length) continue;
    // due dates spread on purpose so screenshots can show every state: paid, part paid (not yet due),
    // overdue, and unpaid but not yet due
    const dueDays = [-40, 10, -25, 12][i % 4]; // negative = in the past
    const inv = await issueInvoice({ customerName: name, issueDate: daysAgo(70 - i * 12), dueDate: daysAgo(-dueDays), lines: list.map(tripLine), tripIds: list.map((t) => t._id) });
    issuedTrips.push(inv);
    if (i === 0) await pay(inv, inv.totalCents, 30);              // paid in full
    else if (i === 1) await pay(inv, Math.round(inv.totalCents * 0.4), 18, "bank"); // part paid
    // i === 2: overdue, i === 3: not yet due
  }
  // monthly local-job invoices, one per contractor for the oldest full month
  const start = daysAgo(75);
  const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));
  for (const contractor of contractors) {
    const jobs = await Job.find({ contractorId: contractor._id, orderDate: { $gte: monthStart, $lte: monthEnd } }).limit(60).lean();
    if (!jobs.length) continue;
    const lines = jobs.map((j) => {
      const cents = Math.round(parseFloat(j.cost.toString()) * 100);
      return { description: `${j.jobNumber} - ${iso(new Date(j.orderDate))} - ${j.description}`, quantity: 1, unitPriceCents: cents, amountCents: cents, jobId: j._id };
    });
    const inv = await issueInvoice({ customerName: contractor.companyName, issueDate: daysAgo(55), dueDate: daysAgo(25), lines, jobIds: jobs.map((j) => j._id) });
    await pay(inv, inv.totalCents, 20, "bank");
  }

  // quotations
  const quote = async (customerName, subject, lines, status, daysBack) => {
    const q = new Quotation({ tenantId, customerName, subject, status, issueDate: daysAgo(daysBack), validUntil: daysAgo(daysBack - 14), currency: "USD",
      lines: lines.map(([description, price]) => ({ description, quantity: 1, unitPriceCents: price * 100, amountCents: price * 100 })) });
    Object.assign(q, computeTotals(q.lines, 0));
    q.number = await nextNumber(tenantId, "quotation");
    await q.save();
  };
  await quote("Highveld Distributors", "Harare to Johannesburg, 28t", [["Haulage, Harare to Johannesburg", 2100], ["Border and agent fees", 160]], "sent", 6);
  await quote("Eastern Agri Supplies", "Harare to Beira, 30t fertiliser", [["Haulage, Harare to Beira", 1450]], "accepted", 15);
  await quote("Copperbelt Traders", "Harare to Lusaka, 20t", [["Haulage, Harare to Lusaka", 1250], ["Transit fees", 90]], "draft", 2);

  // documents: one expired, two due soon, the rest fine
  const doc = (ownerType, ownerId, docType, number, expiresInDays) => ({ tenantId, ownerType, ownerId, docType, number, issuedAt: daysAgo(365 - expiresInDays), expiresAt: daysAgo(-expiresInDays) });
  await ComplianceDoc.create([
    doc("vehicle", daf._id, "yellow_card", "YC-2026-48213", 11),
    doc("vehicle", scania._id, "yellow_card", "YC-2026-48977", 140),
    doc("vehicle", daf._id, "vehicle_licence", "VL-77120", 96),
    doc("vehicle", scania._id, "roadworthy", "RW-33104", -4),
    doc("trailer", trailers[0]._id, "insurance", "INS-9921", 22),
    doc("driver", drivers[0]._id, "prdp", "PrDP-5511", 210),
    doc("driver", drivers[1]._id, "drivers_licence", "DL-6620", 18),
  ]);

  // maintenance and tyres
  const lastService = daysAgo(70);
  const plans = await ServicePlan.create([
    { tenantId, assetType: "vehicle", assetId: daf._id, name: "Full service", intervalKm: 20000, intervalDays: 180, baselineKm: odo[daf._id] - 17500, baselineDate: lastService },
    { tenantId, assetType: "vehicle", assetId: scania._id, name: "Full service", intervalKm: 20000, intervalDays: 180, baselineKm: odo[scania._id] - 9800, baselineDate: daysAgo(120) },
    { tenantId, assetType: "vehicle", assetId: isuzu._id, name: "Oil and filters", intervalKm: 10000, intervalDays: 120, baselineKm: odo[isuzu._id] - 10600, baselineDate: daysAgo(100) },
    { tenantId, assetType: "trailer", assetId: trailers[0]._id, name: "Brakes and bearings", intervalDays: 180, baselineDate: daysAgo(150) },
  ]);
  await MaintenanceRecord.create([
    { tenantId, assetType: "vehicle", assetId: scania._id, date: daysAgo(12), odometer: odo[scania._id] - 2100, type: "repair", description: "Brake pads, front axle", supplier: "Harare Truck Centre", cost: 385 },
    { tenantId, assetType: "vehicle", assetId: daf._id, date: daysAgo(70), odometer: odo[daf._id] - 17500, type: "service", description: "Full service", supplier: "Harare Truck Centre", cost: 640, planId: plans[0]._id },
  ]);
  const tyres = await Tyre.create(
    [["BR-24811", 410], ["BR-24812", 410], ["BR-24813", 410], ["BR-24814", 410], ["MI-70211", 455], ["MI-70212", 455]].map(([serial, cost]) => ({
      tenantId, serial, serialKey: Tyre.toKey(serial), brand: serial.startsWith("BR") ? "Bridgestone" : "Michelin", size: "315/80R22.5", condition: "new", cost, purchasedAt: daysAgo(200), status: "in_stock",
    }))
  );
  const positions = ["Steer left", "Steer right", "Drive 1 outer left", "Drive 1 outer right"];
  for (const [i, tyre] of tyres.slice(0, 4).entries()) {
    await TyreFitment.create({ tenantId, tyreId: tyre._id, assetType: "vehicle", assetId: daf._id, position: positions[i], fittedAt: daysAgo(160), fittedOdometer: odo[daf._id] - 21000 });
    await Tyre.updateOne({ _id: tyre._id }, { $set: { status: "fitted" } });
  }

  const counts = {
    company: DEMO_NAME, vehicles: vehicles.length, trailers: trailers.length, drivers: drivers.length,
    jobLegs, trips: createdTrips.length, invoices: await Invoice.countDocuments({ tenantId }),
    payments: await Payment.countDocuments({ tenantId }), quotations: await Quotation.countDocuments({ tenantId }),
    documents: await ComplianceDoc.countDocuments({ tenantId }), tyres: tyres.length,
  };
  return { tenantId, counts, login: { email: DEMO_EMAIL, password: DEMO_PASSWORD } };
}

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
  const mongoose = require("mongoose");
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];

  const target = opt("target");
  if (!["local", "live"].includes(target)) throw new Error("Pass --target=local or --target=live");
  const writes = flag("apply") || flag("reset");
  if (target === "live" && writes && !flag("confirm-live")) throw new Error("Writing to live needs --confirm-live");
  const uri = target === "live" ? process.env.MONGO_URI_LIVE : process.env.OFFLINE_DB_URL;
  if (!uri) throw new Error(`No connection string configured for ${target}`);

  await mongoose.connect(uri);
  try {
    console.log(`Target: ${target} | database: ${mongoose.connection.db.databaseName}`);
    const existing = await require("../model/deliverer").countDocuments({ isDemo: true });
    if (!writes) {
      console.log(`DRY RUN. Demo companies present: ${existing}. Use --apply to (re)create, --reset to delete.`);
    } else if (flag("reset")) {
      console.log("Deleted:", JSON.stringify(await deleteDemo(mongoose)));
    } else {
      const today = opt("today") ? new Date(`${opt("today")}T00:00:00Z`) : new Date();
      const out = await seedDemo(mongoose, { today, seed: Number(opt("seed")) || 7 });
      console.log(JSON.stringify(out.counts, null, 2));
      console.log(`Demo login: ${out.login.email} / ${out.login.password}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { seedDemo, deleteDemo, DEMO_NAME, DEMO_EMAIL };
