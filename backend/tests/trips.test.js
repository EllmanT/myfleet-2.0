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
const { clearModuleCache } = require("../middleware/moduleAccess");
const { withTotals, detectCrossBorder } = require("../utils/tripMath");
const { statusOf } = require("../controller/compliance");
const app = require("../app");

const ON = { tractorUnits: true, crossBorder: true, analytics: true };

async function makeCompany(modules = ON) {
  return Deliverer.create({
    companyName: "Co " + Math.random().toString(36).slice(2, 7),
    address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"],
    modules,
  });
}
async function cookieFor(company, role = "Deliverer Admin") {
  const u = await User.create({
    name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123",
    phoneNumber: "1", role, address: "a", city: "c", companyId: company._id,
  });
  return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY)];
}
async function makeHorse(company, reg = "AFE5848") {
  const v = await Vehicle.create({ make: "DAF", regNumber: reg, size: "horse", companyId: String(company._id), tenantId: company._id });
  company.vehicle_ids.push(v._id);
  await company.save();
  return v;
}

const baseTrip = (over = {}) => ({
  clientRef: "AL.01",
  date: "2026-10-01",
  customerName: "Bonds",
  supplierName: "Fertilizer Co",
  cargoDescription: "Fertilizer",
  stops: [{ place: "Harare", country: "ZW" }, { place: "Johannesburg", country: "SA" }],
  price: 1800,
  distanceKm: 1100,
  ...over,
});

describe("trip helpers", () => {
  test("cross-border is derived from the countries of the stops", () => {
    expect(detectCrossBorder([{ country: "ZW" }, { country: "SA" }])).toBe(true);
    expect(detectCrossBorder([{ country: "zw" }, { country: "ZW" }])).toBe(false);
    expect(detectCrossBorder([{ place: "x" }, { place: "y" }])).toBe(false);
  });
  test("margin = price - costs in the same currency; mixed currencies are not guessed", () => {
    const same = withTotals({ price: 1000, currency: "USD", costLines: [{ amount: 200, currency: "USD" }, { amount: 50.5, currency: "USD" }] });
    expect(same.totalCosts).toBe(250.5);
    expect(same.margin).toBe(749.5);
    const mixed = withTotals({ price: 1000, currency: "USD", costLines: [{ amount: 200, currency: "USD" }, { amount: 900, currency: "ZAR" }] });
    expect(mixed.mixedCurrency).toBe(true);
    expect(mixed.margin).toBeNull();
  });
  test("document status around the expiry date", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    expect(statusOf("2026-11-02", now).status).toBe("expired");
    expect(statusOf("2026-11-03", now).status).toBe("due_soon");
    expect(statusOf("2026-12-03", now).status).toBe("due_soon");
    expect(statusOf("2026-12-04", now).status).toBe("ok");
  });
});

describe("trips, trailers and documents over HTTP", () => {
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
    await Trailer.syncIndexes();
    await require("../model/trip").syncIndexes();
    clearModuleCache();
  });

  test("creates a cross-border trip with costs and computes the margin", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const horse = await makeHorse(co);
    const tr = await request(app).post("/api/v2/trailer/create-trailer").set("Cookie", cookie).send({ regNumber: "ABC 123", type: "flatbed" });
    expect(tr.status).toBe(201);

    const res = await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(
      baseTrip({
        horseId: String(horse._id),
        trailerId: tr.body.trailer._id,
        costLines: [{ type: "border_fee", amount: 120 }, { type: "fuel", amount: 400 }],
        borderCrossings: [{ post: "Beitbridge", direction: "out" }],
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.trip.isCrossBorder).toBe(true);
    expect(res.body.trip.totalCosts).toBe(520);
    expect(res.body.trip.margin).toBe(1280);
    expect(res.body.trip.status).toBe("planned");
  });

  test("rejects bad input with clear errors", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const post = (body) => request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(body);

    expect((await post(baseTrip({ customerName: "" }))).status).toBe(400);
    expect((await post(baseTrip({ stops: [{ place: "Harare" }] }))).status).toBe(400);
    expect((await post(baseTrip({ price: -5 }))).status).toBe(400);
    expect((await post(baseTrip({ price: undefined }))).status).toBe(400);
    expect((await post(baseTrip({ date: "not a date" }))).status).toBe(400);
    expect((await post(baseTrip({ deliveredAt: "2026-09-01" }))).status).toBe(400);
    expect((await post(baseTrip({ costLines: [{ type: "fuel", amount: -1 }] }))).status).toBe(400);
  });

  test("a job reference can't be reused in one company, but another company may use it", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const cb = await cookieFor(b);
    const send = (cookie) => request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(baseTrip());
    expect((await send(ca)).status).toBe(201);
    expect((await send(ca)).status).toBe(409);
    expect((await send(cb)).status).toBe(201);
  });

  test("tenant isolation: another company can't list, edit or delete my trips", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const cb = await cookieFor(b);
    const made = await request(app).post("/api/v2/trip/create-trip").set("Cookie", ca).send(baseTrip());
    const id = made.body.trip._id;

    const list = await request(app).get("/api/v2/trip/get-trips").set("Cookie", cb);
    expect(list.body.total).toBe(0);
    expect((await request(app).put(`/api/v2/trip/update-trip/${id}`).set("Cookie", cb).send(baseTrip({ price: 1 }))).status).toBe(404);
    expect((await request(app).delete(`/api/v2/trip/delete-trip/${id}`).set("Cookie", cb)).status).toBe(404);
    expect((await request(app).get("/api/v2/trip/get-trips").set("Cookie", ca)).body.total).toBe(1);
  });

  test("a trip can't use another company's truck or trailer", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const foreignHorse = await makeHorse(b, "BBB2222");
    const foreignTrailer = await Trailer.create({ tenantId: b._id, regNumber: "ZZ1", regKey: "ZZ1" });
    const post = (extra) => request(app).post("/api/v2/trip/create-trip").set("Cookie", ca).send(baseTrip(extra));
    expect((await post({ horseId: String(foreignHorse._id) })).status).toBe(404);
    expect((await post({ trailerId: String(foreignTrailer._id) })).status).toBe(404);
  });

  test("update can clear optional fields and edit the route", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const horse = await makeHorse(co);
    const made = await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie)
      .send(baseTrip({ horseId: String(horse._id), deliveredAt: "2026-10-05" }));
    const id = made.body.trip._id;
    const upd = await request(app).put(`/api/v2/trip/update-trip/${id}`).set("Cookie", cookie)
      .send({ horseId: "", deliveredAt: "", stops: [{ place: "Harare", country: "ZW" }, { place: "Bulawayo", country: "ZW" }] });
    expect(upd.status).toBe(200);
    expect(upd.body.trip.horseId).toBeUndefined();
    expect(upd.body.trip.deliveredAt).toBeUndefined();
    expect(upd.body.trip.isCrossBorder).toBe(false);
  });

  test("summary adds up revenue, costs and kilometres, and skips cancelled trips", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const post = (body) => request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(body);
    await post(baseTrip({ clientRef: "A1", price: 1000, distanceKm: 500, costLines: [{ type: "fuel", amount: 300 }] }));
    await post(baseTrip({ clientRef: "A2", price: 500, distanceKm: 100, stops: [{ place: "Harare", country: "ZW" }, { place: "Mutare", country: "ZW" }] }));
    await post(baseTrip({ clientRef: "A3", price: 9999, status: "cancelled" }));
    const s = await request(app).get("/api/v2/trip/summary").set("Cookie", cookie);
    expect(s.body.trips).toBe(2);
    expect(s.body.crossBorderTrips).toBe(1);
    expect(s.body.distanceKm).toBe(600);
    expect(s.body.byCurrency.USD).toEqual({ revenue: 1500, costs: 300 });
  });

  test("search finds a trip by client, reference or place, treating the text literally", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(baseTrip());
    const find = (search) => request(app).get("/api/v2/trip/get-trips").query({ search }).set("Cookie", cookie);
    expect((await find("bonds")).body.total).toBe(1);
    expect((await find("AL.01")).body.total).toBe(1);
    expect((await find("johannes")).body.total).toBe(1);
    expect((await find("(a+)+$")).body.total).toBe(0);
  });

  test("trips are blocked when the cross-border module is switched off", async () => {
    const co = await makeCompany({ ...ON, crossBorder: false });
    const cookie = await cookieFor(co);
    const res = await request(app).get("/api/v2/trip/get-trips").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MODULE_DISABLED");
  });

  test("trailers: one per registration per company, and a used trailer can't be deleted", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const make = (reg) => request(app).post("/api/v2/trailer/create-trailer").set("Cookie", cookie).send({ regNumber: reg });
    const first = await make("ABC 123");
    expect(first.status).toBe(201);
    expect((await make("abc123")).status).toBe(409);

    await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send(baseTrip({ trailerId: first.body.trailer._id }));
    const del = await request(app).delete(`/api/v2/trailer/delete-trailer/${first.body.trailer._id}`).set("Cookie", cookie);
    expect(del.status).toBe(409);
  });

  test("compliance documents: warn about expired and soon-to-expire, owned items only", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const horse = await makeHorse(a);
    const foreign = await makeHorse(b, "BBB2222");
    const day = 24 * 60 * 60 * 1000;
    const iso = (offset) => new Date(Date.now() + offset * day).toISOString().slice(0, 10);
    const add = (extra) => request(app).post("/api/v2/compliance/create-doc").set("Cookie", ca)
      .send({ ownerType: "vehicle", ownerId: String(horse._id), docType: "yellow_card", ...extra });

    expect((await add({ expiresAt: iso(-3) })).status).toBe(201);
    expect((await add({ docType: "roadworthy", expiresAt: iso(10) })).status).toBe(201);
    expect((await add({ docType: "insurance", expiresAt: iso(200) })).status).toBe(201);

    const exp = await request(app).get("/api/v2/compliance/expiring").set("Cookie", ca);
    expect(exp.body.expired).toHaveLength(1);
    expect(exp.body.dueSoon).toHaveLength(1);
    expect(exp.body.expired[0].ownerName).toContain("AFE5848");

    expect((await add({ ownerId: String(foreign._id), expiresAt: iso(5) })).status).toBe(404);
    expect((await add({ expiresAt: "" })).status).toBe(400);
    expect((await add({ issuedAt: iso(50), expiresAt: iso(20) })).status).toBe(400);
  });
});
