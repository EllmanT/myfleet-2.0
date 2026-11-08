/*
 * Fuel log + weekly fuel check, general expenses/income, and the older per-vehicle and
 * per-employee expense routes, API level. Fuel and expenses are finance data: company
 * admins only (a Manager gets 403), and both are switchable modules.
 * Worked data: docs/qa/TEST_DATA.md section 6 (fills F1..F5 on QAC3003 with 4.0 km/L).
 */
const { test, expect } = require("../support/fixtures");
const { Api } = require("../support/api");
const o = require("../support/ops");

const FUEL = "/api/v2/fuel";
const EXP = "/api/v2/expense";

async function setup(label, opts) {
  const t = await o.makeTenant(label, opts);
  const admin = await t.api("admin");
  const manager = await t.api("manager");
  const b = await o.baseline(t, admin, { reg: "QAC3003" });
  await admin.put("/api/v2/vehicle/update-vehicle", { id: b.vehicle._id, make: "Hino 500", size: "largeVehicle", regNumber: "QAC3003", expectedKmPerLitre: 4 });
  return { t, admin, manager, b };
}

const fill = (b, over = {}) => ({
  vehicleId: b.vehicle._id, driverName: "Tendai", filledAt: "2026-03-02T08:00:00Z", odometer: 10000,
  litres: 100, amount: 190, fullTank: true, photoPosted: true, station: "Puma", ...over,
});
// F1..F5 from the worked set
const FILLS = [
  { filledAt: "2026-03-02T08:00:00Z", odometer: 10000, litres: 100, amount: 190 },
  { filledAt: "2026-03-09T08:00:00Z", odometer: 10360, litres: 80, amount: 152 },
  { filledAt: "2026-03-16T08:00:00Z", odometer: 10600, litres: 80, amount: 152 },
  { filledAt: "2026-03-23T08:00:00Z", odometer: 10600, litres: 40, amount: 76 },
  { filledAt: "2026-03-23T12:00:00Z", odometer: 10640, litres: 10, amount: 19, photoPosted: false },
];

test.describe("fuel log (API)", () => {
  test("@smoke @full the worked fills F1-F5: per-fill results and the four weekly summaries", async () => {
    const { admin, b } = await setup("Fuel");
    for (const f of FILLS) expect((await admin.post(`${FUEL}/create-fill`, fill(b, f))).status).toBe(201);

    const all = await admin.get(`${FUEL}/get-fills`);
    expect(all.body.total).toBe(5);
    // newest first: F5, F4, F3, F2, F1
    const [f5, f4, f3, f2, f1] = all.body.fills;
    expect(f1).toMatchObject({ status: "ok", km: null, kmpl: null });
    expect(f2).toMatchObject({ status: "ok", km: 360 });
    expect(f2.kmpl).toBeCloseTo(4.5, 5);
    expect(f2.variancePct).toBeCloseTo(12.5, 5);
    expect(f3).toMatchObject({ status: "check", km: 240 });
    expect(f3.kmpl).toBeCloseTo(3.0, 5);
    expect(f3.variancePct).toBeCloseTo(-25, 5);
    expect(f4.status).toBe("review");
    expect(f4.flags.join(" ")).toMatch(/Odometer did not go up/);
    expect(f5.status).toBe("check");
    expect(f5.flags.join(" ")).toMatch(/Second fill within 12 hours/);
    expect(f5.flags.join(" ")).toMatch(/photos not posted/i);
    expect(f5.vehicleName).toBe("Hino 500 QAC3003");
    expect(f5.expectedKmpl).toBe(4);

    const week = async (date) => (await admin.get(`${FUEL}/weekly?date=${date}`)).body;
    const w1 = await week("2026-03-04");
    expect(w1.weekStart.slice(0, 10)).toBe("2026-03-02");
    expect(w1.weekEnd.slice(0, 10)).toBe("2026-03-09");
    expect(w1.vehicles[0]).toMatchObject({ fills: 1, litres: 100, amount: 190, km: 0, kmpl: null, status: "ok" });

    const w2 = (await week("2026-03-11")).vehicles[0];
    expect(w2).toMatchObject({ fills: 1, litres: 80, amount: 152, km: 360, kmpl: 4.5, expectedLitres: 90, status: "ok" });
    const w3 = (await week("2026-03-18")).vehicles[0];
    expect(w3).toMatchObject({ litres: 80, amount: 152, km: 240, kmpl: 3, expectedLitres: 60, status: "check" });
    const w4body = await week("2026-03-25");
    const w4 = w4body.vehicles[0];
    expect(w4).toMatchObject({ fills: 2, litres: 50, amount: 95, km: 40, kmpl: 4, expectedLitres: 10, status: "review" });
    expect(w4body.text).toContain("Fuel check, week 2026-03-23 to 2026-03-29");
    expect(w4body.text).toContain("Hino 500 QAC3003: 50 L, $95.00, 40 km, 4 km/L (normal 4) - REVIEW");
    expect(w4body.text).toContain("Total: 50 L, $95.00");
    // a week with no fills says so
    expect((await week("2026-06-10")).text).toContain("QAC3003: no fill this week");
    // list filters
    expect((await admin.get(`${FUEL}/get-fills?from=2026-03-10&to=2026-03-20`)).body.total).toBe(1);
    expect((await admin.get(`${FUEL}/get-fills?vehicleId=${b.vehicle._id}`)).body.total).toBe(5);
    expect((await admin.get(`${FUEL}/get-fills?vehicleId=000000000000000000000000`)).body.total).toBe(0);
  });

  test("@full a private fill is split out of the weekly spend; edit and delete", async () => {
    const { admin, b } = await setup("FuelEdit");
    const a = await admin.post(`${FUEL}/create-fill`, fill(b));
    const p = await admin.post(`${FUEL}/create-fill`, fill(b, { filledAt: "2026-03-04T08:00:00Z", odometer: 10100, litres: 20, amount: 38, purpose: "private" }));
    expect(p.body.fill.purpose).toBe("private");
    const w = (await admin.get(`${FUEL}/weekly?date=2026-03-04`)).body.vehicles[0];
    expect(w).toMatchObject({ fills: 2, amount: 190, privateAmount: 38 });

    const up = await admin.put(`${FUEL}/update-fill/${a.body.fill._id}`, { litres: 110, amount: 209 });
    expect(up.status).toBe(200);
    expect(up.body.fill).toMatchObject({ litres: 110, amount: 209, odometer: 10000 });
    expect((await admin.del(`${FUEL}/delete-fill/${p.body.fill._id}`)).status).toBe(200);
    expect((await admin.get(`${FUEL}/get-fills`)).body.total).toBe(1);
    expect((await admin.del(`${FUEL}/delete-fill/${p.body.fill._id}`)).status).toBe(404);
    const meta = await admin.get(`${FUEL}/meta`);
    expect(meta.body.vehicles[0]).toMatchObject({ name: "Hino 500 QAC3003", expectedKmpl: 4 });
  });

  test("@full fuel validation", async () => {
    const { t, admin, b } = await setup("FuelVal");
    const bad = async (label, over, status = 400) => {
      const r = await admin.post(`${FUEL}/create-fill`, fill(b, over));
      expect(r.status, label).toBe(status);
    };
    await bad("no truck", { vehicleId: undefined });
    await bad("malformed truck", { vehicleId: "abc" });
    await bad("unknown truck", { vehicleId: "000000000000000000000000" }, 404);
    await bad("no date", { filledAt: undefined });
    await bad("bad date", { filledAt: "tuesday" });
    await bad("negative odometer", { odometer: -1 });
    await bad("zero litres", { litres: 0 });
    await bad("tiny litres", { litres: 0.05 });
    await bad("negative amount", { amount: -3 });
    await bad("text litres", { litres: "many" });
    await bad("negative cash given", { cashGiven: -1 });
    expect(await o.count("fuelfills", { companyId: t.companyId })).toBe(0);
    const ok = await admin.post(`${FUEL}/create-fill`, fill(b, { purpose: "weird", fullTank: "false", photoPosted: "true", cashGiven: 200 }));
    expect(ok.status).toBe(201);
    expect(ok.body.fill).toMatchObject({ purpose: "business", fullTank: false, photoPosted: true, cashGiven: 200 });
    expect((await admin.put(`${FUEL}/update-fill/not-an-id`, { litres: 1 })).status).toBe(400);
    expect((await admin.put(`${FUEL}/update-fill/${ok.body.fill._id}`, { litres: -1 })).status).toBe(400);
  });

  test("@smoke @full Manager and anonymous are refused; module off blocks admins", async () => {
    const { manager, admin, b } = await setup("FuelRoles");
    const made = await admin.post(`${FUEL}/create-fill`, fill(b));
    const id = made.body.fill._id;
    for (const r of [
      await manager.post(`${FUEL}/create-fill`, fill(b)),
      await manager.get(`${FUEL}/get-fills`),
      await manager.get(`${FUEL}/weekly`),
      await manager.get(`${FUEL}/meta`),
      await manager.put(`${FUEL}/update-fill/${id}`, { litres: 1 }),
      await manager.del(`${FUEL}/delete-fill/${id}`),
    ]) {
      expect(r.status).toBe(403);
    }
    expect((await admin.get(`${FUEL}/get-fills`)).body.total).toBe(1);
    expect((await Api.anonymous().get(`${FUEL}/get-fills`)).status).toBe(401);

    const off = await o.makeTenant("FuelOff", { modules: { fuel: false } });
    const a = await off.api();
    expect((await a.get(`${FUEL}/get-fills`)).status).toBe(403);
    expect((await a.get(`${FUEL}/weekly`)).status).toBe(403);
  });

  test("@smoke @full tenant B cannot log fuel on, read, edit or delete A's fills", async () => {
    const A = await setup("FuelXA");
    const B = await setup("FuelXB");
    const made = await A.admin.post(`${FUEL}/create-fill`, fill(A.b, { station: "A-ONLY-PUMP" }));
    const id = made.body.fill._id;
    const before = (await o.find("fuelfills", { _id: id }))[0];

    expect((await B.admin.post(`${FUEL}/create-fill`, fill(A.b))).status).toBe(404);
    expect((await B.admin.post(`${FUEL}/create-fill`, fill(B.b, { vehicleId: A.b.vehicle._id }))).status).toBe(404);
    expect((await B.admin.put(`${FUEL}/update-fill/${id}`, { litres: 1 })).status).toBe(404);
    expect((await B.admin.del(`${FUEL}/delete-fill/${id}`)).status).toBe(404);
    // B's own fill cannot be re-pointed at A's truck
    const mine = (await B.admin.post(`${FUEL}/create-fill`, fill(B.b))).body.fill._id;
    expect((await B.admin.put(`${FUEL}/update-fill/${mine}`, { vehicleId: A.b.vehicle._id })).status).toBe(404);
    for (const url of [`${FUEL}/get-fills`, `${FUEL}/get-fills?vehicleId=${A.b.vehicle._id}`, `${FUEL}/weekly?date=2026-03-04`, `${FUEL}/meta`]) {
      const r = await B.admin.get(url);
      expect(r.text.includes("A-ONLY-PUMP"), url).toBe(false);
      expect(r.text.includes(A.b.vehicle._id), url).toBe(false);
    }
    expect((await o.find("fuelfills", { _id: id }))[0]).toEqual(before);
  });
});

test.describe("expenses and income (API)", () => {
  test("@smoke @full create, list with filters and paging, edit, delete", async () => {
    const { admin, b } = await setup("Exp");
    const mk = (over) => admin.post(`${EXP}/create-expense`, { type: "expense", category: "insurance", date: "2026-02-15", amount: 150, vehicleId: b.vehicle._id, ...over });
    const e2 = await mk({ description: "Policy" });
    expect(e2.status).toBe(201);
    expect(e2.body.expense).toMatchObject({ type: "expense", category: "insurance", amount: 150, countsInProfit: true });
    await mk({ category: "driver_salary", date: "2026-01-31", amount: 200, payee: "Tendai" });
    await mk({ category: "owner_salary", date: "2026-02-28", amount: 100, retainedInBusiness: true, vehicleId: undefined });
    await mk({ category: "private_fuel", date: "2026-03-10", amount: 30 });
    await mk({ type: "income", category: "cash_hire", date: "2026-01-20", amount: 50 });
    await mk({ category: "fuel", date: "2026-03-01", amount: 80, isEstimate: true });

    const all = await admin.get(`${EXP}/get-expenses?pageSize=100`);
    expect(all.body.total).toBe(6);
    expect(all.body.expenses[0].date.slice(0, 10)).toBe("2026-03-10"); // newest first
    expect(all.body.expenses.find((e) => e.category === "private_fuel").countsInProfit).toBe(false); // tracked only
    expect((await admin.get(`${EXP}/get-expenses?type=income`)).body.total).toBe(1);
    expect((await admin.get(`${EXP}/get-expenses?type=expense`)).body.total).toBe(5);
    expect((await admin.get(`${EXP}/get-expenses?category=insurance`)).body.total).toBe(1);
    expect((await admin.get(`${EXP}/get-expenses?from=2026-02-01&to=2026-02-28`)).body.total).toBe(2);
    expect((await admin.get(`${EXP}/get-expenses?vehicleId=${b.vehicle._id}`)).body.total).toBe(5);
    const p0 = await admin.get(`${EXP}/get-expenses?page=0&pageSize=4`);
    const p1 = await admin.get(`${EXP}/get-expenses?page=1&pageSize=4`);
    expect(p0.body.expenses).toHaveLength(4);
    expect(p1.body.expenses).toHaveLength(2);

    const up = await admin.put(`${EXP}/update-expense/${e2.body.expense._id}`, { amount: 175, description: "Policy renewed" });
    expect(up.status).toBe(200);
    expect(up.body.expense).toMatchObject({ amount: 175, description: "Policy renewed", category: "insurance" });
    // clearing the truck on edit works
    const cleared = await admin.put(`${EXP}/update-expense/${e2.body.expense._id}`, { vehicleId: "" });
    expect(cleared.body.expense.vehicleId).toBeUndefined();
    expect((await admin.del(`${EXP}/delete-expense/${e2.body.expense._id}`)).status).toBe(200);
    expect((await admin.get(`${EXP}/get-expenses`)).body.total).toBe(5);
    expect((await admin.del(`${EXP}/delete-expense/${e2.body.expense._id}`)).status).toBe(404);
  });

  test("@full expense validation: category per type, amount, date, truck", async () => {
    const { t, admin, b } = await setup("ExpVal");
    const mk = (over) => admin.post(`${EXP}/create-expense`, { type: "expense", category: "service", date: "2026-02-15", amount: 40, ...over });
    expect((await mk({ category: "cash_hire" })).status).toBe(400); // income category on an expense
    expect((await mk({ type: "income", category: "fuel" })).status).toBe(400);
    expect((await mk({ category: "pizza" })).status).toBe(400);
    expect((await mk({ category: undefined })).status).toBe(400);
    expect((await mk({ amount: -1 })).status).toBe(400);
    expect((await mk({ amount: "much" })).status).toBe(400);
    expect((await mk({ amount: undefined })).status).toBe(400);
    expect((await mk({ date: "someday" })).status).toBe(400);
    expect((await mk({ date: undefined })).status).toBe(400);
    expect((await mk({ vehicleId: "abc" })).status).toBe(400);
    expect((await mk({ vehicleId: "000000000000000000000000" })).status).toBe(404);
    expect((await mk({ litres: -2 })).status).toBe(400);
    expect(await o.count("expenses", { companyId: t.companyId })).toBe(0);
    const zero = await mk({ amount: 0, vehicleId: b.vehicle._id, litres: 20, pricePerLitre: 1.9 });
    expect(zero.status).toBe(201);
    expect(zero.body.expense).toMatchObject({ amount: 0, litres: 20, pricePerLitre: 1.9 });
    const rounded = await mk({ amount: 10.126 });
    expect(rounded.body.expense.amount).toBe(10.13);
    // an unknown type is treated as an expense, never trusted
    expect((await mk({ type: "gift" })).body.expense.type).toBe("expense");
    expect((await admin.put(`${EXP}/update-expense/nope`, { amount: 1 })).status).toBe(400);
  });

  test("@smoke @full Manager and anonymous are refused; module off blocks admins", async () => {
    const { manager, admin } = await setup("ExpRoles");
    const made = await admin.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 5 });
    const id = made.body.expense._id;
    for (const r of [
      await manager.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 5 }),
      await manager.get(`${EXP}/get-expenses`),
      await manager.put(`${EXP}/update-expense/${id}`, { amount: 1 }),
      await manager.del(`${EXP}/delete-expense/${id}`),
      await manager.get(`${EXP}/profitability`),
    ]) {
      expect(r.status).toBe(403);
    }
    expect((await admin.get(`${EXP}/get-expenses`)).body.total).toBe(1);
    expect((await Api.anonymous().get(`${EXP}/get-expenses`)).status).toBe(401);
    const off = await o.makeTenant("ExpOff", { modules: { expenses: false } });
    const a = await off.api();
    expect((await a.get(`${EXP}/get-expenses`)).status).toBe(403);
    expect((await a.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 5 })).status).toBe(403);
  });

  test("@smoke @full tenant B cannot read, edit, delete or attach expenses to A's data", async () => {
    const A = await setup("ExpXA");
    const B = await setup("ExpXB");
    const made = await A.admin.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 77, description: "A-ONLY-COST", vehicleId: A.b.vehicle._id });
    const id = made.body.expense._id;
    const before = (await o.find("expenses", { _id: id }))[0];
    expect((await B.admin.put(`${EXP}/update-expense/${id}`, { amount: 1 })).status).toBe(404);
    expect((await B.admin.del(`${EXP}/delete-expense/${id}`)).status).toBe(404);
    expect((await B.admin.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 1, vehicleId: A.b.vehicle._id })).status).toBe(404);
    const mine = (await B.admin.post(`${EXP}/create-expense`, { type: "expense", category: "other", date: "2026-02-15", amount: 1 })).body.expense._id;
    expect((await B.admin.put(`${EXP}/update-expense/${mine}`, { vehicleId: A.b.vehicle._id })).status).toBe(404);
    for (const url of [`${EXP}/get-expenses`, `${EXP}/get-expenses?vehicleId=${A.b.vehicle._id}`, `${EXP}/profitability?year=2026`]) {
      const r = await B.admin.get(url);
      expect(r.text.includes("A-ONLY-COST"), url).toBe(false);
      expect(r.text.includes(A.b.vehicle._id), url).toBe(false);
    }
    expect((await o.find("expenses", { _id: id }))[0]).toEqual(before);
  });
});

test.describe("vehicle and employee expense routes (API)", () => {
  const VEXP = "/api/v2/expenses/vehicle";
  const EEXP = "/api/v2/expenses/employee";

  test("@full a foreign vehicle or employee is refused on create and read", async () => {
    const A = await setup("OldExpA");
    const B = await setup("OldExpB");
    const form = (b) => o.form(b);
    const cases = [
      [VEXP, "create-vehicle-expense", { vehicleId: A.b.vehicle._id, cost: 10, description: "x", date: "2026-02-01" }],
      [EEXP, "create-employee-expense", { employeeId: A.b.driver._id, cost: 10, description: "x", date: "2026-02-01" }],
    ];
    for (const [base, route, body] of cases) {
      const r = await B.admin.request("POST", `${base}/${route}`, { form: form(body) });
      expect(r.status, route).toBe(404);
    }
    expect((await B.admin.get(`${VEXP}/get-vehicle-expenses/${A.b.vehicle._id}`)).status).toBe(404);
    expect((await B.admin.get(`${EEXP}/get-employee-expenses/${A.b.driver._id}`)).status).toBe(404);
    expect((await Api.anonymous().get(`${VEXP}/get-vehicle-expenses/${A.b.vehicle._id}`)).status).toBe(401);
    expect(await o.count("vehicleexpenses", { companyId: A.t.companyId })).toBe(0);
  });
});
