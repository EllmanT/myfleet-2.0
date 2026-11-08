/*
 * Jobs, API level: create / edit / delete, validation, cross-company id rejection,
 * list filters, pagination and the CSV / PDF exports. Expected values come from
 * docs/qa/TEST_DATA.md (J1: Depot > Delta Mining, 100 km x 0.60 = 60.00; J6 has two legs).
 */
const { test, expect } = require("../support/fixtures");
const { Api } = require("../support/api");
const o = require("../support/ops");

const J = "/api/v2/job";

async function setup(label = "Jobs") {
  const t = await o.makeTenant(label);
  const admin = await t.api("admin");
  const manager = await t.api("manager");
  const b = await o.baseline(t, admin);
  return { t, admin, manager, b };
}
const listAll = (api, q = "") => api.get(`${J}/get-all-jobs-page?page=0&limit=100&year=all${q}`);
const jobs = (r) => r.body.pageJobs;

test.describe("jobs: create, edit, delete (API)", () => {
  test("@smoke @full create a job, see it listed with its customers, then edit and delete it", async () => {
    const { t, admin, b } = await setup();
    const c = await admin.post(`${J}/create-job`, [o.jobPayload(b)]);
    expect(c.status).toBe(201);
    expect(c.body.jobs).toHaveLength(1);

    const list = await listAll(admin);
    expect(list.body.totalCount).toBe(1);
    const row = jobs(list)[0];
    expect(row).toMatchObject({ jobNumber: "LQ-1", deliveryType: "local", distance: 100, cost: 60 });
    expect(row.from.name).toBe("Depot");
    expect(row.customer.name).toBe("Delta Mining");
    expect(row.contractorId.companyName).toBe("Lammel QA");
    expect(row.tenantId).toBe(t.companyId);

    // one job number used -> contractor counter moves by one
    expect((await o.find("contractors", { _id: b.contractor._id }))[0].lastOrder).toBe(1);
    // the company's, vehicle's, driver's and contractor's job lists all carry it
    const jobId = row._id;
    expect((await o.find("deliverers", { _id: t.companyId }))[0].job_ids).toContain(jobId);
    expect((await o.find("vehicles", { _id: b.vehicle._id }))[0].job_ids).toContain(jobId);
    expect((await o.find("drivers", { _id: b.driver._id }))[0].job_ids).toContain(jobId);

    // yearly statistics follow the job
    const stats = await admin.get("/api/v2/overallStats/get-all-overallStats-company?year=2026");
    expect(stats.body.delivererWithOverallStats.yearlyJobs).toBe(1);
    expect(Number(stats.body.delivererWithOverallStats.yearlyRevenue)).toBe(60);
    expect(stats.body.delivererWithOverallStats.yearlyMileage).toBe(100);

    // edit: cost and distance (J1 -> 84.00 / 120 km), description, driver unchanged
    const up = await admin.put(`${J}/update-job`, { jobId, cost: "84.00", distance: 120, description: "Edited run", mileageIn: "1120" });
    expect(up.status).toBeLessThan(300);
    const after = jobs(await listAll(admin))[0];
    expect(after).toMatchObject({ cost: 84, distance: 120, description: "Edited run", mileageIn: "1120" });
    const stats2 = await admin.get("/api/v2/overallStats/get-all-overallStats-company?year=2026");
    expect(Number(stats2.body.delivererWithOverallStats.yearlyRevenue)).toBe(84);
    expect(stats2.body.delivererWithOverallStats.yearlyJobs).toBe(1);

    // edit the date into another year: the job leaves 2026 stats and is found under 2025
    await admin.put(`${J}/update-job`, { jobId, orderDate: "2025-12-30T00:00:00.000Z" });
    expect((await admin.get(`${J}/get-all-jobs-page?page=0&limit=10&year=2025`)).body.totalCount).toBe(1);
    expect((await admin.get(`${J}/get-all-jobs-page?page=0&limit=10&year=2026`)).body.totalCount).toBe(0);

    const del = await admin.del(`${J}/delete-job/${jobId}`);
    expect(del.status).toBeLessThan(300);
    expect(await o.count("jobs", { _id: jobId })).toBe(0);
    expect((await listAll(admin)).body.totalCount).toBe(0);
    expect((await o.find("deliverers", { _id: t.companyId }))[0].job_ids).not.toContain(jobId);
    expect((await o.find("vehicles", { _id: b.vehicle._id }))[0].job_ids).not.toContain(jobId);
    const stats3 = await admin.get("/api/v2/overallStats/get-all-overallStats-company?year=2025");
    expect(Number(stats3.body.delivererWithOverallStats?.yearlyRevenue || 0)).toBe(0);
  });

  test("@full a two-leg job (J6) is two rows, one job number, and the counter moves once", async () => {
    const { admin, b } = await setup("Legs");
    const r = await admin.post(`${J}/create-job`, [
      o.jobPayload(b, { jobNumber: "LQ-6", mileageOut: "30000", mileageIn: "30060", distance: 60, cost: "72.00", orderDate: "2026-03-05T00:00:00.000Z" }),
      o.jobPayload(b, { jobNumber: "LQ-6", from: b.delta._id, customer: b.depot._id, mileageOut: "30060", mileageIn: "30100", distance: 40, cost: "48.00", orderDate: "2026-03-05T00:00:00.000Z" }),
    ]);
    expect(r.status).toBe(201);
    const list = await listAll(admin);
    expect(list.body.totalCount).toBe(2);
    expect(jobs(list).map((j) => j.cost).sort()).toEqual([48, 72]);
    expect((await o.find("contractors", { _id: b.contractor._id }))[0].lastOrder).toBe(1);
    const stats = await admin.get("/api/v2/overallStats/get-all-overallStats-company?year=2026");
    expect(stats.body.delivererWithOverallStats.yearlyJobs).toBe(2);
    expect(Number(stats.body.delivererWithOverallStats.yearlyRevenue)).toBe(120);
    expect(stats.body.delivererWithOverallStats.yearlyMileage).toBe(100);
  });

  test("@full create-job validation: required fields, bad dates, empty list, nothing half-saved", async () => {
    const { t, admin, b } = await setup("Valid");
    const none = async () => expect(await o.count("jobs", { tenantId: t.companyId })).toBe(0);
    for (const field of ["jobNumber", "description", "deliveryType", "mileageOut", "mileageIn", "orderDate", "from", "customer"]) {
      const r = await admin.post(`${J}/create-job`, [o.jobPayload(b, { [field]: undefined })]);
      expect(r.status, `missing ${field}`).toBe(400);
    }
    expect((await admin.post(`${J}/create-job`, [o.jobPayload(b, { orderDate: "not a date" })])).status).toBe(400);
    expect((await admin.post(`${J}/create-job`, [])).status).toBe(400);
    await none();

    // a batch where the second leg is bad saves nothing at all
    const mixed = await admin.post(`${J}/create-job`, [o.jobPayload(b), o.jobPayload(b, { description: undefined, jobNumber: "LQ-2" })]);
    expect(mixed.status).toBe(400);
    await none();
    expect((await o.find("contractors", { _id: b.contractor._id }))[0].lastOrder).toBe(0);
    expect((await o.find("deliverers", { _id: t.companyId }))[0].job_ids).toHaveLength(0);
  });

  // Found while writing this suite: the server takes whatever number it is given.
  test.fixme("@full create-job rejects a negative distance, a negative cost, a non-numeric cost and a missing cost", async () => {
    const { admin, b } = await setup("Numbers");
    for (const over of [{ distance: -5 }, { cost: "-10" }, { cost: "abc" }, { cost: undefined }]) {
      const r = await admin.post(`${J}/create-job`, [o.jobPayload(b, over)]);
      expect(r.status, JSON.stringify(over)).toBe(400);
    }
  });

  test("@full a client cannot choose the owner company of a job", async () => {
    const A = await setup("OwnerA");
    const B = await o.makeTenant("OwnerB");
    const r = await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b, { tenantId: B.companyId, companyId: B.companyId })]);
    expect(r.status).toBe(201);
    expect((await o.find("jobs", { tenantId: A.t.companyId }))).toHaveLength(1);
    expect(await o.count("jobs", { tenantId: B.companyId })).toBe(0);
  });

  test("@full Manager can create, edit and delete jobs; anonymous cannot", async () => {
    const { manager, b, t } = await setup("Roles");
    const c = await manager.post(`${J}/create-job`, [o.jobPayload(b)]);
    expect(c.status).toBe(201);
    const id = c.body.jobs[0]._id;
    expect((await manager.put(`${J}/update-job`, { jobId: id, description: "by manager" })).status).toBeLessThan(300);
    expect((await manager.del(`${J}/delete-job/${id}`)).status).toBeLessThan(300);

    const anon = Api.anonymous();
    expect((await anon.post(`${J}/create-job`, [o.jobPayload(b)])).status).toBe(401);
    expect((await anon.get(`${J}/get-all-jobs-page?page=0`)).status).toBe(401);
    expect((await anon.get(`${J}/export-jobs-csv`)).status).toBe(401);
    expect(await o.count("jobs", { tenantId: t.companyId })).toBe(0);
  });
});

test.describe("jobs: another company's ids are rejected (API)", () => {
  test("@smoke @full create-job refuses a customer, vehicle, driver or contractor from another company", async () => {
    const A = await setup("XA");
    const B = await setup("XB");
    for (const [label, over] of [
      ["customer", { customer: B.b.delta._id }],
      ["from", { from: B.b.depot._id }],
      ["vehicle", { vehicleId: B.b.vehicle._id }],
      ["driver", { driverId: B.b.driver._id }],
      ["contractor", { contractorId: B.b.contractor._id }],
    ]) {
      const r = await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b, over)]);
      expect(r.status, label).toBe(400);
    }
    // an unknown but well-formed id and a malformed one
    expect((await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b, { vehicleId: "000000000000000000000000" })])).status).toBe(400);
    expect((await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b, { driverId: "nope" })])).status).toBeGreaterThanOrEqual(400);
    expect(await o.count("jobs", { tenantId: A.t.companyId })).toBe(0);
    expect(await o.count("jobs", { tenantId: B.t.companyId })).toBe(0);
    // neither company's job lists or counters were touched
    for (const x of [A, B]) {
      expect((await o.find("contractors", { _id: x.b.contractor._id }))[0].lastOrder).toBe(0);
      expect((await o.find("vehicles", { _id: x.b.vehicle._id }))[0].job_ids).toHaveLength(0);
    }
  });

  test("@smoke @full update-job and delete-job on another company's job answer 404 and change nothing", async () => {
    const A = await setup("YA");
    const B = await setup("YB");
    const made = await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b)]);
    const jobId = made.body.jobs[0]._id;
    const before = (await o.find("jobs", { _id: jobId }))[0];

    const up = await B.admin.put(`${J}/update-job`, { jobId, description: "hacked", cost: "1.00" });
    expect(up.status).toBe(404);
    expect((await B.admin.del(`${J}/delete-job/${jobId}`)).status).toBe(404);
    expect((await o.find("jobs", { _id: jobId }))[0]).toEqual(before);

    // B's own job cannot be re-pointed at A's vehicle / driver / contractor / customer
    const mine = (await B.admin.post(`${J}/create-job`, [o.jobPayload(B.b)])).body.jobs[0]._id;
    for (const [label, body] of [
      ["vehicle", { vehicleId: A.b.vehicle._id }],
      ["driver", { driverId: A.b.driver._id }],
      ["contractor", { contractorId: A.b.contractor._id }],
      ["customer", { pageCustomerId: A.b.delta._id }],
      ["from", { fromId: A.b.depot._id }],
    ]) {
      const r = await B.admin.put(`${J}/update-job`, { jobId: mine, ...body });
      expect(r.status, label).toBe(404);
    }
    const stored = (await o.find("jobs", { _id: mine }))[0];
    expect(stored.vehicleId).toBe(B.b.vehicle._id);
    expect(stored.driverId).toBe(B.b.driver._id);
    expect(stored.contractorId).toBe(B.b.contractor._id);
    expect((await o.find("vehicles", { _id: A.b.vehicle._id }))[0].job_ids).toEqual([jobId]);
  });

  test("@full scoped job lists and exports for another company's vehicle, driver or contractor answer 404", async () => {
    const A = await setup("ZA");
    const B = await setup("ZB");
    await A.admin.post(`${J}/create-job`, [o.jobPayload(A.b)]);
    for (const url of [
      `${J}/get-latest-jobs-contractor/${A.b.contractor._id}`,
      `${J}/get-all-jobsReport-contractor/${A.b.contractor._id}`,
      `${J}/get-all-jobsReport-vehicle/${A.b.vehicle._id}`,
      `${J}/get-all-jobsReport-driver/${A.b.driver._id}`,
      `${J}/export-jobs-csv?scope=vehicle&entityId=${A.b.vehicle._id}`,
      `${J}/export-jobs-csv?scope=driver&entityId=${A.b.driver._id}`,
      `${J}/export-jobs-csv?scope=contractor&entityId=${A.b.contractor._id}`,
      `${J}/export-jobs-pdf?scope=vehicle&entityId=${A.b.vehicle._id}`,
    ]) {
      const r = await B.admin.get(url);
      expect([403, 404], url).toContain(r.status);
      expect(r.text.includes("Depot"), url).toBe(false);
      expect(r.text.includes("LQ-1"), url).toBe(false);
    }
    // positive control: A reaches its own export
    const own = await A.admin.get(`${J}/export-jobs-csv?scope=vehicle&entityId=${A.b.vehicle._id}&year=all`);
    expect(own.status).toBe(200);
    expect(own.text).toContain("LQ-1");
  });
});

test.describe("jobs: lists, filters, pagination and exports (API)", () => {
  // J1..J5 of the analytics set, spread over Jan-Feb 2026 and two contractors, plus J7 in 2025.
  async function analyticsSet() {
    const s = await setup("List");
    const { admin, t, b } = s;
    await admin.createContractor(t.companyId, { companyName: "U-Plan QA", prefix: "UP" });
    await admin.createCustomer(t.companyId, { name: "Beta Foods" });
    const uplan = (await o.find("contractors", { tenantId: t.companyId, companyName: "U-Plan QA" }))[0];
    const beta = (await o.find("customers", { tenantId: t.companyId, name: "Beta Foods" }))[0];
    const mk = (over) => admin.post(`${J}/create-job`, [o.jobPayload(b, over)]);
    await mk({ jobNumber: "LQ-1", orderDate: "2026-01-10T00:00:00.000Z", distance: 100, cost: "60.00" });
    await mk({ jobNumber: "LQ-2", orderDate: "2026-01-25T00:00:00.000Z", distance: 50, cost: "30.00", from: b.delta._id, customer: b.depot._id });
    await mk({ jobNumber: "UP-1", orderDate: "2026-02-03T00:00:00.000Z", distance: 80, cost: "80.00", contractorId: uplan._id, customer: beta._id });
    await mk({ jobNumber: "LQ-3", orderDate: "2026-02-14T00:00:00.000Z", distance: 120, cost: "84.00", deliveryType: "express" });
    await mk({ jobNumber: "UP-2", orderDate: "2026-02-20T00:00:00.000Z", distance: 40, cost: "20.00", contractorId: uplan._id, deliveryType: "express" });
    await mk({ jobNumber: "LQ-0", orderDate: "2025-12-30T00:00:00.000Z", distance: 10, cost: "6.00" });
    return { ...s, uplan, beta };
  }

  test("@smoke @full year filter, search, paging and sorting", async () => {
    const { admin } = await analyticsSet();
    const q = (s) => admin.get(`${J}/get-all-jobs-page?page=0&limit=100${s}`);

    expect((await q("&year=2026")).body.totalCount).toBe(5);
    expect((await q("&year=2025")).body.totalCount).toBe(1);
    expect((await q("&year=all")).body.totalCount).toBe(6);
    expect((await q("&year=2024")).body.totalCount).toBe(0);
    const rev = jobs(await q("&year=2026")).reduce((s, j) => s + j.cost, 0);
    expect(rev).toBe(274); // 60 + 30 + 80 + 84 + 20

    // search hits job number, customer, contractor and delivery type; it is case-insensitive
    expect((await q("&year=all&jobSearch=UP-")).body.totalCount).toBe(2);
    expect((await q("&year=all&jobSearch=beta")).body.totalCount).toBe(1);
    expect((await q("&year=all&jobSearch=u-plan")).body.totalCount).toBe(2);
    expect((await q("&year=all&jobSearch=express")).body.totalCount).toBe(2);
    expect((await q("&year=all&jobSearch=zzz")).body.totalCount).toBe(0);
    // regex characters are searched as text, not as a pattern
    expect((await q("&year=all&jobSearch=.*")).body.totalCount).toBe(0);
    expect((await q("&year=all&jobSearch=(")).status).toBe(200);

    // paging: 6 rows, 4 per page; page index starts at 0; pages do not overlap
    const p0 = await admin.get(`${J}/get-all-jobs-page?page=0&limit=4&year=all`);
    const p1 = await admin.get(`${J}/get-all-jobs-page?page=1&limit=4&year=all`);
    const p2 = await admin.get(`${J}/get-all-jobs-page?page=2&limit=4&year=all`);
    expect(p0.body.totalCount).toBe(6);
    expect(jobs(p0)).toHaveLength(4);
    expect(jobs(p1)).toHaveLength(2);
    expect(jobs(p2)).toHaveLength(0);
    const ids = [...jobs(p0), ...jobs(p1)].map((j) => j._id);
    expect(new Set(ids).size).toBe(6);
    // default order is newest order date first
    expect(jobs(p0)[0].jobNumber).toBe("UP-2");
    expect(jobs(p1).at(-1).jobNumber).toBe("LQ-0");
    // pageSize is accepted as an alias, limit is capped at 100, nonsense falls back to defaults
    expect(jobs(await admin.get(`${J}/get-all-jobs-page?page=0&pageSize=2&year=all`))).toHaveLength(2);
    expect((await admin.get(`${J}/get-all-jobs-page?page=0&limit=100000&year=all`)).body.limit).toBe(100);
    const odd = await admin.get(`${J}/get-all-jobs-page?page=-3&limit=abc&year=all`);
    expect(odd.status).toBe(200);
    expect(odd.body.page).toBe(0);
    expect(odd.body.limit).toBe(25);

    // sort by cost ascending
    const sorted = await q(`&year=all&sort=${encodeURIComponent(JSON.stringify({ field: "distance", sort: "asc" }))}`);
    expect(jobs(sorted).map((j) => j.distance)).toEqual([10, 40, 50, 80, 100, 120]);
    // a malformed sort falls back to the default instead of failing
    expect((await q("&year=all&sort=%7Bbad")).status).toBe(200);
  });

  test.fixme("@full an invalid year answers 400 (it answers 500 today: the ErrorHandler is re-wrapped)", async () => {
    const { admin } = await setup("Year");
    const r = await admin.get(`${J}/get-all-jobs-page?year=abc`);
    expect(r.status).toBe(400);
  });

  test("@smoke @full CSV export: header, totals, filters, file name", async () => {
    const { admin, b } = await analyticsSet();
    const r = await admin.get(`${J}/export-jobs-csv?year=2026&entityName=Alpha%20Co`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/csv/);
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="Alpha-Co-\d{4}-\d{2}-\d{2}-jobs\.csv"/);
    const lines = r.text.split("\n");
    expect(lines[0]).toBe('"Deliverer: Alpha Co"');
    expect(lines[1]).toBe('"Period: Year: 2026"');
    expect(lines[2]).toBe('"Total Jobs: 5","Total Distance: 390.00 km","Total Cost: $274.00"');
    expect(lines[4]).toBe('"Job Number","Delivery Type","Contractor","From","Customer","Mileage Out","Mileage In","Distance (km)","Cost ($)","Order Date"');
    expect(lines).toHaveLength(5 + 5);
    // oldest first by default; the first data row is J1
    expect(lines[5]).toBe('"LQ-1","local","Lammel QA","Depot","Delta Mining","1000","1100","100.00","60.00","2026-01-10"');

    // date range overrides the year; search narrows
    const range = await admin.get(`${J}/export-jobs-csv?startDate=2026-02-01&endDate=2026-02-28`);
    expect(range.text).toContain('"Total Jobs: 3"');
    const search = await admin.get(`${J}/export-jobs-csv?year=all&jobSearch=express`);
    expect(search.text).toContain('"Total Jobs: 2"');
    // per-vehicle scope names the file after the vehicle
    const veh = await admin.get(`${J}/export-jobs-csv?year=all&scope=vehicle&entityId=${b.vehicle._id}&entityName=QAA1001&vehicleMake=Toyota%20Dyna`);
    expect(veh.headers.get("content-disposition")).toMatch(/filename="Toyota-Dyna-QAA1001-\d{4}-\d{2}-\d{2}-jobs\.csv"/);
    expect(veh.text).toContain('"Total Jobs: 6"');
    // quotes inside values are doubled so a row cannot break out of its cell
    await admin.createCustomer(b.vehicle.tenantId, { name: 'Say "hi", Ltd' });
    const odd = (await o.find("customers", { tenantId: b.vehicle.tenantId, name: 'Say "hi", Ltd' }))[0];
    expect((await admin.post(`${J}/create-job`, [o.jobPayload(b, { jobNumber: "Q-1", customer: odd._id, orderDate: "2026-03-01T00:00:00.000Z" })])).status).toBe(201);
    const q = await admin.get(`${J}/export-jobs-csv?year=2026&jobSearch=hi`);
    expect(q.text).toContain('"Say ""hi"", Ltd"');
  });

  // A customer called =HYPERLINK(...) is written to the CSV unchanged, so Excel runs it as a formula.
  test.fixme("@full CSV export neutralises spreadsheet formulas in names", async () => {
    const { admin, b, t } = await setup("Csv");
    const evil = '=HYPERLINK("http://evil.test","click")';
    await admin.createCustomer(t.companyId, { name: evil });
    const c = (await o.find("customers", { tenantId: t.companyId, name: evil }))[0];
    await admin.post(`${J}/create-job`, [o.jobPayload(b, { customer: c._id })]);
    const r = await admin.get(`${J}/export-jobs-csv?year=all`);
    expect(r.text).not.toMatch(/"=HYPERLINK/);
  });

  test("@full PDF export returns a PDF; invalid year is refused; B's export never contains A's jobs", async ({ world }) => {
    const { admin } = await analyticsSet();
    const pdf = await admin.get(`${J}/export-jobs-pdf?year=all`, { raw: true });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await admin.get(`${J}/export-jobs-csv?year=1999`)).status).toBeGreaterThanOrEqual(400);

    const b = await world.B.api();
    const csv = await b.get(`${J}/export-jobs-csv?year=all`);
    expect(csv.text).not.toContain(world.dataA.marker);
    expect(csv.text).toContain(world.dataB.marker);
  });

  test("@full latest-jobs and scoped lists only show the caller's own jobs", async ({ world }) => {
    const { A, B, dataA, dataB } = world;
    const a = await A.api();
    const b = await B.api();
    const la = await a.get(`${J}/get-latest-jobs-deliverer`);
    const lb = await b.get(`${J}/get-latest-jobs-deliverer`);
    expect(la.text).toContain(dataA.marker);
    expect(la.text).not.toContain(dataB.marker);
    expect(lb.text).toContain(dataB.marker);
    expect(lb.text).not.toContain(dataA.marker);
    const own = await a.get(`${J}/get-latest-jobs-vehicle/${dataA.vehicle._id}?page=1&pageSize=10`);
    expect(own.status).toBeLessThan(300);
    expect(own.text).toContain(dataA.marker);
  });
});
