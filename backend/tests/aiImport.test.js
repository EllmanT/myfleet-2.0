const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";
process.env.AI_IMPORT_PAGES_PER_MONTH = "3";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const AiUsage = require("../model/aiUsage");
const { clearModuleCache } = require("../middleware/moduleAccess");
const { analyseRows, sniff, extractLocalLog, setClientFactory, LOG_SCHEMA } = require("../services/aiImport/localLog");
const { parseVehicleLog } = require("../services/jobImport/parseVehicleLog");
const app = require("../app");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

const row = (over = {}) => ({
  driver: "CHRIS", date: "2026-10-01", timeOut: "06:40", mileageOut: 1000, from: "SHIPPY", to: "LAMMEL",
  mileageIn: 1005, timeIn: "07:00", totalKm: 5, contractor: "PVT", notes: null, confidence: "high", unclear: [], ...over,
});

// A stand-in for the Anthropic client: records the request and returns a canned answer.
const fakeClient = (answer, extra = {}) => {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (req) => {
        calls.push(req);
        return {
          stop_reason: "end_turn", model: req.model, usage: { input_tokens: 1000, output_tokens: 500 },
          content: [{ type: "text", text: JSON.stringify(answer) }], ...extra,
        };
      },
    },
  };
};

describe("analyseRows", () => {
  test("clean rows get no flags", () => {
    const rows = analyseRows([row(), row({ mileageOut: 1005, mileageIn: 1010, timeOut: "07:10", timeIn: "07:30" })]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.flags.length === 0)).toBe(true);
  });
  test("flags numbers that don't add up", () => {
    const [a, b, c] = analyseRows([
      row({ mileageIn: 990 }),                       // in < out
      row({ mileageOut: 5000, mileageIn: 5010, totalKm: 12 }), // total != in-out, and chain break from previous
      row({ mileageOut: 5010, mileageIn: 5015, timeOut: "10:00", timeIn: "09:00" }), // time order
    ]);
    expect(a.flags.map((f) => f.field)).toContain("mileageIn");
    expect(b.flags.some((f) => f.field === "totalKm" && f.type === "doesnt_add_up")).toBe(true);
    expect(b.flags.some((f) => f.field === "mileageOut")).toBe(true);
    expect(c.flags.some((f) => f.field === "timeIn")).toBe(true);
  });
  test("flags missing and unclear values, and never invents them", () => {
    const [r] = analyseRows([row({ driver: null, mileageIn: null, from: "PRIDHAM", unclear: ["from"] })]);
    expect(r.driver).toBe("");
    expect(r.mileageIn).toBeNull();
    expect(r.flags.find((f) => f.field === "driver").type).toBe("missing");
    expect(r.flags.find((f) => f.field === "mileageIn").type).toBe("missing");
    expect(r.flags.find((f) => f.field === "from").type).toBe("hard_to_read");
  });
  test("subtotal rows and invalid dates/times are handled", () => {
    const rows = analyseRows([row(), row({ from: "TOTAL" }), row({ date: "03/9/2026", timeOut: "25:99" })]);
    expect(rows).toHaveLength(2);
    expect(rows[1].date).toBe("");
    expect(rows[1].flags.some((f) => f.field === "date" && f.type === "hard_to_read")).toBe(true);
    expect(rows[1].flags.some((f) => f.field === "timeOut")).toBe(true);
  });
});

describe("file checks", () => {
  test("file type is read from the bytes, not the name", () => {
    expect(sniff(PNG)).toBe("image/png");
    expect(sniff(JPG)).toBe("image/jpeg");
    expect(sniff(Buffer.from("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniff(Buffer.from("MZ executable"))).toBeNull();
  });
});

describe("extractLocalLog", () => {
  afterEach(() => setClientFactory(() => { throw new Error("no client"); }));

  test("sends the file, a strict schema and no forced tool call; returns analysed rows", async () => {
    const client = fakeClient({ vehicleReg: "AFE 5848", vehicleDescription: "DAF", rows: [row()] });
    setClientFactory(() => client);
    const out = await extractLocalLog({ buffer: PNG, hints: { year: 2026, month: 10 } });

    const req = client.calls[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.tool_choice).toBeUndefined();
    expect(req.output_config.format).toMatchObject({ type: "json_schema", schema: LOG_SCHEMA });
    expect(req.system).toContain("Never invent");
    const content = req.messages[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
    expect(content[1].text).toContain("month 10 of 2026");
    expect(out.vehicleReg).toBe("AFE 5848");
    expect(out.rows).toHaveLength(1);
    expect(out.pages).toBe(1);
  });

  test("PDFs go as documents", async () => {
    const client = fakeClient({ vehicleReg: null, vehicleDescription: null, rows: [] });
    setClientFactory(() => client);
    await extractLocalLog({ buffer: Buffer.from("%PDF-1.4\n/Type /Page\n/Type /Page\n"), hints: {} });
    expect(client.calls[0].messages[0].content[0].type).toBe("document");
  });

  test("refusals, cut-off answers and bad JSON become clear errors", async () => {
    setClientFactory(() => fakeClient({}, { stop_reason: "refusal" }));
    await expect(extractLocalLog({ buffer: PNG })).rejects.toMatchObject({ statusCode: 422 });
    setClientFactory(() => fakeClient({}, { stop_reason: "max_tokens" }));
    await expect(extractLocalLog({ buffer: PNG })).rejects.toMatchObject({ statusCode: 422 });
    setClientFactory(() => fakeClient({}, { content: [{ type: "text", text: "not json" }] }));
    await expect(extractLocalLog({ buffer: PNG })).rejects.toMatchObject({ statusCode: 502 });
    setClientFactory(() => fakeClient({ nope: true }));
    await expect(extractLocalLog({ buffer: PNG })).rejects.toMatchObject({ statusCode: 502 });
  });

  test("rejects unsupported and oversized files before calling the API", async () => {
    const client = fakeClient({ rows: [] });
    setClientFactory(() => client);
    await expect(extractLocalLog({ buffer: Buffer.from("hello") })).rejects.toMatchObject({ statusCode: 400 });
    await expect(extractLocalLog({ buffer: Buffer.concat([JPG, Buffer.alloc(9 * 1024 * 1024)]) })).rejects.toMatchObject({ statusCode: 413 });
    expect(client.calls).toHaveLength(0);
  });
});

describe("AI import over HTTP", () => {
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
    await AiUsage.syncIndexes();
    clearModuleCache();
    setClientFactory(() => fakeClient({ vehicleReg: "AFE 5848", vehicleDescription: "DAF", rows: [row(), row({ mileageOut: 1005, mileageIn: 1010, totalKm: 5 })] }));
  });
  afterEach(() => setClientFactory(() => { throw new Error("no client"); }));

  const company = (modules = { aiImport: true }) =>
    Deliverer.create({ companyName: "Co " + Math.random().toString(36).slice(2, 6), address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"], modules });
  const cookie = async (co) => {
    const u = await User.create({ name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123", phoneNumber: "1", role: "Deliverer Manager", address: "a", city: "c", companyId: co._id });
    return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY)];
  };
  const extract = (ck, buf = PNG) => request(app).post("/api/v2/ai-import/extract").set("Cookie", ck).attach("file", buf, "log.png");

  test("extracts rows, and counts the page against the monthly allowance", async () => {
    const co = await company();
    const ck = await cookie(co);
    const res = await extract(ck);
    expect(res.status).toBe(200);
    expect(res.body.vehicleReg).toBe("AFE 5848");
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.allowance).toMatchObject({ used: 1, limit: 3, remaining: 2 });
    const usage = await AiUsage.findOne({ tenantId: co._id });
    expect(usage).toMatchObject({ pages: 1, calls: 1, inputTokens: 1000, outputTokens: 500 });
  });

  test("stops when the monthly allowance is used up, per company", async () => {
    const a = await company();
    const b = await company();
    const ca = await cookie(a);
    for (let i = 0; i < 3; i += 1) expect((await extract(ca)).status).toBe(200);
    const over = await extract(ca);
    expect(over.status).toBe(429);
    expect((await extract(await cookie(b))).status).toBe(200); // another company is unaffected
  });

  test("needs login, the module, and a real file", async () => {
    expect((await request(app).post("/api/v2/ai-import/extract").attach("file", PNG, "a.png")).status).toBe(401);
    const off = await company({ aiImport: false });
    const blocked = await extract(await cookie(off));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MODULE_DISABLED");
    const on = await cookie(await company());
    expect((await request(app).post("/api/v2/ai-import/extract").set("Cookie", on)).status).toBe(400);
    expect((await extract(on, Buffer.from("not an image"))).status).toBe(400);
  });

  test("reports a clear message when the API key isn't set up", async () => {
    setClientFactory(() => { const e = new (require("../utils/ErrorHandler"))("AI import is not set up yet.", 503); throw e; });
    const res = await extract(await cookie(await company()));
    expect(res.status).toBe(503);
  });

  test("reviewed rows become a workbook the existing Excel importer reads", async () => {
    const ck = await cookie(await company());
    const rows = [
      { driver: "CHRIS", date: "2026-10-01", timeOut: "06:40", mileageOut: 622568, from: "SHIPPY", to: "LAMMEL", mileageIn: 622573, timeIn: "07:00", totalKm: 5, contractor: "PVT" },
      { driver: "CHRIS", date: "2026-10-01", timeOut: "12:25", mileageOut: 622573, from: "LAMMEL", to: "SHER", mileageIn: 622591, timeIn: "13:20", totalKm: 18, contractor: "ROMEO" },
    ];
    const res = await request(app).post("/api/v2/ai-import/workbook").set("Cookie", ck)
      .send({ vehicleReg: "AFE 5848", vehicleDescription: "DAF", rows })
      .buffer(true).parse((r, cb) => { const c = []; r.on("data", (d) => c.push(d)); r.on("end", () => cb(null, Buffer.concat(c))); });
    expect(res.status).toBe(200);

    const parsed = parseVehicleLog(res.body, "photo-log.xlsx");
    const sheet = parsed.sheets[0];
    expect(sheet.skipped).toBeFalsy();
    expect(sheet.regNumber.replace(/\s/g, "")).toBe("AFE5848");
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1]).toMatchObject({ driverName: "CHRIS", from: "LAMMEL", to: "SHER", mileageOut: 622573, mileageIn: 622591, totalKm: 18, contractorRaw: "ROMEO" });
    expect(sheet.rows[0].date.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  test("the workbook step refuses incomplete rows and a bad registration", async () => {
    const ck = await cookie(await company());
    const send = (body) => request(app).post("/api/v2/ai-import/workbook").set("Cookie", ck).send(body);
    expect((await send({ vehicleReg: "nope", rows: [row()] })).status).toBe(400);
    expect((await send({ vehicleReg: "AFE 5848", rows: [] })).status).toBe(400);
    expect((await send({ vehicleReg: "AFE 5848", rows: [row({ date: "" })] })).status).toBe(400);
  });
});
