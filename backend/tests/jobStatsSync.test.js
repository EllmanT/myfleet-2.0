const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const OverallStats = require("../model/overallStats");
const DriverStats = require("../model/driverStats");
const VehicleStats = require("../model/vehicleStats");
const ContractorStats = require("../model/contractorStats");
const Job = require("../model/job");
const {
  seedAuthFixture,
  buildJobPayload,
} = require("./helpers/seedStatsFixtures");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
const app = require("../app");

function n(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value.toString());
}

function expectNoMonth(doc, month) {
  expect((doc.monthlyData || []).some((m) => m.month === month)).toBe(false);
}

function expectNoDate(doc, date) {
  expect((doc.dailyData || []).some((d) => d.date === date)).toBe(false);
}

function formatLocalDate(dateInput) {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function createBaseJob(cookie, fixture, overrides = {}) {
  const payload = buildJobPayload({
    from: fixture.fromCustomer._id,
    customer: fixture.toCustomer._id,
    contractorId: fixture.contractorA._id,
    vehicleId: fixture.vehicleA._id,
    driverId: fixture.driverA._id,
    ...overrides,
  });

  const res = await request(app)
    .post("/api/v2/job/create-job")
    .set("Cookie", cookie)
    .send([payload]);

  if (res.status !== 201) {
    throw new Error(`Create failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  expect(res.status).toBe(201);
  const created = await Job.findOne({ jobNumber: payload.jobNumber });
  expect(created).toBeTruthy();
  return created;
}

describe("Job CRUD stats consistency", () => {
  let mongod;

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
  });

  test("change job month moves stats and removes stale month/day", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture, {
      orderDate: "2026-01-10T12:00:00.000Z",
    });

    const updateRes = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, orderDatee: "2026-02-20T12:00:00.000Z" });
    expect(updateRes.status).toBe(201);

    const updatedJob = await Job.findById(created._id);
    const newDate = formatLocalDate(updatedJob.orderDate);
    const newMonth = new Date(updatedJob.orderDate).toLocaleString("default", {
      month: "long",
    });

    const overallDocs = await OverallStats.find({
      companyId: fixture.deliverer._id,
    });
    const overall = overallDocs.find((doc) => (doc.monthlyData || []).some((m) => m.month === newMonth));
    expect(overall).toBeTruthy();
    expect(overall.yearlyJobs).toBe(1);
    expectNoMonth(overall, "January");
    expectNoDate(overall, "2026-01-10");
    expect(overall.monthlyData.find((m) => m.month === newMonth).totalJobs).toBe(1);
    expect(overall.dailyData.find((d) => d.date === newDate).totalJobs).toBe(1);
  });

  test("delete job removes totals and stale daily/monthly buckets", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture);

    const delRes = await request(app)
      .delete(`/api/v2/job/delete-job/${created._id}`)
      .set("Cookie", cookie);
    expect(delRes.status).toBe(201);

    const overall = await OverallStats.findOne({
      companyId: fixture.deliverer._id,
      year: 2026,
    });
    expect(overall.yearlyJobs).toBe(0);
    expect(overall.monthlyData.length).toBe(0);
    expect(overall.dailyData.length).toBe(0);
  });

  test("edit amount updates revenue/profit across stats", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture, { cost: 100 });

    const res = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, cost: 175.5 });
    expect(res.status).toBe(201);

    const overall = await OverallStats.findOne({
      companyId: fixture.deliverer._id,
      year: 2026,
    });
    const driverStats = await DriverStats.findOne({
      driverId: String(fixture.driverA._id),
      year: 2026,
    });
    expect(n(overall.yearlyRevenue)).toBeCloseTo(175.5, 2);
    expect(n(overall.yearlyProfit)).toBeCloseTo(175.5, 2);
    expect(n(driverStats.yearlyRevenue)).toBeCloseTo(175.5, 2);
  });

  test("edit day/date moves daily bucket without stale data", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture, {
      orderDate: "2026-01-10T12:00:00.000Z",
    });

    const res = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, orderDatee: "2026-01-25T12:00:00.000Z" });
    expect(res.status).toBe(201);

    const updatedJob = await Job.findById(created._id);
    const newDate = formatLocalDate(updatedJob.orderDate);
    const newMonth = new Date(updatedJob.orderDate).toLocaleString("default", {
      month: "long",
    });

    const overallDocs = await OverallStats.find({
      companyId: fixture.deliverer._id,
    });
    const overall = overallDocs.find((doc) => (doc.dailyData || []).some((d) => d.date === newDate));
    expect(overall).toBeTruthy();
    expectNoDate(overall, "2026-01-10");
    expect(overall.dailyData.find((d) => d.date === newDate).totalJobs).toBe(1);
    expect(overall.monthlyData.find((m) => m.month === newMonth).totalJobs).toBe(1);
  });

  test("edit contractor reassigns stats and contractor mappings", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture);

    const res = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, contractorId: fixture.contractorB._id });
    expect(res.status).toBe(201);

    const oldContractorStats = await ContractorStats.findOne({
      contractorId: String(fixture.contractorA._id),
      delivererId: String(fixture.deliverer._id),
      year: 2026,
    });
    const newContractorStats = await ContractorStats.findOne({
      contractorId: String(fixture.contractorB._id),
      delivererId: String(fixture.deliverer._id),
      year: 2026,
    });
    expect(oldContractorStats.yearlyJobs).toBe(0);
    expect(newContractorStats.yearlyJobs).toBe(1);
  });

  test("edit job type leaves stats unchanged", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture);

    const before = await OverallStats.findOne({
      companyId: fixture.deliverer._id,
      year: 2026,
    }).lean();

    const res = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, deliveryType: "express" });
    expect(res.status).toBe(201);

    const after = await OverallStats.findOne({
      companyId: fixture.deliverer._id,
      year: 2026,
    }).lean();

    expect(after.yearlyJobs).toBe(before.yearlyJobs);
    expect(n(after.yearlyRevenue)).toBeCloseTo(n(before.yearlyRevenue), 2);
    expect(after.monthlyData.length).toBe(before.monthlyData.length);
    expect(after.dailyData.length).toBe(before.dailyData.length);
  });

  test("edit vehicle reassigns vehicle stats correctly", async () => {
    const fixture = await seedAuthFixture();
    const cookie = [`token=${fixture.token}`];
    const created = await createBaseJob(cookie, fixture);

    const res = await request(app)
      .put("/api/v2/job/update-job")
      .set("Cookie", cookie)
      .send({ jobId: created._id, vehicleId: fixture.vehicleB._id });
    expect(res.status).toBe(201);

    const oldVehicleStats = await VehicleStats.findOne({
      vehicleId: String(fixture.vehicleA._id),
      year: 2026,
    });
    const newVehicleStats = await VehicleStats.findOne({
      vehicleId: String(fixture.vehicleB._id),
      year: 2026,
    });
    expect(oldVehicleStats.yearlyJobs).toBe(0);
    expect(newVehicleStats.yearlyJobs).toBe(1);
  });
});
