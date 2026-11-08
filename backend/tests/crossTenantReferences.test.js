/*
 * A signed-in user of company B must not be able to POINT their own records at company A's.
 * The route-level matrix (tenantIsolation.test.js) probes by-id access; these cover ids sent
 * inside a body or query that a handler then trusts (job references, exports scoped by
 * entityId). They run with the tenant guard OFF, the default, so the checks must live in the
 * routes themselves and not depend on the guard.
 */
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
delete process.env.TENANT_GUARD;

const app = require("../app");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Job = require("../model/job");
const Driver = require("../model/driver");
const Vehicle = require("../model/vehicle");
const Contractor = require("../model/contractor");
const Customer = require("../model/customer");
const Rate = require("../model/rate");
const { seedAuthFixture, buildJobPayload } = require("./helpers/seedStatsFixtures");

jest.setTimeout(120000);

// Company B: its own full set of records, stamped with B's tenantId.
async function seedCompanyB() {
  const b = await Deliverer.create({
    companyName: "Company B",
    address: "B Street",
    city: "Bulawayo",
    goodsType: ["general"],
    vehiclesType: ["small"],
    deliveryType: ["standard"],
  });
  const tenantId = b._id;
  const [from, to] = await Customer.create([
    { name: "B From", city: "Bulawayo", phoneNumber: "1", address: "x", tenantId },
    { name: "B To", city: "Bulawayo", phoneNumber: "2", address: "y", tenantId },
  ]);
  const contractor = await Contractor.create({
    companyName: "B Contractor",
    address: "a",
    city: "Bulawayo",
    goodsTypes: ["general"],
    vehiclesTypes: ["small"],
    deliveryTypes: ["standard"],
    tenantId,
  });
  const driver = await Driver.create({
    name: "B Driver",
    phoneNumber: "9",
    address: "a",
    city: "Bulawayo",
    idNumber: "B-ID",
    id: "B-DRV",
    companyId: String(tenantId),
    tenantId,
  });
  const vehicle = await Vehicle.create({ make: "Isuzu", companyId: String(tenantId), size: "small", regNumber: "B-123", tenantId });
  b.customer_ids = [from._id, to._id];
  b.contractor_ids = [contractor._id];
  b.driver_ids = [driver._id];
  b.vehicle_ids = [vehicle._id];
  await b.save();
  const user = await User.create({
    name: "B Admin",
    email: "admin@company-b.test",
    password: "password123",
    phoneNumber: "5",
    role: "Deliverer Admin",
    address: "B",
    city: "Bulawayo",
    companyId: tenantId,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });
  return { b, from, to, contractor, driver, vehicle, cookie: [`token=${token}`] };
}

describe("references to another company's records are refused", () => {
  let mongod;
  let a; // company A (seedAuthFixture)
  let b;
  let aCookie;
  let aJob; // a job that belongs to A

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    a = await seedAuthFixture();
    aCookie = [`token=${a.token}`];
    b = await seedCompanyB();
    const created = await request(app)
      .post("/api/v2/job/create-job")
      .set("Cookie", aCookie)
      .send([
        {
          ...buildJobPayload({
            from: a.fromCustomer._id,
            customer: a.toCustomer._id,
            contractorId: a.contractorA._id,
            vehicleId: a.vehicleA._id,
            driverId: a.driverA._id,
          }),
          jobNumber: "A-SECRET-JOB",
        },
      ]);
    expect(created.status).toBe(201);
    aJob = await Job.findOne({ jobNumber: "A-SECRET-JOB" });
  });

  const bJobPayload = (over = {}) => ({
    ...buildJobPayload({
      from: b.from._id,
      customer: b.to._id,
      contractorId: b.contractor._id,
      vehicleId: b.vehicle._id,
      driverId: b.driver._id,
      ...over,
    }),
    jobNumber: over.jobNumber || "B-1",
  });

  const snapshotA = async () => ({
    driver: (await Driver.findById(a.driverA._id).lean()).job_ids.map(String),
    vehicle: (await Vehicle.findById(a.vehicleA._id).lean()).job_ids.map(String),
    contractor: (await Contractor.findById(a.contractorA._id).lean()).job_ids.map(String),
  });

  test("control: B can create a job from its own records", async () => {
    const res = await request(app).post("/api/v2/job/create-job").set("Cookie", b.cookie).send([bJobPayload()]);
    expect(res.status).toBe(201);
    const job = await Job.findOne({ jobNumber: "B-1" });
    expect(String(job.tenantId)).toBe(String(b.b._id));
  });

  test.each([
    ["vehicle", { vehicleId: () => a.vehicleA._id }],
    ["driver", { driverId: () => a.driverA._id }],
    ["contractor", { contractorId: () => a.contractorA._id }],
    ["pickup customer", { from: () => a.fromCustomer._id }],
    ["delivery customer", { customer: () => a.toCustomer._id }],
  ])("create-job with A's %s is refused and A's records are untouched", async (_name, over) => {
    const before = await snapshotA();
    const resolved = Object.fromEntries(Object.entries(over).map(([k, fn]) => [k, fn()]));
    const res = await request(app)
      .post("/api/v2/job/create-job")
      .set("Cookie", b.cookie)
      .send([bJobPayload(resolved)]);
    expect(res.status).toBe(400);
    expect(await Job.countDocuments({ jobNumber: "B-1" })).toBe(0);
    expect(await snapshotA()).toEqual(before);
  });

  test("create-job: one bad leg in a batch rejects the whole batch", async () => {
    const res = await request(app)
      .post("/api/v2/job/create-job")
      .set("Cookie", b.cookie)
      .send([bJobPayload({ jobNumber: "B-OK" }), bJobPayload({ jobNumber: "B-BAD", driverId: a.driverA._id })]);
    expect(res.status).toBe(400);
    expect(await Job.countDocuments({ jobNumber: { $in: ["B-OK", "B-BAD"] } })).toBe(0);
  });

  describe("update-job", () => {
    let bJob;
    beforeEach(async () => {
      await request(app).post("/api/v2/job/create-job").set("Cookie", b.cookie).send([bJobPayload()]);
      bJob = await Job.findOne({ jobNumber: "B-1" });
    });

    test.each([
      ["driverId", () => a.driverA._id],
      ["vehicleId", () => a.vehicleA._id],
      ["contractorId", () => a.contractorA._id],
      ["fromId", () => a.fromCustomer._id],
      ["pageCustomerId", () => a.toCustomer._id],
    ])("pointing B's job at A's %s is refused", async (field, valueFn) => {
      const before = await snapshotA();
      const res = await request(app)
        .put("/api/v2/job/update-job")
        .set("Cookie", b.cookie)
        .send({ jobId: bJob._id, [field]: valueFn() });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await snapshotA()).toEqual(before);
      const after = await Job.findById(bJob._id).lean();
      expect(String(after.driverId)).toBe(String(b.driver._id));
      expect(String(after.vehicleId)).toBe(String(b.vehicle._id));
      expect(String(after.contractorId)).toBe(String(b.contractor._id));
    });

    test("control: B can edit its own job, including swapping in its own records", async () => {
      const res = await request(app)
        .put("/api/v2/job/update-job")
        .set("Cookie", b.cookie)
        .send({ jobId: bJob._id, description: "edited", driverId: b.driver._id });
      expect(res.status).toBe(201);
    });

    test("B cannot update A's job at all", async () => {
      const res = await request(app)
        .put("/api/v2/job/update-job")
        .set("Cookie", b.cookie)
        .send({ jobId: aJob._id, description: "hijacked" });
      expect(res.status).toBe(404);
      expect((await Job.findById(aJob._id).lean()).description).toBe("Test job");
    });
  });

  describe("job exports scoped by entityId", () => {
    const routes = ["/api/v2/job/export-jobs-csv", "/api/v2/job/export-jobs-pdf"];
    const scopes = [
      ["contractor", () => a.contractorA._id],
      ["driver", () => a.driverA._id],
      ["vehicle", () => a.vehicleA._id],
    ];

    test.each(routes.flatMap((r) => scopes.map(([s, fn]) => [r, s, fn])))(
      "%s with scope=%s on A's entity does not export A's jobs",
      async (route, scope, idFn) => {
        const res = await request(app)
          .get(`${route}?scope=${scope}&entityId=${idFn()}&year=all`)
          .set("Cookie", b.cookie)
          .buffer(true)
          .parse((r, cb) => {
            const chunks = [];
            r.on("data", (c) => chunks.push(c));
            r.on("end", () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(404);
        expect(res.body.toString()).not.toContain("A-SECRET-JOB");
      }
    );

    test("control: A can export its own contractor's jobs as CSV", async () => {
      const res = await request(app)
        .get(`/api/v2/job/export-jobs-csv?scope=contractor&entityId=${a.contractorA._id}&year=all`)
        .set("Cookie", aCookie);
      expect(res.status).toBe(200);
      expect(res.text).toContain("A-SECRET-JOB");
    });

    test("the company-wide export only contains the caller's jobs", async () => {
      const res = await request(app).get("/api/v2/job/export-jobs-csv?year=all").set("Cookie", b.cookie);
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("A-SECRET-JOB");
    });
  });
  describe("update-contractor rates", () => {
    const rates = JSON.stringify([{ rateType: "standard", smallVehicle: 1, largeVehicle: 2, mediumVehicle: 3, horse: 4 }]);
    const body = (compId, rateId) => ({
      compId: String(compId),
      rateId: String(rateId),
      companyName: "Renamed",
      address: "a",
      city: "Harare",
      contact: "1",
      goodsTypes: ["general"],
      deliveryTypes: ["standard"],
      vehiclesTypes: ["small"],
      stringRates: rates,
    });
    let aRate;
    let bRate;
    beforeEach(async () => {
      aRate = await Rate.create({ deliverer: a.deliverer._id, contractor: a.contractorA._id, rateTypes: [{ rateType: "standard", smallVehicle: 99 }] });
      bRate = await Rate.create({ deliverer: b.b._id, contractor: b.contractor._id, rateTypes: [{ rateType: "standard", smallVehicle: 50 }] });
    });

    test("B cannot overwrite A's rate by naming its rateId on B's own contractor", async () => {
      const res = await request(app).put("/api/v2/contractor/update-contractor").set("Cookie", b.cookie).send(body(b.contractor._id, aRate._id));
      expect(res.status).toBeGreaterThanOrEqual(400);
      const after = await Rate.findById(aRate._id).lean();
      expect(after.rateTypes[0].smallVehicle).toBe(99);
    });

    test("B cannot use a rate of another of its contractors, or an invalid id", async () => {
      const other = await Contractor.create({ companyName: "B Other", address: "a", city: "H", goodsTypes: ["g"], vehiclesTypes: ["small"], deliveryTypes: ["standard"], tenantId: b.b._id });
      await Deliverer.updateOne({ _id: b.b._id }, { $push: { contractor_ids: other._id } });
      const res = await request(app).put("/api/v2/contractor/update-contractor").set("Cookie", b.cookie).send(body(other._id, bRate._id));
      expect(res.status).toBe(400);
      expect((await request(app).put("/api/v2/contractor/update-contractor").set("Cookie", b.cookie).send(body(b.contractor._id, "nope"))).status).toBe(400);
      expect((await Rate.findById(bRate._id).lean()).rateTypes[0].smallVehicle).toBe(50);
    });

    test("control: B can update its own contractor's rate", async () => {
      const res = await request(app).put("/api/v2/contractor/update-contractor").set("Cookie", b.cookie).send(body(b.contractor._id, bRate._id));
      expect(res.status).toBe(201);
      expect((await Rate.findById(bRate._id).lean()).rateTypes[0].smallVehicle).toBe(1);
    });
  });
});
