const mongoose = require("mongoose");
const request = require("supertest");
const XLSX = require("xlsx");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const Contractor = require("../model/contractor");
const Driver = require("../model/driver");
const Vehicle = require("../model/vehicle");
const Customer = require("../model/customer");
const Rate = require("../model/rate");
const Job = require("../model/job");
const OverallStats = require("../model/overallStats");
const ContractorStats = require("../model/contractorStats");
const User = require("../model/user");
const jwt = require("jsonwebtoken");
const { buildImportPreview } = require("../services/jobImport/buildImportPreview");
const { commitImport } = require("../services/jobImport/commitImport");
const { seedAuthFixture, buildJobPayload } = require("./helpers/seedStatsFixtures");
const app = require("../app");

const HEADER = [
  "Driver",
  "Date",
  "Time Out",
  "Mileage Out",
  "From",
  "To",
  "Mileage In",
  "Time In",
  "Total KM",
  "Authorised By",
  "Type",
];

// Mirrors the layout of the real "Toyota_Dyna_AAV4331_Vehicle_Log.xlsx".
function buildWorkbook(rows, title = "TOYOTA DYNA – AAV 4331") {
  const sheet = XLSX.utils.aoa_to_sheet([[title], HEADER, ...rows, [null, null, null, null, null, null, null, "TOTAL", 0]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Vehicle Log");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

const d = (day) => `${String(day).padStart(2, "0")}/09/2026`;
const SAMPLE_ROWS = [
  // one RK job, 3 legs
  ["CHRIS", d(2), "10:00", 1000, "SHIPPY", "LAMMEL", 1004, "", 4, "ROMEO", ""],
  ["CHRIS", d(2), "", 1004, "LAMMEL", "MUCHENA", 1018, "", 14, "ROMEO", ""],
  ["CHRIS", d(2), "", 1018, "MUCHENA", "SHIPPY", 1032, "", 14, "ROMEO", ""],
  // private + blank contractor are skipped
  ["CHAMU", d(7), "", 1032, "SHIPPY", "LAMMEL", 1041, "", 9, "", ""],
  ["CHAMU", d(7), "", 1041, "LAMMEL", "SHIPPY", 1045, "", 4, "PVT", ""],
  // contractor changes mid-chain -> LM job then BH job; zero-km leg kept
  ["CHAMU", d(8), "", 1045, "LAMMEL", "FUEL", 1048, "", 3, "LAMMEL", ""],
  ["CHAMU", d(8), "", 1048, "FUEL", "LAMMEL", 1048, "", 0, "LAMMEL", ""],
  ["CHAMU", d(8), "", 1048, "LAMMEL", "CABS", 1060, "", 12, "BESTHULE", ""],
  // express rate + compound destination
  ["CHAMU", d(9), "", 1060, "LAMMEL", "BORDER / LAMMEL", 1160, "", 100, "ROMEO", "Express"],
];

async function seedCompany() {
  const [shippy, lammelPlace, cabs] = await Customer.create([
    { name: "Shippy" },
    { name: "Lammel" },
    { name: "CABS" },
  ]);
  const [lammel, romeo, besthule] = await Contractor.create(
    [
      ["Lammel", "LM", 779],
      ["Romeo Kitchens", "RK", 900],
      ["Besthule", "BH", 800],
    ].map(([companyName, prefix, lastOrder]) => ({
      companyName,
      prefix,
      lastOrder,
      address: "x",
      city: "Harare",
      goodsTypes: ["general"],
      vehiclesTypes: ["smallVehicle", "mediumVehicle"],
      deliveryTypes: ["local", "express"],
    }))
  );
  const deliverer = await Deliverer.create({
    companyName: "Allea",
    address: "x",
    city: "Harare",
    customer_ids: [shippy._id, lammelPlace._id],
    contractor_ids: [lammel._id, romeo._id, besthule._id],
  });
  const companyId = String(deliverer._id);
  const [chris, chamu] = await Driver.create(
    ["Chris", "Chamu"].map((name, i) => ({
      name,
      phoneNumber: "1",
      address: "x",
      city: "Harare",
      idNumber: `ID${i}`,
      id: `D${i}`,
      companyId,
    }))
  );
  const vehicle = await Vehicle.create({
    make: "Toyota Dyna",
    companyId,
    size: "smallVehicle",
    regNumber: "AAV4331",
  });
  await Deliverer.updateOne(
    { _id: deliverer._id },
    { driver_ids: [chris._id, chamu._id], vehicle_ids: [vehicle._id] }
  );
  await Rate.create(
    [lammel, romeo, besthule].map((c) => ({
      contractor: c._id,
      deliverer: deliverer._id,
      rateTypes: [
        { rateType: "local", smallVehicle: 1.95, mediumVehicle: 3.35 },
        { rateType: "express", smallVehicle: 1.25, mediumVehicle: 1.75 },
      ],
    }))
  );
  return { companyId, lammel, romeo, besthule, chris, chamu, vehicle, cabs };
}

describe("Excel vehicle-log import", () => {
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

  const files = () => [{ fileName: "AAV4331.xlsx", buffer: buildWorkbook(SAMPLE_ROWS) }];

  test("preview skips private trips, groups legs into jobs and prices them", async () => {
    const { companyId } = await seedCompany();
    const preview = await buildImportPreview({ files: files(), companyId });

    expect(preview.summary).toMatchObject({ legs: 9, ready: 7, skipped: 2, blocked: 0 });
    expect(preview.jobs.map((j) => [j.jobNumber, j.legIds.length, j.distance, j.cost])).toEqual([
      ["RK0900", 3, 32, 62.4],
      ["LM0779", 2, 3, 5.85],
      ["BH0800", 1, 12, 23.4],
      ["RK0901", 1, 100, 125], // express @ 1.25
    ]);
    const compound = preview.decisions.find((x) => x.raw === "BORDER / LAMMEL");
    expect(compound.value).toBe("new:Border");
    expect(compound.needsReview).toBe(true);
    expect(preview.newCustomerNames.sort()).toEqual(["Border", "Fuel", "Muchena"]);
    expect(preview.canCommit).toBe(true);
  });

  test("full-compound option and explicit choices are honoured", async () => {
    const { companyId } = await seedCompany();
    const preview = await buildImportPreview({
      files: files(),
      companyId,
      options: { useFirstNameForCompound: false },
      choices: { "customer:muchena": "new:Muchena Mall" },
    });
    expect(preview.newCustomerNames.sort()).toEqual(["Border / Lammel", "Fuel", "Muchena Mall"]);
  });

  test("commit writes jobs, links everything, numbers per job, and is idempotent", async () => {
    const ctx = await seedCompany();
    const result = await commitImport({ files: files(), companyId: ctx.companyId });

    expect(result.jobsCreated).toBe(4);
    expect(result.legsCreated).toBe(7);
    expect(result.newCustomers.sort()).toEqual(["Border", "Fuel", "Muchena"]);

    const jobs = await Job.find().lean();
    expect(jobs).toHaveLength(7);
    expect(new Set(jobs.map((j) => j.jobNumber))).toEqual(
      new Set(["RK0900", "RK0901", "LM0779", "BH0800"])
    );
    const zeroLeg = jobs.find((j) => j.mileageOut === "1048" && j.mileageIn === "1048");
    expect(parseFloat(zeroLeg.cost.toString())).toBe(0);

    // lastOrder advances once per job, not per leg
    const romeo = await Contractor.findById(ctx.romeo._id).lean();
    const lammel = await Contractor.findById(ctx.lammel._id).lean();
    expect(romeo.lastOrder).toBe(902);
    expect(lammel.lastOrder).toBe(780);
    expect(romeo.job_ids).toHaveLength(4);

    const deliverer = await Deliverer.findById(ctx.companyId).lean();
    expect(deliverer.job_ids).toHaveLength(7);
    // used customers (incl. pre-existing CABS and new ones) are linked
    expect(deliverer.customer_ids.map(String)).toEqual(
      expect.arrayContaining([String(ctx.cabs._id)])
    );
    expect(deliverer.customer_ids).toHaveLength(6);

    const vehicle = await Vehicle.findById(ctx.vehicle._id).lean();
    expect(vehicle.job_ids).toHaveLength(7);

    const overall = await OverallStats.findOne({ companyId: ctx.companyId, year: 2026 }).lean();
    expect(overall.yearlyJobs).toBe(7);
    expect(overall.yearlyMileage).toBe(147);
    expect(parseFloat(overall.yearlyRevenue.toString())).toBeCloseTo(62.4 + 5.85 + 23.4 + 125, 2);
    const rkStats = await ContractorStats.findOne({
      contractorId: String(ctx.romeo._id),
      year: 2026,
    }).lean();
    expect(rkStats.job_ids).toHaveLength(4);

    // Uploading the same sheet again adds nothing.
    const again = await buildImportPreview({ files: files(), companyId: ctx.companyId });
    expect(again.summary).toMatchObject({ ready: 0, duplicate: 7 });
    await expect(commitImport({ files: files(), companyId: ctx.companyId })).rejects.toThrow(
      "Nothing new to import"
    );
    expect(await Job.countDocuments()).toBe(7);
    expect(await Customer.countDocuments({ name: "Fuel" })).toBe(1);
  });

  test("unknown driver blocks commit until chosen", async () => {
    const ctx = await seedCompany();
    const rows = [["TAPIWA", d(3), "", 5000, "SHIPPY", "LAMMEL", 5010, "", 10, "ROMEO", ""]];
    const upload = [{ fileName: "x.xlsx", buffer: buildWorkbook(rows) }];

    const preview = await buildImportPreview({ files: upload, companyId: ctx.companyId });
    expect(preview.summary.blocked).toBe(1);
    expect(preview.canCommit).toBe(false);

    const result = await commitImport({
      files: upload,
      companyId: ctx.companyId,
      choices: { "driver:tapiwa": String(ctx.chamu._id) },
    });
    expect(result.legsCreated).toBe(1);
    const job = await Job.findOne().lean();
    expect(String(job.driverId)).toBe(String(ctx.chamu._id));
  });

  test("multi-sheet workbook: one vehicle per sheet, non-log sheets ignored", async () => {
    const ctx = await seedCompany();
    const daf = await Vehicle.create({
      make: "DAF ",
      companyId: ctx.companyId,
      size: "mediumVehicle",
      regNumber: "AFE5848",
    });
    const header = ["Driver", "Date", "Time Out", "Mileage Out", "From", "To", "Mileage In", "Time In", "Total KM", "Contractor", "Notes"];
    const sheet = (title, rows) =>
      XLSX.utils.aoa_to_sheet([[title], ["Yellow = hard to read"], header, ...rows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      sheet("TOYOTA DYNA AAV 4331 – Vehicle Log", [
        ["CHRIS", d(2), "", 1000, "LAMMEL", "ECONET W/VALE", 1010, "", 10, "ROMEO", null],
      ]),
      "Toyota Dyna AAV 4331"
    );
    XLSX.utils.book_append_sheet(
      book,
      sheet("DAF 5848 – Vehicle Log", [
        ["CHRIS", d(2), "", 5000, "SHIPPY", "LAMMEL", 5004, "", 4, "PUT", null],
        ["CHRIS", d(2), "", 5004, "LAMMEL", "POMONA", 5024, "", 20, "LAMMEL", null],
      ]),
      "DAF 5848"
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["Sheet", "Row", "Reason"], ["DAF 5848", 4, "check"]]),
      "Items to Review"
    );
    const upload = [
      { fileName: "Vehicle_Logs.xlsx", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) },
    ];

    const preview = await buildImportPreview({ files: upload, companyId: ctx.companyId });
    expect(preview.sheets.find((s) => s.sheetName === "Items to Review").skipped).toBe(true);
    expect(preview.summary).toMatchObject({ ready: 2, skipped: 1, blocked: 0, jobs: 2 });

    const dafJob = preview.jobs.find((j) => j.regNumber === "AFE5848");
    expect(dafJob.vehicleId).toBe(String(daf._id));
    expect(dafJob.cost).toBe(67); // 20 km @ medium local 3.35
    expect(preview.newCustomerNames).toEqual(expect.arrayContaining(["Econet W/Vale", "Pomona"]));
    expect(preview.decisions.find((x) => x.raw === "ECONET W/VALE").compound).toBe(false);
  });

  test("HTTP preview then commit with choices", async () => {
    const ctx = await seedCompany();
    const user = await User.create({
      name: "Admin",
      email: "import@test.com",
      password: "password123",
      phoneNumber: "1",
      role: "deliverer",
      address: "x",
      city: "Harare",
      companyId: ctx.companyId,
    });
    const cookie = [`token=${jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY)}`];
    const buffer = buildWorkbook(SAMPLE_ROWS);

    const preview = await request(app)
      .post("/api/v2/job-import/preview")
      .set("Cookie", cookie)
      .attach("files", buffer, "AAV4331.xlsx");
    expect(preview.status).toBe(200);
    expect(preview.body.preview.summary.jobs).toBe(4);
    expect(await Job.countDocuments()).toBe(0);

    const commit = await request(app)
      .post("/api/v2/job-import/commit")
      .set("Cookie", cookie)
      .field("choices", JSON.stringify({ "customer:border lammel": "new:Border Post" }))
      .field("options", JSON.stringify({ useFirstNameForCompound: true }))
      .attach("files", buffer, "AAV4331.xlsx");
    expect(commit.status).toBe(201);
    expect(commit.body.result.legsCreated).toBe(7);
    expect(await Customer.countDocuments({ name: "Border Post" })).toBe(1);

    const rejected = await request(app)
      .post("/api/v2/job-import/preview")
      .set("Cookie", cookie)
      .attach("files", Buffer.from("hello"), "notes.txt");
    expect(rejected.status).toBe(400);
  });
});

describe("create-job job numbering", () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("a multi-leg job advances contractor.lastOrder by one", async () => {
    const fixture = await seedAuthFixture();
    const legs = [0, 1, 2].map((i) =>
      buildJobPayload({
        from: fixture.fromCustomer._id,
        customer: fixture.toCustomer._id,
        contractorId: fixture.contractorA._id,
        vehicleId: fixture.vehicleA._id,
        driverId: fixture.driverA._id,
        mileageOut: String(1000 + i * 10),
        mileageIn: String(1010 + i * 10),
      })
    );
    const res = await request(app)
      .post("/api/v2/job/create-job")
      .set("Cookie", [`token=${fixture.token}`])
      .send(legs);
    expect(res.status).toBe(201);
    expect(res.body.jobs).toHaveLength(3);

    const contractor = await Contractor.findById(fixture.contractorA._id).lean();
    expect(contractor.lastOrder).toBe(2);
    expect(contractor.job_ids).toHaveLength(3);
  });
});
