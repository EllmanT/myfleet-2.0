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
const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myfleet-files-"));
process.env.UPLOADS_DIR = uploadsRoot;

// The Blob SDK is replaced so no test ever talks to Vercel.
jest.mock("@vercel/blob", () => ({
  put: jest.fn(async () => ({})),
  get: jest.fn(),
  del: jest.fn(async () => undefined),
}));
const blob = require("@vercel/blob");

const storage = require("../services/fileStorage");
const app = require("../app");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Driver = require("../model/driver");

jest.setTimeout(120000);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF-demo-picture-bytes")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]);
const PDF = Buffer.from("%PDF-1.4\n%demo document\n");
const TEXT = Buffer.from("this is only a text file pretending to be a picture");
const TENANT = "a".repeat(24);

describe("file storage service", () => {
  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    jest.clearAllMocks();
  });

  test("the type comes from the file's bytes, never from its name", () => {
    expect(storage.sniffType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(storage.sniffType(PNG).ext).toBe("png");
    expect(storage.sniffType(WEBP).ext).toBe("webp");
    expect(storage.sniffType(PDF).ext).toBe("pdf");
    expect(storage.sniffType(TEXT)).toBeNull();
    expect(storage.sniffType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(storage.sniffType(Buffer.alloc(3))).toBeNull();
  });

  test("keys are ours, tenant-prefixed, and cannot be forged or traversed", () => {
    const good = `tenants/${TENANT}/driver-id/123e4567-e89b-12d3-a456-426614174000.jpg`;
    expect(storage.parseKey(good)).toEqual({ tenantId: TENANT, kind: "driver-id", ext: "jpg" });
    for (const bad of [
      "uploads\\old-file.png",
      "/uploads/x.png",
      `tenants/${TENANT}/../${"b".repeat(24)}/driver-id/123e4567-e89b-12d3-a456-426614174000.jpg`,
      `tenants/${TENANT}/driver-id/../../x.jpg`,
      `tenants/${TENANT}/driver-id/123e4567-e89b-12d3-a456-426614174000.exe`,
      `tenants/short/driver-id/123e4567-e89b-12d3-a456-426614174000.jpg`,
      "",
      null,
    ]) {
      expect(storage.isStoredKey(bad)).toBe(false);
    }
  });

  test("local disk: save, read back the same bytes, delete", async () => {
    const { key, contentType } = await storage.saveFile({ tenantId: TENANT, kind: "driver-id", buffer: PNG });
    expect(key).toMatch(new RegExp(`^tenants/${TENANT}/driver-id/[0-9a-f-]{36}\\.png$`));
    expect(contentType).toBe("image/png");

    const file = await storage.readFile(key);
    const chunks = [];
    for await (const chunk of file.stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).equals(PNG)).toBe(true);
    expect(file.contentType).toBe("image/png");

    expect(await storage.deleteFile(key)).toBe(true);
    expect(await storage.readFile(key)).toBeNull();
    expect(await storage.deleteFile(key)).toBe(true); // already gone is not an error
  });

  test("refuses wrong types, empty and oversized files, and a missing company", async () => {
    await expect(storage.saveFile({ tenantId: TENANT, kind: "driver-id", buffer: TEXT })).rejects.toThrow(/JPG, PNG, WebP or PDF/);
    await expect(storage.saveFile({ tenantId: TENANT, kind: "driver-id", buffer: Buffer.alloc(0) })).rejects.toThrow(/empty/);
    const big = Buffer.concat([JPEG, Buffer.alloc(storage.MAX_FILE_BYTES)]);
    await expect(storage.saveFile({ tenantId: TENANT, kind: "driver-id", buffer: big })).rejects.toThrow(/too large/);
    await expect(storage.saveFile({ tenantId: undefined, kind: "driver-id", buffer: JPEG })).rejects.toThrow(/no company/);
    await expect(storage.saveFile({ tenantId: TENANT, kind: "../evil", buffer: JPEG })).rejects.toThrow(/Invalid file kind/);
  });

  test("legacy values that are not our keys are never read or deleted", async () => {
    expect(await storage.readFile("uploads\\driver-123.png")).toBeNull();
    expect(await storage.deleteFile("uploads\\driver-123.png")).toBe(false);
  });

  test("Vercel Blob: private access, tenant-prefixed key, content type set", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const { key } = await storage.saveFile({ tenantId: TENANT, kind: "driver-licence", buffer: JPEG });
    expect(blob.put).toHaveBeenCalledTimes(1);
    const [pathname, body, options] = blob.put.mock.calls[0];
    expect(pathname).toBe(key);
    expect(pathname.startsWith(`tenants/${TENANT}/driver-licence/`)).toBe(true);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(options).toMatchObject({ access: "private", contentType: "image/jpeg", allowOverwrite: false });
    // nothing was written to the local disk
    expect(fs.existsSync(path.join(uploadsRoot, "private", "tenants", TENANT, "driver-licence"))).toBe(false);
  });

  test("Vercel Blob: reads stream a private blob; a missing blob is null; delete is passed through", async () => {
    process.env.BLOB_STORE_ID = "store_123";
    const key = `tenants/${TENANT}/driver-id/123e4567-e89b-12d3-a456-426614174000.png`;
    blob.get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Response(PNG).body,
      blob: { contentType: "image/png" },
    });
    const file = await storage.readFile(key);
    expect(blob.get).toHaveBeenCalledWith(key, { access: "private" });
    const chunks = [];
    for await (const chunk of file.stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).equals(PNG)).toBe(true);

    blob.get.mockResolvedValueOnce(null);
    expect(await storage.readFile(key)).toBeNull();

    await storage.deleteFile(key);
    expect(blob.del).toHaveBeenCalledWith(key);
  });
});

describe("driver documents over HTTP", () => {
  let mongod;
  let companyA;
  let companyB;
  let cookieA;
  let cookieB;

  const makeCompany = (companyName) =>
    Deliverer.create({
      companyName,
      address: "Street",
      city: "Harare",
      goodsType: ["general"],
      vehiclesType: ["small"],
      deliveryType: ["standard"],
    });
  const login = async (companyId, email) => {
    const user = await User.create({
      name: "Admin",
      email,
      password: "password123",
      phoneNumber: "555",
      role: "Deliverer Admin",
      address: "Street",
      city: "Harare",
      companyId,
    });
    return ["token=" + jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" })];
  };
  const createDriver = (cookie, { idNumber = "63-123456-X-42", license = JPEG, idFile = PNG, name = "Farai Chuma" } = {}) => {
    let req = request(app)
      .post("/api/v2/driver/create-driver")
      .set("Cookie", cookie)
      .field("name", name)
      .field("phoneNumber", "0771234567")
      .field("address", "12 Main Street")
      .field("city", "Harare")
      .field("idNumber", idNumber);
    if (license) req = req.attach("license", license, { filename: "licence.jpg", contentType: "image/jpeg" });
    if (idFile) req = req.attach("id", idFile, { filename: "id.png", contentType: "image/png" });
    return req;
  };
  const filesOnDisk = () => {
    const out = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(dir, e.name));
        else out.push(path.join(dir, e.name));
      }
    };
    walk(path.join(uploadsRoot, "private"));
    return out;
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
    fs.rmSync(path.join(uploadsRoot, "private"), { recursive: true, force: true });
    companyA = await makeCompany("Company A");
    companyB = await makeCompany("Company B");
    cookieA = await login(companyA._id, "a@x.test");
    cookieB = await login(companyB._id, "b@x.test");
  });

  test("creating a driver stores both documents privately under the company's own prefix", async () => {
    const res = await createDriver(cookieA);
    expect(res.status).toBe(201);
    const driver = await Driver.findOne({ idNumber: "63-123456-X-42" }).lean();
    const prefix = `tenants/${companyA._id}/`;
    expect(driver.id.startsWith(`${prefix}driver-id/`)).toBe(true);
    expect(driver.license.startsWith(`${prefix}driver-licence/`)).toBe(true);
    expect(filesOnDisk()).toHaveLength(2);
  });

  test("the owner can download a document, with private headers and the exact bytes", async () => {
    await createDriver(cookieA);
    const driver = await Driver.findOne({}).lean();
    const res = await request(app).get(`/api/v2/files/${driver.id}`).set("Cookie", cookieA).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body.equals(PNG)).toBe(true);
  });

  test("another company, a signed-out visitor, and made-up keys all get nothing", async () => {
    await createDriver(cookieA);
    const driver = await Driver.findOne({}).lean();

    // company B asking for company A's exact key
    expect((await request(app).get(`/api/v2/files/${driver.id}`).set("Cookie", cookieB)).status).toBe(404);
    // not signed in
    expect((await request(app).get(`/api/v2/files/${driver.id}`)).status).toBe(401);
    // B tries to reach A's folder by changing the prefix or walking out of their own
    const name = driver.id.split("/").pop();
    for (const key of [
      `tenants/${companyB._id}/driver-id/${name}`,
      `tenants/${companyB._id}/../${companyA._id}/driver-id/${name}`,
      `tenants/${companyA._id}/driver-id/../driver-licence/${name}`,
      "..%2F..%2Fpackage.json",
      "uploads/anything.png",
      "tenants",
    ]) {
      const res = await request(app).get(`/api/v2/files/${key}`).set("Cookie", cookieB);
      expect([404, 400]).toContain(res.status);
    }
  });

  test("a file that is really text is refused, and nothing is left behind", async () => {
    const res = await createDriver(cookieA, { idFile: TEXT });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/JPG, PNG, WebP or PDF/);
    expect(await Driver.countDocuments()).toBe(0);
    expect(filesOnDisk()).toHaveLength(0); // the licence that was fine is cleaned up too
  });

  test("a missing document is a clear 400", async () => {
    const res = await createDriver(cookieA, { license: null });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/both the driver's licence and ID/);
  });

  test("two companies can each have a driver with the same ID number, with separate records and files", async () => {
    expect((await createDriver(cookieA)).status).toBe(201);
    expect((await createDriver(cookieB, { name: "Other Person" })).status).toBe(201);
    const drivers = await Driver.find({ idNumber: "63-123456-X-42" }).lean();
    expect(drivers).toHaveLength(2);
    expect(new Set(drivers.map((d) => String(d.tenantId)))).toEqual(new Set([String(companyA._id), String(companyB._id)]));
    // the same company adding the same person twice is still refused
    expect((await createDriver(cookieA)).status).toBe(409);
  });

  test("editing text fields needs no files, and a new file replaces and removes the old one", async () => {
    await createDriver(cookieA);
    const before = await Driver.findOne({}).lean();

    const textOnly = await request(app)
      .put("/api/v2/driver/update-driver")
      .set("Cookie", cookieA)
      .send({ driverId: String(before._id), name: "Farai C. Chuma", city: "Mutare" });
    expect(textOnly.status).toBe(201);
    let after = await Driver.findOne({}).lean();
    expect(after).toMatchObject({ name: "Farai C. Chuma", city: "Mutare", id: before.id, license: before.license });
    expect(filesOnDisk()).toHaveLength(2);

    const withFile = await request(app)
      .put("/api/v2/driver/update-driver")
      .set("Cookie", cookieA)
      .field("driverId", String(before._id))
      .attach("id", WEBP, { filename: "new-id.webp", contentType: "image/webp" });
    expect(withFile.status).toBe(201);
    after = await Driver.findOne({}).lean();
    expect(after.id).not.toBe(before.id);
    expect(after.id.endsWith(".webp")).toBe(true);
    expect(after.license).toBe(before.license);
    expect(filesOnDisk()).toHaveLength(2); // the replaced ID file is gone
    expect(await storage.readFile(before.id)).toBeNull();
  });

  test("another company cannot edit this driver or replace their documents", async () => {
    await createDriver(cookieA);
    const driver = await Driver.findOne({}).lean();
    const res = await request(app)
      .put("/api/v2/driver/update-driver")
      .set("Cookie", cookieB)
      .field("driverId", String(driver._id))
      .attach("id", WEBP, { filename: "x.webp", contentType: "image/webp" });
    expect(res.status).toBe(404);
    expect((await Driver.findOne({}).lean()).id).toBe(driver.id);
    expect(filesOnDisk()).toHaveLength(2);
  });

  test("deleting a driver deletes their documents", async () => {
    await createDriver(cookieA);
    const driver = await Driver.findOne({}).lean();
    expect(filesOnDisk()).toHaveLength(2);
    const res = await request(app).delete(`/api/v2/driver/delete-driver/${driver._id}`).set("Cookie", cookieA);
    expect(res.status).toBeLessThan(300);
    expect(filesOnDisk()).toHaveLength(0);
  });
});
