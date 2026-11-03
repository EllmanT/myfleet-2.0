const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Vehicle = require("../model/vehicle");
const Trailer = require("../model/trailer");
const Contractor = require("../model/contractor");
const Customer = require("../model/customer");
const Driver = require("../model/driver");
const Job = require("../model/job");
const Trip = require("../model/trip");
const Tyre = require("../model/tyre");
const { clearModuleCache } = require("../middleware/moduleAccess");
const { planStatus } = require("../services/maintenance");
const app = require("../app");

const ON = { maintenance: true, crossBorder: true, tractorUnits: true };
const company = (modules = ON) =>
  Deliverer.create({ companyName: "Co " + Math.random().toString(36).slice(2, 6), address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"], modules });
async function cookie(co, role = "Deliverer Manager") {
  const u = await User.create({ name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123", phoneNumber: "1", role, address: "a", city: "c", companyId: co._id });
  return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY)];
}
async function truck(co, reg = "AFE5848") {
  const v = await Vehicle.create({ make: "DAF", regNumber: reg, size: "horse", companyId: String(co._id), tenantId: co._id });
  co.vehicle_ids.push(v._id);
  await co.save();
  return v;
}
// a job leg that moves the truck's odometer to `mileageIn`
async function leg(co, veh, mileageOut, mileageIn, date = "2026-10-05") {
  const con = (await Contractor.findOne({ tenantId: co._id })) || (await Contractor.create({ companyName: "Lammel", address: "a", city: "c", goodsTypes: ["g"], vehiclesTypes: ["v"], deliveryTypes: ["d"], tenantId: co._id }));
  const drv = (await Driver.findOne({ tenantId: co._id })) || (await Driver.create({ name: "Chris", phoneNumber: "1", address: "a", city: "c", idNumber: "1", id: "x", companyId: String(co._id), tenantId: co._id }));
  const [a, b] = await Customer.create([{ name: "A" + Math.random() }, { name: "B" + Math.random() }]);
  return Job.create({ jobNumber: "J" + Math.random(), from: a._id, customer: b._id, distance: mileageIn - mileageOut, cost: "10.00", mileageOut: String(mileageOut), mileageIn: String(mileageIn), orderDate: new Date(date), description: "d", deliveryType: "local", contractorId: con._id, vehicleId: veh._id, driverId: drv._id });
}

describe("planStatus", () => {
  const now = new Date("2026-11-03T10:00:00Z");
  test("km: ok, due soon, overdue", () => {
    expect(planStatus({ intervalKm: 10000, kmSince: 5000, now }).status).toBe("ok");
    expect(planStatus({ intervalKm: 10000, kmSince: 9500, now })).toMatchObject({ status: "due_soon", kmLeft: 500 });
    expect(planStatus({ intervalKm: 10000, kmSince: 10400, now })).toMatchObject({ status: "overdue", kmLeft: -400 });
  });
  test("days, and the worse of the two wins", () => {
    expect(planStatus({ intervalDays: 180, lastDate: "2026-05-01", now }).status).toBe("overdue");
    expect(planStatus({ intervalDays: 180, lastDate: "2026-05-15", now }).status).toBe("due_soon");
    expect(planStatus({ intervalDays: 180, lastDate: "2026-10-01", now }).status).toBe("ok");
    expect(planStatus({ intervalKm: 10000, kmSince: 11000, intervalDays: 180, lastDate: "2026-10-01", now }).status).toBe("overdue");
  });
  test("unknown distance doesn't invent a due date", () => {
    expect(planStatus({ intervalKm: 10000, kmSince: null, now })).toMatchObject({ status: "ok", kmLeft: null });
  });
});

describe("maintenance over HTTP", () => {
  let mongod;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await Tyre.syncIndexes();
    clearModuleCache();
  });
  const post = (ck, path, body) => request(app).post(`/api/v2/maintenance/${path}`).set("Cookie", ck).send(body);
  const get = (ck, path, query) => request(app).get(`/api/v2/maintenance/${path}`).set("Cookie", ck).query(query || {});

  test("a service plan reads the truck's odometer from its jobs and restarts when work is logged", async () => {
    const co = await company();
    const ck = await cookie(co);
    const v = await truck(co);
    await leg(co, v, 1000, 1500);

    const plan = await post(ck, "create-plan", { assetType: "vehicle", assetId: String(v._id), name: "Full service", intervalKm: 10000, baselineKm: 0, baselineDate: "2026-10-01" });
    expect(plan.status).toBe(201);
    expect(plan.body.plan).toMatchObject({ kmSince: 1500, kmLeft: 8500, status: "ok" });

    await leg(co, v, 10500, 10900); // odometer is now 10,900
    let plans = (await get(ck, "get-plans")).body;
    expect(plans.plans[0]).toMatchObject({ status: "overdue", kmLeft: -900 });
    expect(plans.overdue).toBe(1);

    const rec = await post(ck, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-11-02", odometer: 10900, type: "service", cost: 320.5, supplier: "Harare Truck Centre", planId: plan.body.plan._id });
    expect(rec.status).toBe(201);
    plans = (await get(ck, "get-plans")).body;
    expect(plans.plans[0]).toMatchObject({ status: "ok", kmSince: 0, lastDoneKm: 10900 });
  });

  test("a trailer's distance comes from its trips", async () => {
    const co = await company();
    const ck = await cookie(co);
    const t = await Trailer.create({ tenantId: co._id, regNumber: "ABC 123", regKey: "ABC123" });
    await Trip.create({ tenantId: co._id, date: new Date("2026-10-10"), customerName: "X", price: 1, distanceKm: 4000, trailerId: t._id, stops: [{ place: "A" }, { place: "B" }] });
    await Trip.create({ tenantId: co._id, date: new Date("2026-10-20"), customerName: "X", price: 1, distanceKm: 2500, trailerId: t._id, stops: [{ place: "A" }, { place: "B" }] });
    const plan = await post(ck, "create-plan", { assetType: "trailer", assetId: String(t._id), name: "Brakes & bearings", intervalKm: 6000, baselineDate: "2026-10-01" });
    expect(plan.body.plan).toMatchObject({ kmSince: 6500, status: "overdue" });
    expect((await post(ck, "create-record", { assetType: "trailer", assetId: String(t._id), date: "2026-11-01", odometer: 100 })).status).toBe(400);
  });

  test("records and plans validate input", async () => {
    const co = await company();
    const ck = await cookie(co);
    const v = await truck(co);
    const rec = (over) => post(ck, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-11-01", ...over });
    expect((await rec({ date: "nope" })).status).toBe(400);
    expect((await rec({ cost: -5 })).status).toBe(400);
    expect((await rec({ assetType: "boat" })).status).toBe(400);
    const plan = (over) => post(ck, "create-plan", { assetType: "vehicle", assetId: String(v._id), name: "S", intervalKm: 5000, ...over });
    expect((await plan({ name: "" })).status).toBe(400);
    expect((await plan({ intervalKm: undefined })).status).toBe(400);
    expect((await plan({ intervalKm: 0 })).status).toBe(400);
  });

  test("tyres: unique serial, fit, position clash, remove, cost per km", async () => {
    const co = await company();
    const ck = await cookie(co);
    const v = await truck(co);
    const mk = (serial) => post(ck, "create-tyre", { serial, brand: "Bridgestone", size: "315/80R22.5", cost: 400 });
    const t1 = await mk("BS 001");
    expect(t1.status).toBe(201);
    expect((await mk("bs001")).status).toBe(409);
    const t2 = await mk("BS 002");

    const fit = (tyreId, position, odo) => post(ck, "fit-tyre", { tyreId, assetType: "vehicle", assetId: String(v._id), position, fittedAt: "2026-09-01", fittedOdometer: odo });
    const f1 = await fit(t1.body.tyre._id, "Steer left", 100000);
    expect(f1.status).toBe(201);
    expect((await fit(t1.body.tyre._id, "Steer right", 100000)).status).toBe(409); // already fitted
    expect((await fit(t2.body.tyre._id, "Steer left", 100000)).status).toBe(409); // position taken

    const tooLow = await post(ck, "remove-tyre/" + f1.body.fitment._id, { removedOdometer: 99000 });
    expect(tooLow.status).toBe(400);
    const removed = await post(ck, "remove-tyre/" + f1.body.fitment._id, { removedAt: "2026-10-30", removedOdometer: 120000, reason: "worn" });
    expect(removed.status).toBe(200);

    const tyres = (await get(ck, "get-tyres")).body.tyres;
    const first = tyres.find((t) => t.serial === "BS 001");
    expect(first).toMatchObject({ status: "in_stock", totalKm: 20000, costPerKm: 0.02, fittedTo: null });

    // it was fitted once, so it can't be deleted, but it can be refitted or scrapped
    expect((await request(app).delete(`/api/v2/maintenance/delete-tyre/${t1.body.tyre._id}`).set("Cookie", ck)).status).toBe(409);
    expect((await request(app).delete(`/api/v2/maintenance/delete-tyre/${t2.body.tyre._id}`).set("Cookie", ck)).status).toBe(200);
    const again = await fit(t1.body.tyre._id, "Steer left", 120000);
    expect(again.status).toBe(201);
    await post(ck, "remove-tyre/" + again.body.fitment._id, { removedOdometer: 120500, scrap: true });
    expect((await Tyre.findById(t1.body.tyre._id)).status).toBe("scrapped");
    expect((await fit(t1.body.tyre._id, "Steer left", 120500)).status).toBe(409);
  });

  test("cost per km for a truck: workshop spend plus an estimate for fitted tyres", async () => {
    const co = await company();
    const ck = await cookie(co);
    const v = await truck(co);
    await leg(co, v, 100000, 101000, "2026-10-05"); // 1,000 km on jobs
    await Trip.create({ tenantId: co._id, date: new Date("2026-10-12"), customerName: "X", price: 1, distanceKm: 1000, horseId: v._id, stops: [{ place: "A" }, { place: "B" }] }); // +1,000 km
    await post(ck, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-10-15", cost: 300, type: "repair" });
    await post(ck, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-10-20", cost: 100, type: "service" });
    const t = await post(ck, "create-tyre", { serial: "T1", cost: 500 });
    await post(ck, "fit-tyre", { tyreId: t.body.tyre._id, assetType: "vehicle", assetId: String(v._id), position: "Drive 1", fittedAt: "2026-09-01", fittedOdometer: 100000 });

    const res = await get(ck, "truck-costs", { vehicleId: String(v._id), from: "2026-10-01", to: "2026-10-31" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ km: 2000, maintenance: 400, maintenancePerKm: 0.2, tyresFitted: 1, tyresCounted: 1 });
    expect(res.body.tyreEstimate).toBeCloseTo(1000, 0); // 500 / 1000 km run * 2,000 km
    expect(res.body.totalPerKm).toBeCloseTo(0.7, 2);
  });

  test("tenant isolation and module gating", async () => {
    const a = await company();
    const b = await company();
    const ca = await cookie(a);
    const cb = await cookie(b);
    const v = await truck(a);
    const rec = await post(ca, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-11-01", cost: 50 });
    expect((await get(cb, "get-records")).body.records).toHaveLength(0);
    expect((await request(app).delete(`/api/v2/maintenance/delete-record/${rec.body.record._id}`).set("Cookie", cb)).status).toBe(404);
    // can't log work on, or plan for, another company's truck
    expect((await post(cb, "create-record", { assetType: "vehicle", assetId: String(v._id), date: "2026-11-01" })).status).toBe(404);
    expect((await post(cb, "create-plan", { assetType: "vehicle", assetId: String(v._id), name: "S", intervalKm: 100 })).status).toBe(404);
    expect((await get(cb, "truck-costs", { vehicleId: String(v._id) })).status).toBe(404);
    // can't fit another company's tyre
    const tyre = await post(ca, "create-tyre", { serial: "X1" });
    const vb = await truck(b, "BBB2222");
    expect((await post(cb, "fit-tyre", { tyreId: tyre.body.tyre._id, assetType: "vehicle", assetId: String(vb._id), position: "P" })).status).toBe(404);

    const off = await company({ maintenance: false });
    const blocked = await get(await cookie(off), "get-plans");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MODULE_DISABLED");
  });
});
