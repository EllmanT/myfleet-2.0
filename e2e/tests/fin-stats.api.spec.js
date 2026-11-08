/*
 * Dashboard statistics, per-vehicle / driver / contractor stats and the profitability report,
 * checked against the hand-worked ANALYTICS-2026 set in docs/qa/TEST_DATA.md (section 6), plus:
 * stats staying in step when jobs are created, edited and deleted, year filters, rebuild-stats,
 * reconciliation between the different pages, and tenant isolation of every figure.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant } = require("../support/tenants");
const { Api } = require("../support/api");
const { ctl } = require("../support/control");
const { buildStatsCo, buildReference, addJobs, find, iso, EXPECT, JOBS, jobPayload } = require("../support/fin");

const OVERALL = "/api/v2/overallStats/get-all-overallStats-company";
const PROFIT = "/api/v2/expense/profitability";
const num = (v) => Number(v);
const money = (v) => Math.round(num(v) * 100) / 100;

const overall = async (api, year) => (await api.get(`${OVERALL}?year=${year}`)).body.delivererWithOverallStats;
const profit = async (api, year = 2026) => (await api.get(`${PROFIT}?year=${year}`)).body;
const vehicleStats = async (api, vehicle, year = 2026) => (await api.get(`/api/v2/vehicleStats/get-vehicleStats/${vehicle._id}?year=${year}`)).body;
const driverStats = async (api, driver, year = 2026) => (await api.get(`/api/v2/driverStats/get-driverStats/${driver._id}?year=${year}`)).body;
const contractorStats = async (api, c, year = 2026) => (await api.get(`/api/v2/contractorStats/get-contractorStats/${c._id}?year=${year}`)).body;
const month = (stats, name) => stats.monthlyData.find((m) => m.month === name);

/** Everything a figure-for-figure comparison needs, as plain numbers. */
const digest = (s) => ({
  jobs: s.yearlyJobs, km: num(s.yearlyMileage), revenue: money(s.yearlyRevenue),
  months: Object.fromEntries(s.monthlyData.map((m) => [m.month, [m.totalJobs, num(m.totalMileage), money(m.totalRevenue)]])),
  days: Object.fromEntries(s.dailyData.map((d) => [d.date, [d.totalJobs, num(d.totalMileage), money(d.totalRevenue)]])),
  byContractorJobs: { ...(s.jobsByContractor || {}) },
  byContractorRevenue: Object.fromEntries(Object.entries(s.revenueByContractor || {}).map(([k, v]) => [k, money(v)])),
});

test.describe("QA Stats Co: the worked example, exact figures", () => {
  test.describe.configure({ mode: "serial" });
  let co;
  test.beforeAll(async () => {
    co = await buildStatsCo("StatsCo");
  });

  test("@smoke @full dashboard 2026: 7 legs, 394.00 revenue, 490 km, 5 customers, 2 contractors", async () => {
    const s = await overall(co.api, 2026);
    expect(s.year).toBe(2026);
    expect(s.yearlyJobs).toBe(EXPECT.jobs2026.legs);
    expect(money(s.yearlyRevenue)).toBe(EXPECT.jobs2026.revenue);
    expect(num(s.yearlyMileage)).toBe(EXPECT.jobs2026.km);
    expect(s.totalCustomers).toBe(5);
    expect(s.totalContractors).toBe(EXPECT.jobs2026.contractors);
  });

  test("@smoke @full by month: Jan 2 / 90.00 / 150 km, Feb 3 / 184.00 / 240 km, Mar 2 / 120.00 / 100 km, in calendar order", async () => {
    const s = await overall(co.api, 2026);
    expect(s.monthlyData.map((m) => m.month)).toEqual(["January", "February", "March"]);
    for (const [name, e] of Object.entries(EXPECT.month2026)) {
      const m = month(s, name);
      expect([m.totalJobs, money(m.totalRevenue), num(m.totalMileage)], name).toEqual([e.jobs, e.revenue, e.km]);
    }
  });

  test("@full by day matches the table, in date order", async () => {
    const s = await overall(co.api, 2026);
    expect(s.dailyData.map((d) => d.date)).toEqual(Object.keys(EXPECT.day2026));
    for (const d of s.dailyData) {
      const [jobs, revenue, km] = EXPECT.day2026[d.date];
      expect([d.totalJobs, money(d.totalRevenue), num(d.totalMileage)], d.date).toEqual([jobs, revenue, km]);
    }
  });

  test("@full by contractor: Lammel QA 5 jobs / 294.00 (74.6%), U-Plan QA 2 jobs / 100.00", async () => {
    const s = await overall(co.api, 2026);
    expect(s.jobsByContractor).toEqual({ "Lammel QA": 5, "U-Plan QA": 2 });
    expect(money(s.revenueByContractor["Lammel QA"])).toBe(294);
    expect(money(s.revenueByContractor["U-Plan QA"])).toBe(100);
    expect(Math.round((294 / 394) * 1000) / 10).toBe(74.6);
  });

  test("@smoke @full year filter: 2025 shows only J7 (1 job, 6.00, 10 km, December); a year with no jobs is an empty state, not an error", async () => {
    const s25 = await overall(co.api, 2025);
    expect(s25).toMatchObject({ year: 2025, yearlyJobs: 1, totalCustomers: 5 });
    expect([money(s25.yearlyRevenue), num(s25.yearlyMileage)]).toEqual([6, 10]);
    expect(s25.monthlyData.map((m) => m.month)).toEqual(["December"]);
    expect(s25.dailyData.map((d) => d.date)).toEqual(["2025-12-30"]);

    // 2024 has no data: the API falls back to the company's latest year, or reports empty
    const r = await co.api.get(`${OVERALL}?year=2024`);
    expect(r.status).toBeLessThan(300);
    const s24 = r.body.delivererWithOverallStats;
    expect(s24.year === 2026 || s24.empty === true, JSON.stringify({ year: s24.year, empty: s24.empty })).toBe(true);
    // the default year (no param) is the current calendar year
    const dflt = await co.api.get(OVERALL);
    expect(dflt.body.delivererWithOverallStats.year).toBe(new Date().getFullYear());
  });

  test("@full year parameter is validated (abc, 1999, 2101 -> 400) on the main stats endpoint", async () => {
    for (const bad of ["abc", "1999", "2101", "20.5"]) {
      expect((await co.api.get(`${OVERALL}?year=${bad}`)).status, bad).toBe(400);
    }
  });

  // FINDING: parseYear() throws inside the try block of these two handlers, so a bad year is
  // reported as 500 "Invalid year query parameter" instead of 400 (get-all-overallStats is fine).
  test.fixme("@full year parameter is validated (400) on get-total-jobs / get-total-rev stats endpoints", async () => {
    for (const bad of ["abc", "1999"]) {
      for (const ep of ["get-total-jobs-overallStats-company", "get-total-rev-overallStats-company"]) {
        expect((await co.api.get(`/api/v2/overallStats/${ep}?year=${bad}`)).status, `${ep} ${bad}`).toBe(400);
      }
    }
  });

  test("@smoke @full per-vehicle stats: QAA1001 3 / 110.00 / 190 km, QAB2002 2 / 164.00 / 200 km, QAC3003 2 / 120.00 / 100 km", async () => {
    const want = { QAA1001: [3, 110, 190], QAB2002: [2, 164, 200], QAC3003: [2, 120, 100] };
    for (const [reg, [jobs, revenue, km]] of Object.entries(want)) {
      const { vehicleStats: v } = await vehicleStats(co.api, co.ids.vehicles[reg]);
      expect([v.yearlyJobs, money(v.yearlyRevenue), num(v.yearlyMileage)], reg).toEqual([jobs, revenue, km]);
    }
    // 2025 only has QAA1001's J7
    const v25 = (await vehicleStats(co.api, co.ids.vehicles.QAA1001, 2025)).vehicleStats;
    expect([v25.yearlyJobs, money(v25.yearlyRevenue)]).toEqual([1, 6]);
    expect((await vehicleStats(co.api, co.ids.vehicles.QAB2002, 2025)).success).toBe(false);
  });

  test("@full per-driver stats: Tendai 4 / 190.00 / 270 km, Chipo 3 / 204.00 / 220 km", async () => {
    const want = { Tendai: [4, 190, 270], Chipo: [3, 204, 220] };
    for (const [name, [jobs, revenue, km]] of Object.entries(want)) {
      const { driverStats: d } = await driverStats(co.api, co.ids.drivers[name]);
      expect([d.yearlyJobs, money(d.yearlyRevenue), num(d.yearlyMileage)], name).toEqual([jobs, revenue, km]);
    }
  });

  test("@full per-contractor stats: Lammel QA 5 / 294.00 / 370 km, U-Plan QA 2 / 100.00 / 120 km", async () => {
    const want = { "Lammel QA": [5, 294, 370], "U-Plan QA": [2, 100, 120] };
    for (const [name, [jobs, revenue, km]] of Object.entries(want)) {
      const { contractorStats: c } = await contractorStats(co.api, co.ids.contractors[name]);
      expect([c.yearlyJobs, money(c.yearlyRevenue), num(c.yearlyMileage)], name).toEqual([jobs, revenue, km]);
    }
  });

  test("@smoke @full profitability 2026: revenue 444.00, costs 1,039.00, profit -595.00, cash profit -495.00, private fuel 30.00", async () => {
    const p = await profit(co.api);
    const t = p.totals;
    expect(p.year).toBe(2026);
    for (const [k, v] of Object.entries(EXPECT.profit2026.totals)) expect(money(t[k]), `totals.${k}`).toBe(v);
    expect(t.jobs).toBe(7);
    expect(t.km).toBe(490);
  });

  test("@full profitability by month: Jan -60.00, Feb -66.00 (cash profit 34.00), Mar -469.00 (estimate E6 replaced by real fills)", async () => {
    const p = await profit(co.api);
    expect(p.months).toHaveLength(12);
    for (const [idx, key] of [[0, "Jan"], [1, "Feb"], [2, "Mar"]]) {
      for (const [k, v] of Object.entries(EXPECT.profit2026[key])) expect(money(p.months[idx][k]), `${key}.${k}`).toBe(v);
    }
    // the other nine months are zero across the board
    for (const m of p.months.slice(3)) expect([m.revenue, m.totalExpenses, m.profit]).toEqual([0, 0, 0]);
    // March counted costs are the five real fills, not the 80.00 estimate
    expect(money(p.months[2].expenses.fuel)).toBe(589);
  });

  test("@full profitability by vehicle and shared costs; profits add up to -595.00", async () => {
    const p = await profit(co.api);
    const by = Object.fromEntries(p.vehicles.map((v) => [v.vehicle.split(" ").pop(), v]));
    expect(Object.keys(by).sort()).toEqual(["QAA1001", "QAB2002", "QAC3003"]);
    for (const reg of ["QAA1001", "QAB2002", "QAC3003"]) {
      for (const [k, v] of Object.entries(EXPECT.profit2026[reg])) expect(money(by[reg][k]), `${reg}.${k}`).toBe(v);
    }
    for (const [k, v] of Object.entries(EXPECT.profit2026.overhead)) expect(money(p.overhead[k]), `overhead.${k}`).toBe(v);
    const sum = p.vehicles.reduce((s, v) => s + v.profit, 0) + p.overhead.profit;
    expect(money(sum)).toBe(-595);
  });

  test("@full profitability year filter: 2025 has J7 only (revenue 6.00, no costs); 2024 is all zeros", async () => {
    const p25 = await profit(co.api, 2025);
    expect(money(p25.totals.revenue)).toBe(6);
    expect(p25.totals.totalExpenses).toBe(0);
    expect(p25.months[11].jobs).toBe(1);
    const p24 = await profit(co.api, 2024);
    expect(p24.totals).toMatchObject({ revenue: 0, profit: 0, totalExpenses: 0, jobs: 0 });
  });

  test("@smoke @full RECONCILIATION: dashboard revenue = profitability job revenue; revenue + other income = profitability revenue", async () => {
    const s = await overall(co.api, 2026);
    const p = await profit(co.api);
    expect(money(s.yearlyRevenue)).toBe(money(p.totals.jobRevenue));
    expect(money(p.totals.revenue)).toBe(money(s.yearlyRevenue) + money(p.totals.otherIncome));
    expect(s.yearlyJobs).toBe(p.totals.jobs);
    expect(num(s.yearlyMileage)).toBe(p.totals.km);
    // month by month
    for (const m of s.monthlyData) {
      const idx = new Date(`${m.month} 1, 2026`).getMonth();
      expect(money(m.totalRevenue), m.month).toBe(money(p.months[idx].jobRevenue));
      expect(m.totalJobs, m.month).toBe(p.months[idx].jobs);
    }
    // vehicle by vehicle
    for (const reg of ["QAA1001", "QAB2002", "QAC3003"]) {
      const v = (await vehicleStats(co.api, co.ids.vehicles[reg])).vehicleStats;
      const row = p.vehicles.find((x) => x.vehicle.endsWith(reg));
      expect(money(v.yearlyRevenue), reg).toBe(money(row.jobRevenue));
    }
  });

  test("@full RECONCILIATION: company, vehicle, driver and contractor totals all describe the same jobs", async () => {
    const s = await overall(co.api, 2026);
    const sum = async (items, fn) => (await Promise.all(items.map(fn))).reduce((a, b) => ({ jobs: a.jobs + b.yearlyJobs, rev: a.rev + money(b.yearlyRevenue), km: a.km + num(b.yearlyMileage) }), { jobs: 0, rev: 0, km: 0 });
    const v = await sum(Object.values(co.ids.vehicles), async (x) => (await vehicleStats(co.api, x)).vehicleStats);
    const d = await sum(Object.values(co.ids.drivers), async (x) => (await driverStats(co.api, x)).driverStats);
    const c = await sum(Object.values(co.ids.contractors), async (x) => (await contractorStats(co.api, x)).contractorStats);
    for (const part of [v, d, c]) expect(part).toEqual({ jobs: s.yearlyJobs, rev: money(s.yearlyRevenue), km: num(s.yearlyMileage) });
    // monthly and daily buckets add up to the yearly figure
    expect(s.monthlyData.reduce((a, m) => a + money(m.totalRevenue), 0)).toBeCloseTo(money(s.yearlyRevenue), 2);
    expect(s.dailyData.reduce((a, m) => a + money(m.totalRevenue), 0)).toBeCloseTo(money(s.yearlyRevenue), 2);
    expect(s.dailyData.reduce((a, m) => a + m.totalJobs, 0)).toBe(s.yearlyJobs);
    expect(Object.values(s.jobsByContractor).reduce((a, b) => a + b, 0)).toBe(s.yearlyJobs);
  });

  test("@full the job list endpoint reports the same total cost for the year as the dashboard", async () => {
    const r = await co.api.get("/api/v2/job/get-all-jobs-page?page=0&pageSize=100&limit=100&year=2026");
    expect(r.status).toBeLessThan(300);
    const rows = r.body.rows || [];
    expect(r.body.totalCount).toBe(7);
    const total = rows.reduce((a, j) => a + money(j.cost), 0);
    expect(rows).toHaveLength(7);
    expect(money(total)).toBe(394);
  });

  // CONFIRMED FINDING: OverallStats never receives expenses. For the worked example the dashboard /
  // revenue-analytics statistics say yearlyExpenses 0.00 and yearlyProfit 394.00 (= revenue), while
  // the profitability page says costs 1,039.00 and profit -595.00. The revenue-analytics charts plot
  // totalExpenses / totalProfit from these fields (RevenueBarChart, RevenueOverviewChart).
  test.fixme("@smoke @full the revenue-analytics figures agree with the profitability page on expenses and profit", async () => {
    const s = await overall(co.api, 2026);
    const p = await profit(co.api);
    expect(money(s.yearlyExpenses), "dashboard/analytics expenses vs profitability costs").toBe(money(p.totals.totalExpenses));
    expect(money(s.yearlyProfit), "dashboard/analytics profit vs profitability profit").toBe(money(p.totals.profit));
  });

  test("@full manager role: dashboard statistics are readable, the profitability report is admin-only", async () => {
    const mgr = await co.t.api("manager");
    expect((await mgr.get(`${OVERALL}?year=2026`)).status).toBeLessThan(300);
    const p = await mgr.get(`${PROFIT}?year=2026`);
    expect(p.status).toBe(403);
    expect(p.text).not.toMatch(/-595|1039|444/);
  });

  test("@full anonymous callers get 401 on every statistics endpoint", async () => {
    const anon = Api.anonymous();
    for (const path of [OVERALL, "/api/v2/overallStats/get-total-jobs-overallStats-company", "/api/v2/overallStats/get-total-rev-overallStats-company", `/api/v2/vehicleStats/get-vehicleStats/${co.ids.vehicles.QAA1001._id}`, `/api/v2/driverStats/get-driverStats/${co.ids.drivers.Tendai._id}`, `/api/v2/contractorStats/get-contractorStats/${co.ids.contractors["Lammel QA"]._id}`, `${PROFIT}?year=2026`]) {
      expect((await anon.get(path)).status, path).toBe(401);
    }
  });
});

test.describe("tenant B's analytics never include tenant A's figures", () => {
  test("@smoke @full overlapping customer, vehicle, contractor and driver names: each company sees only its own totals", async () => {
    // same reference names in both companies (QAA1001, Lammel QA, Tendai, Delta Mining...), different jobs
    const A = await buildStatsCo("OverlapA");
    const B = await buildReference("OverlapB");
    const bJobs = [
      { n: "J1", date: "2026-01-12", ctr: "Lammel QA", veh: "QAA1001", drv: "Tendai", type: "local", legs: [["Depot", "Delta Mining", 5000, 5010, 10, 7.77]] },
      { n: "J2", date: "2026-04-02", ctr: "U-Plan QA", veh: "QAB2002", drv: "Chipo", type: "local", legs: [["Depot", "Beta Foods", 5000, 5020, 20, 3.33]] },
    ];
    await addJobs(B.api, B.ids, bJobs);
    await B.api.mustPost("/api/v2/expense/create-expense", { type: "expense", category: "insurance", amount: 11, date: iso("2026-04-03"), vehicleId: B.ids.vehicles.QAB2002._id });

    const sB = await overall(B.api, 2026);
    expect(sB.yearlyJobs).toBe(2);
    expect(money(sB.yearlyRevenue)).toBe(11.1);
    expect(num(sB.yearlyMileage)).toBe(30);
    expect(sB.monthlyData.map((m) => m.month)).toEqual(["January", "April"]);
    expect(sB.jobsByContractor).toEqual({ "Lammel QA": 1, "U-Plan QA": 1 });
    expect(money(sB.revenueByContractor["Lammel QA"])).toBe(7.77);
    // no trace of A's 394.00 / 294.00 / 2025 job
    expect(JSON.stringify(sB)).not.toMatch(/394|294\.00|2025-12-30/);

    const pB = await profit(B.api);
    expect(pB.totals).toMatchObject({ jobs: 2, jobRevenue: 11.1, totalExpenses: 11, otherIncome: 0 });
    expect(pB.vehicles.map((v) => v.vehicle.split(" ").pop()).sort()).toEqual(["QAA1001", "QAB2002"]);
    const bA = pB.vehicles.find((v) => v.vehicle.endsWith("QAA1001"));
    expect(bA.jobRevenue).toBe(7.77); // not A's 110.00 for the same plate
    expect(pB.overhead.totalExpenses).toBe(0);

    // per-vehicle stats for B's QAA1001 are B's only
    const vB = (await vehicleStats(B.api, B.ids.vehicles.QAA1001)).vehicleStats;
    expect([vB.yearlyJobs, money(vB.yearlyRevenue)]).toEqual([1, 7.77]);

    // and A is untouched by B's activity
    const sA = await overall(A.api, 2026);
    expect([sA.yearlyJobs, money(sA.yearlyRevenue), num(sA.yearlyMileage)]).toEqual([7, 394, 490]);
    expect(money((await profit(A.api)).totals.profit)).toBe(-595);

    // B's session cannot read A's per-entity stats (404/403, never the figures)
    for (const [path] of [[`/api/v2/vehicleStats/get-vehicleStats/${A.ids.vehicles.QAA1001._id}?year=2026`], [`/api/v2/driverStats/get-driverStats/${A.ids.drivers.Tendai._id}?year=2026`], [`/api/v2/contractorStats/get-contractorStats/${A.ids.contractors["Lammel QA"]._id}?year=2026`]]) {
      const r = await B.api.get(path);
      expect([403, 404], path).toContain(r.status);
      expect(r.text, path).not.toMatch(/110|294|190/);
    }
  });

  test("@full a company with no jobs sees zeros, never another company's latest year", async ({ world }) => {
    const empty = await createTenant("EmptyStats");
    const api = await empty.api();
    const s = await overall(api, 2026);
    expect(s).toMatchObject({ empty: true, yearlyJobs: 0, yearlyRevenue: 0, monthlyData: [], dailyData: [] });
    const p = await profit(api);
    expect(p.totals).toMatchObject({ revenue: 0, profit: 0, jobs: 0 });
    expect(JSON.stringify(s) + JSON.stringify(p)).not.toContain(world.A.id.toUpperCase());
  });
});

test.describe("stats stay in step with jobs", () => {
  async function fixture() {
    const ref = await buildReference("Sync");
    const mk = (jobNumber, date, cost, km, ctr = "Lammel QA", veh = "QAA1001", drv = "Tendai") =>
      jobPayload(ref.ids, { n: jobNumber, date, ctr, veh, drv, type: "local" }, ["Depot", "Delta Mining", 100, 100 + km, km, cost]);
    const jobId = async (n) => (await find("jobs", { tenantId: ref.t.companyId, jobNumber: n }))[0]._id;
    return { ...ref, mk, jobId };
  }

  test("@smoke @full create, edit (cost, distance, date into another month and year, contractor) and delete keep every statistic exact", async () => {
    const f = await fixture();
    const { api } = f;
    await api.mustPost("/api/v2/job/create-job", [f.mk("S1", "2026-02-10", 50, 20)]);
    await api.mustPost("/api/v2/job/create-job", [f.mk("S2", "2026-02-11", 30.25, 10)]);
    let s = await overall(api, 2026);
    expect([s.yearlyJobs, money(s.yearlyRevenue), num(s.yearlyMileage)]).toEqual([2, 80.25, 30]);
    expect((await profit(api)).totals.jobRevenue).toBe(80.25);

    // edit cost and distance of S1
    const id1 = await f.jobId("S1");
    expect((await api.put("/api/v2/job/update-job", { jobId: id1, cost: "70.00", distance: 25 })).status).toBeLessThan(300);
    s = await overall(api, 2026);
    expect([s.yearlyJobs, money(s.yearlyRevenue), num(s.yearlyMileage)]).toEqual([2, 100.25, 35]);
    expect(month(s, "February")).toMatchObject({ totalJobs: 2 });
    expect(money((await profit(api)).totals.jobRevenue)).toBe(100.25);

    // move S2 into March 2026 and switch it to the other contractor/vehicle/driver
    const id2 = await f.jobId("S2");
    await api.put("/api/v2/job/update-job", { jobId: id2, orderDate: iso("2026-03-15"), contractorId: f.ids.contractors["U-Plan QA"]._id, vehicleId: f.ids.vehicles.QAB2002._id, driverId: f.ids.drivers.Chipo._id });
    s = await overall(api, 2026);
    expect(s.monthlyData.map((m) => [m.month, m.totalJobs, money(m.totalRevenue)])).toEqual([["February", 1, 70], ["March", 1, 30.25]]);
    expect(s.dailyData.map((d) => d.date)).toEqual(["2026-02-10", "2026-03-15"]);
    expect(s.jobsByContractor).toEqual({ "Lammel QA": 1, "U-Plan QA": 1 });
    expect((await vehicleStats(api, f.ids.vehicles.QAB2002)).vehicleStats.yearlyJobs).toBe(1);
    expect((await vehicleStats(api, f.ids.vehicles.QAA1001)).vehicleStats.yearlyJobs).toBe(1);
    expect((await driverStats(api, f.ids.drivers.Chipo)).driverStats.yearlyJobs).toBe(1);
    const lam = (await contractorStats(api, f.ids.contractors["Lammel QA"])).contractorStats;
    expect([lam.yearlyJobs, money(lam.yearlyRevenue)]).toEqual([1, 70]);

    // move S1 into the previous year: 2026 loses it, 2025 gains it
    await api.put("/api/v2/job/update-job", { jobId: id1, orderDate: iso("2025-11-20") });
    s = await overall(api, 2026);
    expect([s.yearlyJobs, money(s.yearlyRevenue)]).toEqual([1, 30.25]);
    const s25 = await overall(api, 2025);
    expect([s25.yearlyJobs, money(s25.yearlyRevenue), s25.monthlyData[0].month]).toEqual([1, 70, "November"]);
    expect((await profit(api, 2025)).totals.jobRevenue).toBe(70);

    // delete both: everything returns to zero (no phantom buckets left behind)
    expect((await api.del(`/api/v2/job/delete-job/${id1}`)).status).toBeLessThan(300);
    expect((await api.del(`/api/v2/job/delete-job/${id2}`)).status).toBeLessThan(300);
    s = await overall(api, 2026);
    expect([s.yearlyJobs, money(s.yearlyRevenue), num(s.yearlyMileage)]).toEqual([0, 0, 0]);
    expect(s.monthlyData).toEqual([]);
    expect(s.dailyData).toEqual([]);
    // Values must at least be zero; stale zero keys are tolerated here and covered by the next test.
    expect(Object.values(s.jobsByContractor || {}).every((v) => Number(v) === 0), JSON.stringify(s.jobsByContractor)).toBe(true);
    expect(Object.values(s.revenueByContractor || {}).every((v) => Number(v) === 0), JSON.stringify(s.revenueByContractor)).toBe(true);
    expect((await profit(api)).totals).toMatchObject({ jobRevenue: 0, jobs: 0 });
    expect((await overall(api, 2025)).yearlyJobs).toBe(0);
  });

  test("@smoke @full incrementally maintained statistics equal a from-scratch rebuild (no drift)", async ({ world }) => {
    const f = await fixture();
    const { api } = f;
    for (const j of JOBS) await api.mustPost("/api/v2/job/create-job", j.legs.map((leg) => jobPayload(f.ids, j, leg)));
    // churn: edit and delete a few
    await api.put("/api/v2/job/update-job", { jobId: await f.jobId("J2"), cost: "35.50", distance: 55 });
    await api.put("/api/v2/job/update-job", { jobId: await f.jobId("J5"), orderDate: iso("2026-04-01") });
    await api.del(`/api/v2/job/delete-job/${await f.jobId("J3")}`);
    const before = { y26: digest(await overall(api, 2026)), y25: digest(await overall(api, 2025)) };

    const platform = await Api.login(world.platform.email, world.platform.password);
    const rb = await platform.post("/api/v2/overallStats/rebuild-stats", { companyId: f.t.companyId });
    expect(rb.status).toBe(200);
    expect(rb.body.message).toMatch(/rebuilt/i);

    const after = { y26: digest(await overall(api, 2026)), y25: digest(await overall(api, 2025)) };
    expect(after).toEqual(before);
    // expected by hand: 2026 jobs = J1 60 + J2 35.50 + J4 84 + J5 20 + J6 120 = 319.50, 6 legs
    expect(after.y26.jobs).toBe(6);
    expect(after.y26.revenue).toBe(319.5);
  });

  test("@full rebuild-stats permissions: platform admin only, company must be named and exist; a company admin and manager get 403", async ({ world }) => {
    const f = await fixture();
    await f.api.mustPost("/api/v2/job/create-job", [f.mk("R1", "2026-06-01", 10, 5)]);
    const url = "/api/v2/overallStats/rebuild-stats";
    expect((await Api.anonymous().post(url, { companyId: f.t.companyId })).status).toBe(401);
    expect((await f.api.post(url, { companyId: f.t.companyId })).status).toBe(403);
    expect((await (await f.t.api("manager")).post(url, { companyId: f.t.companyId })).status).toBe(403);
    const platform = await Api.login(world.platform.email, world.platform.password);
    expect((await platform.post(url, {})).status).toBe(400);
    expect((await platform.post(url, { companyId: "nope" })).status).toBe(400);
    expect((await platform.post(url, { companyId: "64b000000000000000000000" })).status).toBe(404);
    expect((await platform.post(url, { companyId: f.t.companyId })).status).toBe(200);
  });

  test("@full rebuilding company A leaves company B's statistics exactly as they were", async ({ world }) => {
    const A = await buildStatsCo("RbA");
    const B = await buildReference("RbB");
    await addJobs(B.api, B.ids, [JOBS[0], JOBS[6]]);
    const bBefore = { y26: digest(await overall(B.api, 2026)), y25: digest(await overall(B.api, 2025)) };
    const platform = await Api.login(world.platform.email, world.platform.password);
    expect((await platform.post("/api/v2/overallStats/rebuild-stats", { companyId: A.t.companyId })).status).toBe(200);
    expect({ y26: digest(await overall(B.api, 2026)), y25: digest(await overall(B.api, 2025)) }).toEqual(bBefore);
    expect(bBefore.y26.revenue).toBe(60);
    // A's own stats after the rebuild are still the worked example
    const sA = await overall(A.api, 2026);
    expect([sA.yearlyJobs, money(sA.yearlyRevenue)]).toEqual([7, 394]);
    expect(money((await profit(A.api)).totals.profit)).toBe(-595);
  });

  test("@full managers can create jobs and the statistics follow; one job number may span several legs", async () => {
    const f = await fixture();
    const mgr = await f.t.api("manager");
    const legs = [f.mk("M1", "2026-07-01", 12, 6), f.mk("M1", "2026-07-01", 8, 4)];
    legs[1].mileageOut = "106";
    legs[1].mileageIn = "110";
    const r = await mgr.post("/api/v2/job/create-job", legs);
    expect(r.status).toBe(201);
    const s = await overall(f.api, 2026);
    expect([s.yearlyJobs, money(s.yearlyRevenue), num(s.yearlyMileage)]).toEqual([2, 20, 10]);
    expect(s.dailyData).toHaveLength(1);
  });

  test("@full deleting a job that is already billed on an issued invoice", async () => {
    const f = await fixture();
    const { api } = f;
    await api.mustPost("/api/v2/job/create-job", [f.mk("BL1", "2026-08-05", 40, 10)]);
    const inv = (await api.post("/api/v2/invoice/draft-from-jobs", { contractorId: f.ids.contractors["Lammel QA"]._id, from: "2026-08-01", to: "2026-08-31" })).body.invoice;
    const issuedRes = await api.post(`/api/v2/invoice/issue/${inv._id}`);
    expect(issuedRes.status).toBe(200);
    const jid = await f.jobId("BL1");
    const del = await api.del(`/api/v2/job/delete-job/${jid}`);
    // The invoice is a locked legal-ish document; the job behind it vanishes and the invoice keeps its line.
    expect(del.status).toBeLessThan(300);
    expect((await api.get(`/api/v2/invoice/get-invoice/${inv._id}`)).body.invoice.total).toBe(40);
    expect((await overall(api, 2026)).yearlyJobs).toBe(0);
    expect((await api.get("/api/v2/invoice/unbilled")).body.jobs).toEqual([]);
  });
});
