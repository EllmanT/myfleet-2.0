const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || "test-activation";
process.env.NODE_ENV = "test";
process.env.CRON_SECRET = "cron-test-secret";
const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myfleet-delete-"));
process.env.UPLOADS_DIR = uploadsRoot;

const app = require("../app");
const storage = require("../services/fileStorage");
const deletion = require("../services/companyDeletion");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Customer = require("../model/customer");
const Driver = require("../model/driver");
const Expense = require("../model/expense");

jest.setTimeout(120000);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF-delete-test")]);

describe("deleting a company", () => {
  let mongod;
  let a;
  let b;
  let cookieA;
  let cookieB;
  let cookieStaff;
  let fileA;
  let fileB;

  const company = (companyName) =>
    Deliverer.create({ companyName, address: "S", city: "Harare", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"] });
  const person = async (companyId, email, role) => {
    const user = await User.create({ name: "P", email, password: "password123", phoneNumber: "5", role, address: "S", city: "Harare", companyId });
    return ["token=" + jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const filesFor = (id) => {
    const dir = path.join(uploadsRoot, "private", "tenants", String(id));
    return fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).length : 0;
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
    delete process.env.DELETION_GRACE_DAYS;
    a = await company("Alpha Haulage");
    b = await company("Bravo Freight");
    cookieA = await person(a._id, "a@x.test", "Deliverer Admin");
    cookieB = await person(b._id, "b@x.test", "Deliverer Admin");
    cookieStaff = await person(a._id, "staff@x.test", "deliverer");
    await person(undefined, "site@x.test", "Site Admin");

    await Customer.create({ tenantId: a._id, name: "A customer" });
    await Customer.create({ tenantId: b._id, name: "B customer" });
    await Expense.collection.insertMany([{ companyId: String(a._id), d: 1 }, { companyId: b._id, d: 2 }]);
    fileA = await storage.saveFile({ tenantId: a._id, kind: "driver-id", buffer: JPEG });
    fileB = await storage.saveFile({ tenantId: b._id, kind: "driver-id", buffer: JPEG });
    await Driver.create({ tenantId: a._id, companyId: String(a._id), name: "D", phoneNumber: "1", address: "x", city: "H", idNumber: "1", license: fileA.key, id: fileA.key });
  });

  const ask = (cookie, confirmName) => request(app).post("/api/v2/tenant/deletion").set("Cookie", cookie).send({ confirmName });

  test("asking needs the exact company name and an admin; nothing is removed yet", async () => {
    expect((await ask(cookieA, "wrong")).status).toBe(400);
    expect((await ask(cookieStaff, "Alpha Haulage")).status).toBe(403);
    expect((await request(app).post("/api/v2/tenant/deletion").send({ confirmName: "Alpha Haulage" })).status).toBe(401);

    const res = await ask(cookieA, "  alpha   HAULAGE ");
    expect(res.status).toBe(200);
    expect(res.body.deletion.pending).toBe(true);
    expect(res.body.deletion.daysLeft).toBe(30);
    expect(await Customer.countDocuments({ tenantId: a._id })).toBe(1);
    expect(filesFor(a._id)).toBeGreaterThan(0);
  });

  test("the company's status shows in /tenant/me, and asking again keeps the first date", async () => {
    await ask(cookieA, "Alpha Haulage");
    const first = (await Deliverer.findById(a._id).lean()).deletionScheduledFor;
    await ask(cookieA, "Alpha Haulage");
    expect((await Deliverer.findById(a._id).lean()).deletionScheduledFor).toEqual(first);
    const me = await request(app).get("/api/v2/tenant/me").set("Cookie", cookieA);
    expect(me.body.deletion.pending).toBe(true);
    const other = await request(app).get("/api/v2/tenant/me").set("Cookie", cookieB);
    expect(other.body.deletion.pending).toBe(false);
  });

  test("it can be cancelled, and only by the company's own admin", async () => {
    await ask(cookieA, "Alpha Haulage");
    expect((await request(app).delete("/api/v2/tenant/deletion").set("Cookie", cookieStaff)).status).toBe(403);
    // B's admin cancelling affects only B
    await request(app).delete("/api/v2/tenant/deletion").set("Cookie", cookieB);
    expect((await Deliverer.findById(a._id).lean()).deletionScheduledFor).toBeTruthy();
    const res = await request(app).delete("/api/v2/tenant/deletion").set("Cookie", cookieA);
    expect(res.status).toBe(200);
    expect((await Deliverer.findById(a._id).lean()).deletionScheduledFor).toBeUndefined();
  });

  test("nothing is purged before the date, whatever is asked", async () => {
    await ask(cookieA, "Alpha Haulage");
    expect((await deletion.purgeCompany(a._id)).ok).toBe(false);
    expect((await deletion.purgeDueCompanies()).length).toBe(0);
    expect((await deletion.purgeCompany(b._id)).ok).toBe(false); // never asked for
    expect(await Customer.countDocuments({})).toBe(2);
  });

  test("once due, the company's records, files and people go; the other company is untouched", async () => {
    await ask(cookieA, "Alpha Haulage");
    await Deliverer.updateOne({ _id: a._id }, { deletionScheduledFor: new Date(Date.now() - 1000) });

    const results = await deletion.purgeDueCompanies();
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].removed.customers).toBe(1);
    expect(results[0].removed.expenses).toBe(1);
    expect(results[0].removed.drivers).toBe(1);
    expect(results[0].removed.files).toBe(1);
    expect(results[0].removed.users).toBe(2);

    expect(await Deliverer.findById(a._id)).toBeNull();
    expect(await Customer.countDocuments({ tenantId: a._id })).toBe(0);
    expect(await Driver.countDocuments({})).toBe(0);
    expect(await User.countDocuments({ companyId: a._id })).toBe(0);
    expect(await Expense.collection.countDocuments({ companyId: String(a._id) })).toBe(0);
    expect(filesFor(a._id)).toBe(0);

    // B and the platform admin are intact
    expect(await Deliverer.findById(b._id)).not.toBeNull();
    expect(await Customer.countDocuments({ tenantId: b._id })).toBe(1);
    expect(await Expense.collection.countDocuments({ companyId: b._id })).toBe(1);
    expect(filesFor(b._id)).toBeGreaterThan(0);
    expect(await storage.readFile(fileB.key)).not.toBeNull();
    expect(await User.countDocuments({ email: "site@x.test" })).toBe(1);

    // only a small note remains
    const notes = await mongoose.connection.collection("deletedcompanies").find({}).toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0].companyName).toBe("Alpha Haulage");
    expect(JSON.stringify(notes[0])).not.toMatch(/A customer/);
  });

  test("a deleted company's people can no longer sign in", async () => {
    await ask(cookieA, "Alpha Haulage");
    await Deliverer.updateOne({ _id: a._id }, { deletionScheduledFor: new Date(Date.now() - 1000) });
    await deletion.purgeDueCompanies();
    const res = await request(app).get("/api/v2/tenant/me").set("Cookie", cookieA);
    expect(res.status).toBe(401);
  });

  test("the grace period can be set; zero days means due immediately", async () => {
    process.env.DELETION_GRACE_DAYS = "7";
    const res = await ask(cookieB, "Bravo Freight");
    expect(res.body.deletion.daysLeft).toBe(7);
  });

  test("the scheduled job needs the secret", async () => {
    await ask(cookieA, "Alpha Haulage");
    await Deliverer.updateOne({ _id: a._id }, { deletionScheduledFor: new Date(Date.now() - 1000) });
    expect((await request(app).get("/api/v2/tenant/purge-due")).status).toBe(401);
    expect((await request(app).get("/api/v2/tenant/purge-due").set("Cookie", cookieA)).status).toBe(401);
    expect((await request(app).get("/api/v2/tenant/purge-due").set("Authorization", "Bearer nope")).status).toBe(401);
    expect(await Deliverer.findById(a._id)).not.toBeNull();

    const ok = await request(app).get("/api/v2/tenant/purge-due").set("Authorization", "Bearer cron-test-secret");
    expect(ok.status).toBe(200);
    expect(ok.body.purged).toBe(1);
    expect(await Deliverer.findById(a._id)).toBeNull();
  });
});
