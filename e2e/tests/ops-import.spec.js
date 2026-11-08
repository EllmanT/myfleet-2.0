/*
 * Job import, API level: the Excel vehicle-log import (preview -> commit) and the AI
 * "photo of a logbook" path. The AI provider is never contacted: its key is blank in the
 * e2e stack, so extraction answers 503 by design; the reviewed-rows -> workbook step is
 * pure code and is exercised for real, then fed back through the Excel preview.
 * Expected numbers come from QA_Vehicle_Log_QAA1001.xlsx in docs/qa/TEST_DATA.md.
 */
const { test, expect } = require("../support/fixtures");
const { Api } = require("../support/api");
const o = require("../support/ops");
const x = require("../support/xlsx");

const IMP = "/api/v2/job-import";
const AI = "/api/v2/ai-import";

const RATES = [
  { rateType: "local", smallVehicle: 0.6, mediumVehicle: 0.9, largeVehicle: 1.2, horse: 2.5 },
  { rateType: "express", smallVehicle: 0.45, mediumVehicle: 0.7, largeVehicle: 0.95, horse: 2 },
];

// Alpha-style company: Depot / Delta Mining / Beta Foods / Gamma Steel, QAA1001 (small), Tendai + Chipo, Lammel QA.
async function alpha(label = "Import", opts = {}) {
  const t = await o.makeTenant(label, opts);
  const admin = await t.api("admin");
  const cid = t.companyId;
  for (const name of ["Depot", "Delta Mining", "Beta Foods", "Gamma Steel"]) await admin.createCustomer(cid, { name });
  await admin.createVehicle(cid, { regNumber: "QAA1001", make: "Toyota Dyna", size: "smallVehicle" });
  await admin.createDriver(cid, { name: "Tendai", idNumber: `T-${t.id}` });
  await admin.createDriver(cid, { name: "Chipo", idNumber: `C-${t.id}` });
  const f = o.form({
    companyName: "Lammel QA", address: "1 Road", city: "Harare", contact: "0771", goodsTypes: "general", vehiclesTypes: "small",
    deliveryTypes: "local,express", companyId: cid, prefix: "LQ", lastOrder: 1, vrates: JSON.stringify(RATES),
  });
  const c = await admin.request("POST", "/api/v2/contractor/create-contractor", { form: f });
  if (c.status !== 201) throw new Error(`contractor setup failed ${c.status} ${c.text}`);
  return { t, admin, manager: await t.api("manager") };
}

const upload = (buffer, name = "QA_Vehicle_Log_QAA1001.xlsx", extra = {}) => {
  const fd = new FormData();
  fd.append("files", new Blob([buffer]), name);
  for (const [k, v] of Object.entries(extra)) fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
  return fd;
};
const preview = (api, buffer, name, extra) => api.request("POST", `${IMP}/preview`, { form: upload(buffer, name, extra) });
const commit = (api, buffer, name, extra) => api.request("POST", `${IMP}/commit`, { form: upload(buffer, name, extra) });
const jobCount = (t) => o.count("jobs", { tenantId: t.companyId });

test.describe("Excel vehicle-log import (API)", () => {
  test("@smoke @full preview of the sample workbook: 6 ready legs, 1 skipped, 1 error, 5 jobs, 127.50", async () => {
    const { t, admin } = await alpha();
    const r = await preview(admin, x.sampleWorkbook());
    expect(r.status).toBe(200);
    const p = r.body.preview;
    expect(p.canCommit).toBe(true);
    expect(p.summary).toMatchObject({ legs: 8, ready: 6, skipped: 1, error: 1, duplicate: 0, blocked: 0, jobs: 5, distance: 220, cost: 127.5, newCustomers: 1 });
    expect(p.sheets).toHaveLength(1);
    expect(p.sheets[0]).toMatchObject({ sheetName: "QAA1001", regNumber: "QAA1001", skipped: false });

    // legs: private trip skipped, odometer-back error, rows below TOTAL ignored (no "Ghost")
    const legs = p.legs;
    expect(legs.filter((l) => l.status === "skipped")).toHaveLength(1);
    const err = legs.find((l) => l.status === "error");
    expect(JSON.stringify(err)).toMatch(/lower than mileage out/i);
    expect(JSON.stringify(p)).not.toContain("Ghost");
    // the J1 pair (rows 1-2) is one job at 30 + 30; express leg is 30 x 0.45 = 13.50
    const costs = p.jobs.map((j) => j.cost).sort((a, b) => a - b);
    expect(costs).toEqual([12, 13.5, 18, 24, 60]);
    expect(p.jobs.find((j) => j.legIds.length === 2)).toMatchObject({ distance: 100, cost: 60, deliveryType: "local", driverName: "Tendai" });
    expect(p.jobs.find((j) => j.deliveryType === "express").cost).toBe(13.5);
    expect(p.newCustomerNames).toEqual(["Unknown Place XYZ"]);

    // a preview is read-only
    expect(await jobCount(t)).toBe(0);
    expect(await o.count("customers", { tenantId: t.companyId, name: "Unknown Place XYZ" })).toBe(0);
    expect((await o.find("contractors", { tenantId: t.companyId }))[0].lastOrder).toBe(1);
  });

  test("@smoke @full commit the sample workbook: message, jobs, new customer, counters, statistics, then a second import adds nothing", async () => {
    const { t, admin } = await alpha("Commit");
    const r = await commit(admin, x.sampleWorkbook());
    expect(r.status).toBe(201);
    expect(r.body.message).toBe("Imported 5 jobs (6 trips)");
    expect(r.body.result).toMatchObject({ jobsCreated: 5, legsCreated: 6, newCustomers: ["Unknown Place XYZ"] });
    expect(r.body.result.jobs.map((j) => j.jobNumber)).toEqual(["LQ0001", "LQ0002", "LQ0003", "LQ0004", "LQ0005"]);

    // 6 legs stored, 127.50 and 220 km in total, the unknown place became a customer
    expect(await jobCount(t)).toBe(6);
    const list = await admin.get("/api/v2/job/get-all-jobs-page?page=0&limit=100&year=2026");
    expect(list.body.totalCount).toBe(6);
    expect(list.body.pageJobs.reduce((s, j) => s + j.cost, 0)).toBeCloseTo(127.5, 2);
    expect(list.body.pageJobs.reduce((s, j) => s + j.distance, 0)).toBe(220);
    expect(await o.count("customers", { tenantId: t.companyId, name: "Unknown Place XYZ" })).toBe(1);
    expect((await o.find("contractors", { tenantId: t.companyId }))[0].lastOrder).toBe(6);
    const stats = (await admin.get("/api/v2/overallStats/get-all-overallStats-company?year=2026")).body.delivererWithOverallStats;
    expect(stats.yearlyJobs).toBe(6);
    expect(Number(stats.yearlyRevenue)).toBeCloseTo(127.5, 2);
    expect(stats.yearlyMileage).toBe(220);

    // importing the same file again: every ready leg is now a duplicate
    const again = await preview(admin, x.sampleWorkbook());
    expect(again.body.preview.summary).toMatchObject({ ready: 0, duplicate: 6, jobs: 0 });
    expect(again.body.preview.canCommit).toBe(false);
    const second = await commit(admin, x.sampleWorkbook());
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/nothing new to import/i);
    expect(await jobCount(t)).toBe(6);
  });

  test("@full the same row twice in one upload is imported once", async () => {
    const { t, admin } = await alpha("Dupes");
    const row = x.SAMPLE_ROWS[0];
    const buf = x.workbook([x.logSheet("QAA1001", [row, row])]);
    const p = (await preview(admin, buf)).body.preview;
    expect(p.summary.ready).toBe(1);
    expect(p.summary.duplicate).toBe(1);
    const c = await commit(admin, buf);
    expect(c.status).toBe(201);
    expect(await jobCount(t)).toBe(1);
  });

  test("@full choices: skipping a contractor imports nothing for it; unresolved vehicle blocks the commit", async () => {
    const { t, admin } = await alpha("Choices");
    const base = await preview(admin, x.sampleWorkbook());
    const contractorKey = base.body.preview.decisions.find((d) => d.kind === "contractor").key;
    const skipped = await preview(admin, x.sampleWorkbook(), "s.xlsx", { choices: { [contractorKey]: "skip" } });
    expect(skipped.body.preview.summary.jobs).toBe(0);
    expect((await commit(admin, x.sampleWorkbook(), "s.xlsx", { choices: { [contractorKey]: "skip" } })).status).toBe(400);
    expect(await jobCount(t)).toBe(0);

    // a sheet for a truck the company does not have cannot be committed
    const stranger = x.workbook([x.logSheet("ZZZ9999", x.SAMPLE_ROWS.slice(0, 1), "UNKNOWN - ZZZ 9999")]);
    const sp = (await preview(admin, stranger)).body.preview;
    expect(sp.canCommit).toBe(false);
    expect((await commit(admin, stranger)).status).toBeGreaterThanOrEqual(400);
    expect(await jobCount(t)).toBe(0);
  });

  test("@full file rules: not Excel, corrupt, no file, too big, too many, malformed choices, sheet that is not a log", async () => {
    const { t, admin } = await alpha("Files");
    const txt = await preview(admin, Buffer.from("hello"), "notes.txt");
    expect(txt.status).toBe(400);
    expect(txt.body.message).toMatch(/not an Excel file/i);
    // a text file renamed to .xlsx must not crash the server and must not be committable
    const corrupt = await preview(admin, Buffer.from("this is not a zip at all"), "corrupt.xlsx");
    expect(corrupt.status).toBeLessThan(500);
    if (corrupt.status === 200) expect(corrupt.body.preview.canCommit).toBe(false);
    expect((await commit(admin, Buffer.from("this is not a zip at all"), "corrupt.xlsx")).status).toBeGreaterThanOrEqual(400);

    const none = await admin.request("POST", `${IMP}/preview`, { form: new FormData() });
    expect(none.status).toBe(400);
    expect(none.body.message).toMatch(/at least one Excel file/i);

    const big = await preview(admin, Buffer.alloc(5 * 1024 * 1024, 1), "big.xlsx");
    expect(big.status).toBeGreaterThanOrEqual(400);
    expect(big.status).toBeLessThan(500);

    const many = new FormData();
    for (let i = 0; i < 11; i++) many.append("files", new Blob([x.sampleWorkbook()]), `f${i}.xlsx`);
    const eleven = await admin.request("POST", `${IMP}/preview`, { form: many });
    expect(eleven.status).toBe(400);

    expect((await preview(admin, x.sampleWorkbook(), "s.xlsx", { choices: "{bad" })).status).toBe(400);

    const notes = await preview(admin, x.workbook([{ name: "Notes", aoa: [["free text"], ["more"]] }]), "n.xlsx");
    expect(notes.status).toBe(200);
    expect(notes.body.preview.sheets[0]).toMatchObject({ skipped: true });
    expect(notes.body.preview.canCommit).toBe(false);
    expect(await jobCount(t)).toBe(0);
  });

  test("@full a Manager can import; anonymous callers cannot", async () => {
    const { t, manager } = await alpha("ImpRoles");
    expect((await commit(manager, x.sampleWorkbook())).status).toBe(201);
    expect(await jobCount(t)).toBe(6);
    expect((await Api.anonymous().request("POST", `${IMP}/preview`, { form: upload(x.sampleWorkbook()) })).status).toBe(401);
    expect((await Api.anonymous().request("POST", `${IMP}/commit`, { form: upload(x.sampleWorkbook()) })).status).toBe(401);
  });

  test("@smoke @full tenant B cannot import into, match against or see A's data", async () => {
    const A = await alpha("ImpA");
    const B = await o.makeTenant("ImpB");
    const b = await B.api();
    const aVeh = (await o.find("vehicles", { tenantId: A.t.companyId }))[0];
    const aDrv = (await o.find("drivers", { tenantId: A.t.companyId, name: "Tendai" }))[0];
    const aCon = (await o.find("contractors", { tenantId: A.t.companyId }))[0];

    // B has none of A's trucks, drivers, contractors or places: nothing resolves and nothing commits
    const p = await preview(b, x.sampleWorkbook());
    expect(p.status).toBe(200);
    expect(p.body.preview.canCommit).toBe(false);
    expect(p.body.preview.summary.ready).toBe(0);
    for (const id of [aVeh._id, aDrv._id, aCon._id]) expect(JSON.stringify(p.body.preview), id).not.toContain(id);
    const c = await commit(b, x.sampleWorkbook());
    expect(c.status).toBeGreaterThanOrEqual(400);
    expect(await jobCount(B)).toBe(0);
    expect(await jobCount(A.t)).toBe(0);

    // forcing A's ids through "choices" is refused as well
    const key = (await preview(A.admin, x.sampleWorkbook())).body.preview.decisions;
    const choices = {};
    for (const d of key) if (["vehicle", "driver", "contractor"].includes(d.kind)) choices[d.key] = d.value;
    const forced = await commit(b, x.sampleWorkbook(), "s.xlsx", { choices });
    expect(forced.status).toBeGreaterThanOrEqual(400);
    expect(await jobCount(B)).toBe(0);
    expect(await jobCount(A.t)).toBe(0);
    expect((await o.find("contractors", { _id: aCon._id }))[0].lastOrder).toBe(1);
  });
});

test.describe("AI photo import, no network (API)", () => {
  test("@smoke @full usage, missing file and not-configured provider answer cleanly and cost nothing", async () => {
    const { admin } = await alpha("Ai");
    const usage = await admin.get(`${AI}/usage`);
    expect(usage.status).toBe(200);
    expect(usage.body).toMatchObject({ used: 0, limit: 100, remaining: 100 });
    expect(usage.body.month).toMatch(/^\d{4}-\d{2}$/);

    const none = await admin.request("POST", `${AI}/extract`, { form: new FormData() });
    expect(none.status).toBe(400);
    expect(none.body.message).toMatch(/photo or PDF/i);

    // provider key is blank in the e2e stack: a clear 503, never a crash, nothing counted
    const fd = new FormData();
    fd.append("file", new Blob([o.JPEG], { type: "image/jpeg" }), "page.jpg");
    const r = await admin.request("POST", `${AI}/extract`, { form: fd });
    expect(r.status).toBe(503);
    expect(r.body.message).toMatch(/not set up/i);
    expect((await admin.get(`${AI}/usage`)).body.used).toBe(0);
  });

  test("@full reviewed rows become a workbook that the Excel preview accepts", async () => {
    const { t, admin } = await alpha("AiWb");
    const rows = [
      { date: "2026-01-05", driver: "Tendai", timeOut: "07:00", from: "Depot", to: "Delta Mining", mileageOut: 1000, mileageIn: 1050, timeIn: "08:00", totalKm: 50, contractor: "Lammel QA" },
      { date: "2026-01-06", driver: "Tendai", timeOut: "07:00", from: "Depot", to: "Beta Foods", mileageOut: 1050, mileageIn: 1080, timeIn: "08:00", totalKm: 30, contractor: "Lammel QA" },
    ];
    const wb = await admin.post(`${AI}/workbook`, { vehicleReg: "QAA 1001", vehicleDescription: "Toyota Dyna", rows }, { raw: true });
    expect(wb.status).toBe(200);
    expect(wb.headers.get("content-type")).toMatch(/spreadsheetml/);
    expect(wb.headers.get("content-disposition")).toMatch(/photo-log\.xlsx/);
    expect(wb.buffer.subarray(0, 2).toString()).toBe("PK");

    const p = await preview(admin, wb.buffer, "photo-log.xlsx");
    expect(p.status).toBe(200);
    expect(p.body.preview.summary).toMatchObject({ legs: 2, ready: 2, error: 0, cost: 48 });
    const c = await commit(admin, wb.buffer, "photo-log.xlsx");
    expect(c.status).toBe(201);
    expect(await jobCount(t)).toBe(2);
  });

  test("@full workbook validation: registration, rows, dates, size", async () => {
    const { admin } = await alpha("AiVal");
    const row = { date: "2026-01-05", driver: "Tendai", from: "Depot", to: "Delta Mining", mileageOut: 1, mileageIn: 2 };
    const post = (b) => admin.post(`${AI}/workbook`, b);
    expect((await post({ vehicleReg: "not a plate", rows: [row] })).status).toBe(400);
    expect((await post({ vehicleReg: "QAA1001", rows: [] })).status).toBe(400);
    expect((await post({ vehicleReg: "QAA1001" })).status).toBe(400);
    expect((await post({ vehicleReg: "QAA1001", rows: [{ ...row, date: "05/01/2026" }] })).status).toBe(400);
    expect((await post({ vehicleReg: "QAA1001", rows: Array.from({ length: 501 }, () => row) })).status).toBe(400);
  });

  test("@full the AI import is blocked when its module is switched off, and for anonymous callers", async () => {
    const t = await o.makeTenant("AiOff", { modules: { aiImport: false } });
    const admin = await t.api();
    for (const [method, url] of [["get", `${AI}/usage`], ["post", `${AI}/workbook`]]) {
      const r = method === "get" ? await admin.get(url) : await admin.post(url, { vehicleReg: "QAA1001", rows: [] });
      expect(r.status, url).toBe(403);
    }
    expect((await Api.anonymous().get(`${AI}/usage`)).status).toBe(401);
  });
});
