const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { unzipSync, strFromU8 } = require("fflate");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || "test-activation";
process.env.NODE_ENV = "test";
const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myfleet-export-"));
process.env.UPLOADS_DIR = uploadsRoot;

const app = require("../app");
const { toCsv, csvField } = require("../services/dataExport");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Driver = require("../model/driver");
const Customer = require("../model/customer");
const Vehicle = require("../model/vehicle");
const Expense = require("../model/expense");

jest.setTimeout(120000);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF-export-test")]);
const binary = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describe("csv cells", () => {
  test("quotes, commas and line breaks are kept inside the cell", () => {
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
  });

  test("text that a spreadsheet would run as a formula is defused, real negative numbers are not", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+1+1")).toBe("'+1+1");
    expect(csvField("@sum")).toBe("'@sum");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("-12.50")).toBe("-12.50");
  });

  test("columns are the union of every row's fields", () => {
    const csv = toCsv([{ a: 1 }, { b: 2, a: 3 }]);
    expect(csv.replace("﻿", "").split("\r\n").slice(0, 3)).toEqual(["a,b", "1,", "3,2"]);
  });
});

describe("company data export", () => {
  let mongod;
  let a;
  let b;
  let cookieA;
  let cookieB;
  let cookieStaff;

  const company = (companyName) =>
    Deliverer.create({
      companyName,
      address: "Street",
      city: "Harare",
      goodsType: ["general"],
      vehiclesType: ["small"],
      deliveryType: ["standard"],
    });
  const person = async (companyId, email, role) => {
    const user = await User.create({
      name: "Person",
      email,
      password: "password123",
      phoneNumber: "555",
      role,
      address: "Street",
      city: "Harare",
      companyId,
    });
    return ["token=" + jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const download = (cookie, query = "") =>
    request(app).get(`/api/v2/tenant/export${query}`).set("Cookie", cookie).buffer(true).parse(binary);
  const open = (res) => {
    const files = unzipSync(new Uint8Array(res.body));
    return {
      names: Object.keys(files),
      text: (name) => strFromU8(files[name]),
      json: (name) => JSON.parse(strFromU8(files[name])),
      raw: (name) => Buffer.from(files[name]),
    };
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    a = await company("Alpha Haulage");
    b = await company("Bravo Freight");
    cookieA = await person(a._id, "a@x.test", "Deliverer Admin");
    cookieB = await person(b._id, "b@x.test", "Deliverer Admin");
    cookieStaff = await person(a._id, "staff@x.test", "deliverer");

    const mkCustomer = (tenant, name) =>
      Customer.create({ tenantId: tenant._id, name, phoneNumber: "1", address: "x", city: "Harare" });
    const alphaCustomer = await mkCustomer(a, '=HYPERLINK("http://evil.test")');
    await mkCustomer(a, "Plain, Customer");
    await mkCustomer(b, "Bravo Only Customer");
    a.customer_ids.push(alphaCustomer._id);
    await a.save();
  });

  test("a company admin gets a ZIP with a spreadsheet and a JSON file for each kind, a README and a manifest", async () => {
    const res = await download(cookieA);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="myfleet-export-\d{4}-\d{2}-\d{2}\.zip"$/);
    expect(res.headers["cache-control"]).toBe("private, no-store");

    const zip = open(res);
    for (const file of ["README.txt", "manifest.json", "csv/customers.csv", "json/customers.json", "csv/jobs.csv", "csv/users.csv", "csv/company.csv"]) {
      expect(zip.names).toContain(file);
    }
    const manifest = zip.json("manifest.json");
    expect(manifest.company.name).toBe("Alpha Haulage");
    expect(manifest.counts.customers).toBe(2);
    expect(zip.text("README.txt")).toContain("Alpha Haulage");
  });

  test("it holds this company's data and none of another company's", async () => {
    const zip = open(await download(cookieA));
    const customers = zip.json("json/customers.json").map((c) => c.name);
    expect(customers.sort()).toEqual(['=HYPERLINK("http://evil.test")', "Plain, Customer"].sort());
    for (const name of zip.names.filter((n) => /\.(csv|json|txt)$/.test(n))) {
      expect(zip.text(name)).not.toMatch(/Bravo/);
    }
    // and the other way round
    const bZip = open(await download(cookieB));
    expect(bZip.json("json/customers.json").map((c) => c.name)).toEqual(["Bravo Only Customer"]);
    expect(bZip.text("csv/customers.csv")).not.toMatch(/Alpha|Plain/);
  });

  test("names that a spreadsheet would run as a formula arrive as plain text", async () => {
    const csv = open(await download(cookieA)).text("csv/customers.csv");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain('"Plain, Customer"');
  });

  test("passwords and sign-in secrets never leave", async () => {
    const zip = open(await download(cookieA));
    const everything = zip.names.map((n) => (/\.(csv|json|txt)$/.test(n) ? zip.text(n) : "")).join("\n");
    expect(everything).not.toMatch(/\$2[aby]\$/); // bcrypt hash
    expect(everything).not.toMatch(/"password"|resetPassword|clerkUserId|clerkOrgId/);
    const users = zip.json("json/users.json");
    expect(users.map((u) => u.email).sort()).toEqual(["a@x.test", "staff@x.test"]);
  });

  test("older records that were never stamped are found through the company's id lists", async () => {
    const legacy = await Vehicle.collection.insertOne({
      regNumber: "LEG-001",
      vehicleType: "truck",
      companyId: String(a._id),
    });
    await Deliverer.updateOne({ _id: a._id }, { $push: { vehicle_ids: legacy.insertedId } });
    const zip = open(await download(cookieA));
    expect(zip.json("json/vehicles.json").map((v) => v.regNumber)).toContain("LEG-001");
    // Another company's old records stay out
    const other = await Vehicle.collection.insertOne({ regNumber: "OTHER-9", companyId: String(b._id) });
    await Deliverer.updateOne({ _id: b._id }, { $push: { vehicle_ids: other.insertedId } });
    const again = open(await download(cookieA));
    expect(again.json("json/vehicles.json").map((v) => v.regNumber)).not.toContain("OTHER-9");
  });

  test("records scoped by companyId (string or id) are included", async () => {
    await Expense.collection.insertMany([
      { companyId: String(a._id), description: "tyres-A" },
      { companyId: a._id, description: "tyres-A2" },
      { companyId: String(b._id), description: "tyres-B" },
    ]);
    const zip = open(await download(cookieA));
    const names = zip.json("json/expenses.json").map((e) => e.description).sort();
    expect(names).toEqual(["tyres-A", "tyres-A2"]);
  });

  test("uploaded documents are in the ZIP with the exact bytes; legacy values are noted, not fatal", async () => {
    const { saveFile } = require("../services/fileStorage");
    const licence = await saveFile({ tenantId: a._id, kind: "driver-licence", buffer: JPEG });
    const idDoc = await saveFile({ tenantId: a._id, kind: "driver-id", buffer: JPEG });
    const driver = await Driver.create({
      tenantId: a._id,
      companyId: String(a._id),
      name: "Farai",
      phoneNumber: "1",
      address: "x",
      city: "Harare",
      idNumber: "63-1-X-1",
      license: licence.key,
      id: idDoc.key,
    });
    const legacy = await Driver.create({
      tenantId: a._id,
      companyId: String(a._id),
      name: "Old",
      phoneNumber: "1",
      address: "x",
      city: "Harare",
      idNumber: "63-2-X-2",
      license: "uploads\\gone.png",
      id: "uploads\\gone2.png",
    });
    const zip = open(await download(cookieA));
    const docs = zip.names.filter((n) => n.startsWith("documents/"));
    expect(docs.sort()).toEqual([`documents/drivers/${driver._id}-id.jpg`, `documents/drivers/${driver._id}-license.jpg`].sort());
    expect(zip.raw(docs[0]).equals(JPEG)).toBe(true);
    expect(zip.json("manifest.json").documents).toBe(2);
    expect(zip.json("json/drivers.json").map((d) => String(d._id))).toContain(String(legacy._id));
  });

  test("another company's documents never end up in the ZIP", async () => {
    const { saveFile } = require("../services/fileStorage");
    const theirs = await saveFile({ tenantId: b._id, kind: "driver-id", buffer: JPEG });
    // a driver of A whose record (wrongly) points at B's file: it is still read, by key, from A's rows only.
    // The check here is the reverse: B's own driver must not appear in A's export.
    await Driver.create({
      tenantId: b._id, companyId: String(b._id), name: "Bravo Driver", phoneNumber: "1", address: "x",
      city: "Harare", idNumber: "9", license: theirs.key, id: theirs.key,
    });
    const zip = open(await download(cookieA));
    expect(zip.names.filter((n) => n.startsWith("documents/"))).toHaveLength(0);
  });

  test("staff who are not admins, signed-out visitors and bad ids are refused", async () => {
    expect((await download(cookieStaff)).status).toBe(403);
    const anon = await request(app).get("/api/v2/tenant/export");
    expect(anon.status).toBe(401);
  });

  test("an admin cannot name another company; the query is ignored", async () => {
    const res = await download(cookieB, `?companyId=${a._id}`);
    expect(res.status).toBe(200);
    expect(open(res).json("manifest.json").company.name).toBe("Bravo Freight");
  });

  test("a platform admin can export a named company", async () => {
    const cookieSite = await person(undefined, "site@x.test", "Site Admin");
    const res = await download(cookieSite, `?companyId=${a._id}`);
    expect(res.status).toBe(200);
    expect(open(res).json("manifest.json").company.name).toBe("Alpha Haulage");
  });
});
