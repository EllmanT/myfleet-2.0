/*
 * Invoices, credit notes, payments, receivables ageing, numbering and quotations through the API.
 * Figures come from the hand-worked sets in docs/qa/TEST_DATA.md section 7. Every test makes its
 * own tenant (state-changing), so nothing here disturbs the shared A/B world.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant } = require("../support/tenants");
const { find, day, draft, issued } = require("../support/fin");

const INV = "/api/v2/invoice";
const PAY = "/api/v2/payment";
const QUO = "/api/v2/quotation";

const get = async (api, id) => (await api.get(`${INV}/get-invoice/${id}`)).body.invoice;
const pay = (api, body) => api.post(`${PAY}/record-payment`, body);

test.describe("invoice arithmetic and lifecycle", () => {
  test("@smoke @full worked example: 2 x 45.50 + 1 x 100.00 at 15% = 191.00 + 28.65 = 219.65", async () => {
    const t = await createTenant("InvMath");
    const api = await t.api();
    const inv = await draft(api, {
      customerName: "Math Customer",
      taxRatePct: 15,
      lines: [{ description: "Leg A", quantity: 2, unitPrice: 45.5 }, { description: "Leg B", quantity: 1, unitPrice: 100 }],
    });
    expect(inv).toMatchObject({ status: "draft", subtotal: 191, tax: 28.65, total: 219.65, balance: 219.65, paid: 0, paymentStatus: "draft" });
    expect(inv.lines.map((l) => l.amount)).toEqual([91, 100]);

    // part-pay 100.00 -> balance 119.65, then two credit notes (20.00, 99.65) settle it exactly
    const issuedInv = (await api.post(`${INV}/issue/${inv._id}`)).body.invoice;
    expect(issuedInv.number).toBe("INV-0001");
    expect((await pay(api, { allocations: [{ invoiceId: inv._id, amount: 100 }], amount: 100, customerName: "Math Customer" })).status).toBe(201);
    let cur = await get(api, inv._id);
    expect(cur).toMatchObject({ paid: 100, balance: 119.65, paymentStatus: "partial" });

    const cn1 = await api.post(`${INV}/credit-note/${inv._id}`, { amount: 20, reason: "damaged goods" });
    expect(cn1.status).toBe(200);
    expect(cn1.body.invoice.creditNotes[0]).toMatchObject({ number: "CN-0001", amount: 20 });
    expect(cn1.body.invoice.balance).toBe(99.65);
    const cn2 = await api.post(`${INV}/credit-note/${inv._id}`, { amount: 99.65 });
    expect(cn2.body.invoice).toMatchObject({ balance: 0, paymentStatus: "paid", credits: 119.65 });
    expect(cn2.body.invoice.creditNotes.map((c) => c.number)).toEqual(["CN-0001", "CN-0002"]);

    // a credit larger than the balance, or on a settled invoice, is refused
    expect((await api.post(`${INV}/credit-note/${inv._id}`, { amount: 0.01 })).status).toBe(400);
  });

  test("@smoke @full draft is editable, issued is locked; issue gives a gap-free number; delete only drafts", async () => {
    const t = await createTenant("InvLife");
    const api = await t.api();
    const d1 = await draft(api, { customerName: "Life" });
    expect(d1.number).toBeFalsy();
    const upd = await api.put(`${INV}/update-invoice/${d1._id}`, { lines: [{ description: "New", quantity: 3, unitPrice: 10 }] });
    expect(upd.status).toBe(200);
    expect(upd.body.invoice.total).toBe(30);

    const n1 = (await api.post(`${INV}/issue/${d1._id}`)).body.invoice;
    expect(n1.number).toBe("INV-0001");
    expect(n1.status).toBe("issued");

    // locked
    const edit = await api.put(`${INV}/update-invoice/${d1._id}`, { notes: "sneaky" });
    expect(edit.status).toBe(409);
    expect(edit.body.message).toMatch(/issued invoices are locked/i);
    expect((await api.del(`${INV}/delete-invoice/${d1._id}`)).status).toBe(409);
    expect((await api.post(`${INV}/issue/${d1._id}`)).status).toBe(409); // cannot issue twice

    // numbers continue without gaps; drafts that are deleted never consume a number
    const gone = await draft(api);
    expect((await api.del(`${INV}/delete-invoice/${gone._id}`)).status).toBe(200);
    const n2 = await issued(api);
    const n3 = await issued(api);
    expect([n2.number, n3.number]).toEqual(["INV-0002", "INV-0003"]);
  });

  test("@full numbering is per company: two companies both start at INV-0001", async () => {
    const [a, b] = [await createTenant("NumA"), await createTenant("NumB")];
    const [apiA, apiB] = [await a.api(), await b.api()];
    expect((await issued(apiA)).number).toBe("INV-0001");
    expect((await issued(apiB)).number).toBe("INV-0001");
    expect((await issued(apiA)).number).toBe("INV-0002");
  });

  test("@full concurrent issues never hand out the same number", async () => {
    const t = await createTenant("NumRace");
    const api = await t.api();
    const drafts = await Promise.all([1, 2, 3, 4, 5, 6].map(() => draft(api)));
    const results = await Promise.all(drafts.map((d) => api.post(`${INV}/issue/${d._id}`)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const numbers = results.map((r) => r.body.invoice.number).sort();
    expect(numbers).toEqual(["INV-0001", "INV-0002", "INV-0003", "INV-0004", "INV-0005", "INV-0006"]);
  });

  test("@full validation: no lines, zero total, bad tax, due before issue, no customer", async () => {
    const t = await createTenant("InvValid");
    const api = await t.api();
    const post = (b) => api.post(`${INV}/create-invoice`, b);
    const line = [{ description: "x", quantity: 1, unitPrice: 10 }];
    expect((await post({ customerName: "V", lines: [] })).status).toBe(400);
    expect((await post({ lines: line })).status).toBe(400); // customer required
    expect((await post({ customerName: "V", lines: line, taxRatePct: 101 })).status).toBe(400);
    expect((await post({ customerName: "V", lines: line, taxRatePct: -1 })).status).toBe(400);
    expect((await post({ customerName: "V", lines: [{ description: "", unitPrice: 1 }] })).status).toBe(400);
    expect((await post({ customerName: "V", lines: [{ description: "x", quantity: -1, unitPrice: 1 }] })).status).toBe(400);
    const due = await post({ customerName: "V", lines: line, issueDate: "2026-05-10", dueDate: "2026-05-09" });
    expect(due.status).toBe(400);
    expect(due.body.message).toMatch(/due date/i);
    // a zero-value draft can be saved but not issued
    const zero = await post({ customerName: "V", lines: [{ description: "free", quantity: 1, unitPrice: 0 }] });
    expect(zero.status).toBe(201);
    const issue = await api.post(`${INV}/issue/${zero.body.invoice._id}`);
    expect(issue.status).toBe(400);
    expect(issue.body.message).toMatch(/more than 0/i);
    // invalid id formats
    expect((await api.get(`${INV}/get-invoice/not-an-id`)).status).toBe(400);
    expect((await api.get(`${INV}/get-invoice/64b000000000000000000000`)).status).toBe(404);
  });

  test("@full a due date defaults to 30 days after the issue date and currency falls back to USD", async () => {
    const t = await createTenant("InvDefaults");
    const api = await t.api();
    const inv = await draft(api, { issueDate: "2026-03-01", currency: "EUR" });
    expect(inv.dueDate.slice(0, 10)).toBe("2026-03-31");
    expect(inv.currency).toBe("USD");
    const zar = await draft(api, { currency: "ZAR" });
    expect(zar.currency).toBe("ZAR");
  });

  test("@smoke @full void: allowed with no payments, refused with payments; clears the receivable", async () => {
    const t = await createTenant("InvVoid");
    const api = await t.api();
    const a = await issued(api, { customerName: "Voider", lines: [{ description: "x", quantity: 1, unitPrice: 80 }] });
    const b = await issued(api, { customerName: "Voider", lines: [{ description: "y", quantity: 1, unitPrice: 20 }] });
    expect((await pay(api, { customerName: "Voider", amount: 5, allocations: [{ invoiceId: b._id, amount: 5 }] })).status).toBe(201);

    const refuse = await api.post(`${INV}/void/${b._id}`, { reason: "oops" });
    expect(refuse.status).toBe(409);
    expect(refuse.body.message).toMatch(/has payments/i);

    expect((await api.post(`${INV}/void/${a._id}`, { reason: "billed twice" })).body.invoice).toMatchObject({ status: "void", voidReason: "billed twice", balance: 0 });
    expect((await api.post(`${INV}/void/${a._id}`)).status).toBe(409); // already void
    expect((await pay(api, { customerName: "Voider", amount: 1, allocations: [{ invoiceId: a._id, amount: 1 }] })).status).toBe(409);
    expect((await api.post(`${INV}/credit-note/${a._id}`, { amount: 1 })).status).toBe(409);

    const rec = (await api.get(`${INV}/receivables`)).body;
    expect(rec.customers).toHaveLength(1);
    expect(rec.customers[0]).toMatchObject({ customerName: "Voider", invoices: 1, total: 15 }); // only b: 20 - 5
    expect(rec.totals).toEqual({ USD: 15 });
    // the voided number is not reused
    expect((await issued(api)).number).toBe("INV-0003");
  });

  test("@full draft and void invoices show correct list filters and totals", async () => {
    const t = await createTenant("InvList");
    const api = await t.api();
    await draft(api, { customerName: "Alpha Co" });
    const i1 = await issued(api, { customerName: "Alpha Co", lines: [{ description: "a", quantity: 1, unitPrice: 50 }] });
    await issued(api, { customerName: "Beta Co", issueDate: day(-60), dueDate: day(-30), lines: [{ description: "b", quantity: 1, unitPrice: 70 }] });
    const v = await issued(api, { customerName: "Gamma Co" });
    await api.post(`${INV}/void/${v._id}`, {});
    const list = async (q) => (await api.get(`${INV}/get-invoices${q || ""}`)).body;
    expect((await list()).invoices).toHaveLength(4);
    expect((await list("?status=draft")).invoices).toHaveLength(1);
    expect((await list("?status=void")).invoices).toHaveLength(1);
    const issuedList = await list("?status=issued");
    expect(issuedList.invoices).toHaveLength(2);
    expect(issuedList).toMatchObject({ outstanding: 120, overdue: 70 });
    const overdue = await list("?paymentStatus=overdue");
    expect(overdue.invoices.map((i) => i.customerName)).toEqual(["Beta Co"]);
    expect(overdue.invoices[0].daysOverdue).toBe(30);
    expect((await list("?customer=alpha")).invoices).toHaveLength(2);
    // regex metacharacters in a search are literal, not a crash or a match-all
    expect((await list("?customer=.*")).invoices).toHaveLength(0);
    // list rows carry no line items
    expect((await list()).invoices[0].lines).toBeUndefined();
    expect(i1.number).toBe("INV-0001");
  });

  test("@full draft-from-jobs and draft-from-trips: lines, locking, billed-once, void releases", async () => {
    const t = await createTenant("InvFrom", { modules: undefined });
    const api = await t.api();
    // reference data for two jobs
    const cid = t.companyId;
    await api.createVehicle(cid, { regNumber: "FRM1001", make: "DAF" });
    await api.createCustomer(cid, { name: "Origin" });
    await api.createCustomer(cid, { name: "Dest" });
    await api.createContractor(cid, { companyName: "Bill Me Ltd", prefix: "BM" });
    await api.createDriver(cid, { name: "Billy", idNumber: `ID-${t.id}` });
    const [veh] = await find("vehicles", { tenantId: cid });
    const [ctr] = await find("contractors", { tenantId: cid });
    const [drv] = await find("drivers", { tenantId: cid });
    const cust = Object.fromEntries((await find("customers", { tenantId: cid })).map((c) => [c.name, c._id]));
    const mk = (n, date, cost, km) => ({ jobNumber: n, from: cust.Origin, customer: cust.Dest, description: n, deliveryType: "local", orderDate: `${date}T10:00:00.000Z`, contractorId: ctr._id, vehicleId: veh._id, driverId: drv._id, mileageOut: "1", mileageIn: String(1 + km), distance: km, cost: String(cost) });
    await api.mustPost("/api/v2/job/create-job", [mk("B1", "2026-05-03", "25.50", 10)]);
    await api.mustPost("/api/v2/job/create-job", [mk("B2", "2026-05-20", "74.50", 30)]);
    await api.mustPost("/api/v2/job/create-job", [mk("B3", "2026-06-02", "10.00", 5)]);

    // unbilled summary before invoicing
    const before = (await api.get(`${INV}/unbilled`)).body;
    expect(before.jobs.find((j) => j.month === "2026-05")).toMatchObject({ legs: 2, total: 100, contractorName: "Bill Me Ltd" });
    expect(before.jobs.find((j) => j.month === "2026-06")).toMatchObject({ legs: 1, total: 10 });

    const dr = await api.post(`${INV}/draft-from-jobs`, { contractorId: ctr._id, from: "2026-05-01", to: "2026-05-31", issueDate: "2026-06-01" });
    expect(dr.status).toBe(201);
    expect(dr.body.jobs).toBe(2);
    expect(dr.body.invoice).toMatchObject({ customerName: "Bill Me Ltd", total: 100, status: "draft" });
    expect(dr.body.invoice.lines).toHaveLength(2);
    expect(dr.body.invoice.lines[0].description).toMatch(/^B1 - 2026-05-03 - Origin to Dest \(10 km\)$/);

    // nothing is "billed" until the invoice is issued, then it disappears from unbilled
    const iss = await api.post(`${INV}/issue/${dr.body.invoice._id}`);
    expect(iss.status).toBe(200);
    const after = (await api.get(`${INV}/unbilled`)).body;
    expect(after.jobs.find((j) => j.month === "2026-05")).toBeUndefined();
    expect(after.jobs.find((j) => j.month === "2026-06")).toBeTruthy();

    // the same period again finds nothing; the same jobs cannot go on a second invoice
    const again = await api.post(`${INV}/draft-from-jobs`, { contractorId: ctr._id, from: "2026-05-01", to: "2026-05-31" });
    expect(again.status).toBe(404);

    // voiding releases the jobs
    expect((await api.post(`${INV}/void/${dr.body.invoice._id}`, {})).status).toBe(200);
    const released = (await api.get(`${INV}/unbilled`)).body;
    expect(released.jobs.find((j) => j.month === "2026-05")).toMatchObject({ legs: 2, total: 100 });
    // period and missing-arg validation
    expect((await api.post(`${INV}/draft-from-jobs`, { contractorId: ctr._id })).status).toBe(400);
    expect((await api.post(`${INV}/draft-from-trips`, { tripIds: [] })).status).toBe(400);
  });

  test("@full a job in a draft invoice cannot be issued on two invoices (409), the second stays a draft", async () => {
    const t = await createTenant("InvDouble");
    const api = await t.api();
    const cid = t.companyId;
    await api.createVehicle(cid, { regNumber: "DBL1001", make: "DAF" });
    await api.createCustomer(cid, { name: "O" });
    await api.createCustomer(cid, { name: "D" });
    await api.createContractor(cid, { companyName: "Dbl Ltd", prefix: "DB" });
    await api.createDriver(cid, { name: "Dee", idNumber: `ID-${t.id}` });
    const [veh] = await find("vehicles", { tenantId: cid });
    const [ctr] = await find("contractors", { tenantId: cid });
    const [drv] = await find("drivers", { tenantId: cid });
    const [o, d] = [(await find("customers", { tenantId: cid })).find((c) => c.name === "O"), (await find("customers", { tenantId: cid })).find((c) => c.name === "D")];
    await api.mustPost("/api/v2/job/create-job", [{ jobNumber: "D1", from: o._id, customer: d._id, description: "d", deliveryType: "local", orderDate: "2026-04-04T10:00:00.000Z", contractorId: ctr._id, vehicleId: veh._id, driverId: drv._id, mileageOut: "1", mileageIn: "11", distance: 10, cost: "40.00" }]);
    const range = { contractorId: ctr._id, from: "2026-04-01", to: "2026-04-30" };
    const d1 = (await api.post(`${INV}/draft-from-jobs`, range)).body.invoice;
    const d2 = (await api.post(`${INV}/draft-from-jobs`, range)).body.invoice; // not billed yet, so allowed
    expect((await api.post(`${INV}/issue/${d1._id}`)).status).toBe(200);
    const clash = await api.post(`${INV}/issue/${d2._id}`);
    expect(clash.status).toBe(409);
    expect(clash.body.message).toMatch(/already billed/i);
    expect((await get(api, d2._id)).status).toBe("draft");
  });
});

test.describe("payments", () => {
  test("@smoke @full auto-allocation pays the oldest invoices first (A 100, B 50, C 80; pay 120)", async () => {
    const t = await createTenant("PayAuto");
    const api = await t.api();
    const cust = "Payment Customer Y";
    const A = await issued(api, { customerName: cust, issueDate: "2026-01-01", lines: [{ description: "a", quantity: 1, unitPrice: 100 }] });
    const B = await issued(api, { customerName: cust, issueDate: "2026-02-01", lines: [{ description: "b", quantity: 1, unitPrice: 50 }] });
    const C = await issued(api, { customerName: cust, issueDate: "2026-03-01", lines: [{ description: "c", quantity: 1, unitPrice: 80 }] });
    // create out of order on purpose: C was issued last, A first -> allocation follows issue DATE, not creation

    const p = await pay(api, { customerName: cust, amount: 120, autoAllocate: true, method: "ecocash", reference: "EC-1" });
    expect(p.status).toBe(201);
    expect(p.body.payment).toMatchObject({ amount: 120, allocated: 120, unallocated: 0, method: "ecocash", reference: "EC-1" });
    expect(p.body.payment.allocations.map((a) => a.amount)).toEqual([100, 20]);
    expect(await get(api, A._id)).toMatchObject({ paid: 100, balance: 0, paymentStatus: "paid" });
    expect(await get(api, B._id)).toMatchObject({ paid: 20, balance: 30, paymentStatus: "partial" });
    expect(await get(api, C._id)).toMatchObject({ paid: 0, balance: 80, paymentStatus: "unpaid" });

    // overpayment: 130 more pays the remaining 110 and leaves 20 as customer credit
    const p2 = await pay(api, { customerName: cust, amount: 130, autoAllocate: true });
    expect(p2.body.payment).toMatchObject({ allocated: 110, unallocated: 20 });
    expect((await api.get(`${INV}/receivables`)).body.customers).toHaveLength(0);

    // deleting the first payment puts its money back on the invoices
    expect((await api.del(`${PAY}/delete-payment/${p.body.payment._id}`)).status).toBe(200);
    expect(await get(api, A._id)).toMatchObject({ paid: 0, balance: 100, paymentStatus: "unpaid" });
    const list = (await api.get(`${PAY}/get-payments`)).body.payments;
    expect(list).toHaveLength(1);
    expect(list[0].allocations[0].invoiceNumber).toMatch(/^INV-000\d$/);
  });

  test("@full explicit allocations and every refusal path", async () => {
    const t = await createTenant("PayRules");
    const api = await t.api();
    const inv = await issued(api, { customerName: "Rules", lines: [{ description: "x", quantity: 1, unitPrice: 100 }] });
    const zar = await issued(api, { customerName: "Rules", currency: "ZAR", lines: [{ description: "z", quantity: 1, unitPrice: 100 }] });
    const dr = await draft(api, { customerName: "Rules" });
    const rec = (body) => pay(api, { customerName: "Rules", ...body });

    expect((await rec({ amount: 0, autoAllocate: true })).status).toBe(400);
    expect((await rec({ amount: -5, autoAllocate: true })).status).toBe(400);
    expect((await rec({ amount: 10, allocations: [{ invoiceId: inv._id, amount: 100.01 }] })).status).toBe(400); // allocation > balance
    expect((await rec({ amount: 10, allocations: [{ invoiceId: inv._id, amount: 60 }] })).status).toBe(400); // allocations exceed payment
    expect((await rec({ amount: 10, allocations: [{ invoiceId: inv._id, amount: 5 }, { invoiceId: inv._id, amount: 5 }] })).status).toBe(400); // twice
    expect((await rec({ amount: 10, allocations: [{ invoiceId: dr._id, amount: 10 }] })).status).toBe(409); // draft
    expect((await rec({ amount: 10, currency: "USD", allocations: [{ invoiceId: zar._id, amount: 10 }] })).status).toBe(400); // currency mismatch
    expect((await rec({ amount: 10, allocations: [{ invoiceId: "nope", amount: 10 }] })).status).toBe(400);
    expect((await rec({ amount: 10, allocations: [{ invoiceId: "64b000000000000000000000", amount: 10 }] })).status).toBe(404);
    expect((await pay(api, { amount: 10, autoAllocate: true })).status).toBe(400); // no customer for autoAllocate
    expect((await get(api, inv._id)).paid).toBe(0); // none of the refusals recorded anything

    const ok = await rec({ amount: 100, allocations: [{ invoiceId: inv._id, amount: 100 }], currency: "USD", method: "bogus" });
    expect(ok.status).toBe(201);
    expect(ok.body.payment.method).toBe("other");
    // a paid invoice cannot take another cent
    expect((await rec({ amount: 1, allocations: [{ invoiceId: inv._id, amount: 1 }] })).status).toBe(400);
    // and a paid invoice can no longer be voided, but a credit is refused too (nothing owing)
    expect((await api.post(`${INV}/void/${inv._id}`, {})).status).toBe(409);
    expect((await api.post(`${INV}/credit-note/${inv._id}`, { amount: 1 })).status).toBe(400);
    // payments in ZAR are tracked in their own currency
    expect((await rec({ amount: 40, currency: "ZAR", autoAllocate: true })).body.payment).toMatchObject({ currency: "ZAR", allocated: 40 });
  });

  test("@full payment from a customer with no invoices is kept as unallocated credit", async () => {
    const t = await createTenant("PayCredit");
    const api = await t.api();
    const p = await pay(api, { customerName: "Prepayer", amount: 75, autoAllocate: true });
    expect(p.status).toBe(201);
    expect(p.body.payment).toMatchObject({ amount: 75, allocated: 0, unallocated: 75, customerName: "Prepayer" });
  });

  test("@full the payments list filters by customer and date range", async () => {
    const t = await createTenant("PayFilter");
    const api = await t.api();
    await pay(api, { customerName: "Early Bird", amount: 10, date: "2026-01-05" });
    await pay(api, { customerName: "Late Bloom", amount: 20, date: "2026-08-05" });
    const q = async (s) => (await api.get(`${PAY}/get-payments${s}`)).body.payments;
    expect(await q("")).toHaveLength(2);
    expect((await q("?customer=early")).map((p) => p.amount)).toEqual([10]);
    expect((await q("?from=2026-06-01")).map((p) => p.amount)).toEqual([20]);
    expect((await q("?to=2026-02-01")).map((p) => p.amount)).toEqual([10]);
  });
});

test.describe("receivables ageing", () => {
  test("@smoke @full buckets: not due, 1-30, 31-60, 90+ (worked example, asOf 2026-11-08) and totals 270.00", async () => {
    const t = await createTenant("Ageing");
    const api = await t.api();
    const mk = (dueDate, amount, issueDate = "2026-01-01") => issued(api, { customerName: "Ageing Customer X", issueDate, dueDate, lines: [{ description: "x", quantity: 1, unitPrice: amount }] });
    await mk("2026-11-20", 100);
    await mk("2026-10-20", 50);
    await mk("2026-09-20", 80);
    await mk("2026-07-01", 40);

    const r = (await api.get(`${INV}/receivables?asOf=2026-11-08`)).body;
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0]).toMatchObject({ customerName: "Ageing Customer X", currency: "USD", invoices: 4, current: 100, d1_30: 50, d31_60: 80, d61_90: 0, d90_plus: 40, total: 270 });
    expect(r.totals).toEqual({ USD: 270 });

    // moving the as-of date moves the buckets: on 2026-12-20 everything is late
    const later = (await api.get(`${INV}/receivables?asOf=2026-12-20`)).body.customers[0];
    expect(later).toMatchObject({ current: 0, d1_30: 100, d31_60: 0, d61_90: 50, d90_plus: 120, total: 270 });
    // exactly on the due date is still "not due"
    const onDue = (await api.get(`${INV}/receivables?asOf=2026-11-20`)).body.customers[0];
    expect(onDue.current).toBe(100);
  });

  test("@full receivables are grouped by customer and currency, largest total first (any currency), and shrink with payments and credits", async () => {
    const t = await createTenant("AgeGroups");
    const api = await t.api();
    const inv = (customerName, amount, currency = "USD") => issued(api, { customerName, currency, issueDate: day(-10), dueDate: day(-5), lines: [{ description: "x", quantity: 1, unitPrice: amount }] });
    const small = await inv("Small Fry", 30);
    const big = await inv("Big Fish", 500);
    await inv("Big Fish", 25, "ZAR");
    await pay(api, { customerName: "Big Fish", amount: 200, allocations: [{ invoiceId: big._id, amount: 200 }] });
    await api.post(`${INV}/credit-note/${small._id}`, { amount: 10 });
    const r = (await api.get(`${INV}/receivables`)).body;
    expect(r.customers.map((c) => [c.customerName, c.currency, c.total])).toEqual([
      ["Big Fish", "USD", 300],
      ["Big Fish", "ZAR", 25],
      ["Small Fry", "USD", 20],
    ]);
    expect(r.totals).toEqual({ USD: 320, ZAR: 25 });
    expect(r.customers[0].d1_30).toBe(300);
  });

  test("@full drafts and voids never appear in receivables or outstanding", async () => {
    const t = await createTenant("AgeDrafts");
    const api = await t.api();
    await draft(api, { customerName: "Draftee" });
    const v = await issued(api, { customerName: "Voided" });
    await api.post(`${INV}/void/${v._id}`, {});
    const r = (await api.get(`${INV}/receivables`)).body;
    expect(r.customers).toEqual([]);
    expect(r.totals).toEqual({});
    expect((await api.get(`${INV}/get-invoices`)).body.outstanding).toBe(0);
  });
});

test.describe("quotations", () => {
  const lines = [{ description: "Harare to Beitbridge", quantity: 2, unitPrice: 450.25 }];
  const make = (api, over = {}) => api.post(`${QUO}/create-quotation`, { customerName: "Quote Customer", subject: "30t load", taxRatePct: 10, lines, ...over });

  test("@smoke @full create numbers at creation (QUO-0001...), totals include tax, list and filter work", async () => {
    const t = await createTenant("Quo");
    const api = await t.api();
    const q = await make(api);
    expect(q.status).toBe(201);
    expect(q.body.quotation).toMatchObject({ number: "QUO-0001", status: "draft", subtotal: 900.5, tax: 90.05, total: 990.55, currency: "USD" });
    expect(q.body.quotation.validUntil.slice(0, 10)).toBe(day(14, new Date(q.body.quotation.issueDate)));
    expect((await make(api, { customerName: "Other" })).body.quotation.number).toBe("QUO-0002");
    const all = (await api.get(`${QUO}/get-quotations`)).body.quotations;
    expect(all).toHaveLength(2);
    expect(all[0].lines).toBeUndefined();
    expect((await api.get(`${QUO}/get-quotations?customer=other`)).body.quotations).toHaveLength(1);
    expect((await api.get(`${QUO}/get-quotations?status=sent`)).body.quotations).toHaveLength(0);
    // invoice numbers are a separate series
    expect((await issued(api)).number).toBe("INV-0001");
  });

  test("@full status machine: draft>sent>accepted/rejected, locked once decided, rejected may be re-sent", async () => {
    const t = await createTenant("QuoFlow");
    const api = await t.api();
    const id = (await make(api)).body.quotation._id;
    const set = (status) => api.post(`${QUO}/set-status/${id}`, { status });
    expect((await set("accepted")).status).toBe(409); // cannot skip "sent"
    expect((await set("sent")).body.quotation.status).toBe("sent");
    expect((await set("draft")).body.quotation.status).toBe("draft");
    await set("sent");
    expect((await set("rejected")).body.quotation.status).toBe("rejected");
    expect((await api.put(`${QUO}/update-quotation/${id}`, { subject: "x" })).status).toBe(409);
    expect((await set("sent")).body.quotation.status).toBe("sent"); // re-offer
    expect((await set("accepted")).body.quotation.status).toBe("accepted");
    expect((await set("sent")).status).toBe(409);
    expect((await api.put(`${QUO}/update-quotation/${id}`, { subject: "x" })).status).toBe(409);
    expect((await set("bogus")).status).toBe(409);
  });

  test("@smoke @full an accepted quotation converts to a draft invoice with identical lines and cents; once only", async () => {
    const t = await createTenant("QuoConvert");
    const api = await t.api();
    const q = (await make(api)).body.quotation;
    expect((await api.post(`${QUO}/convert/${q._id}`)).status).toBe(409); // not accepted yet
    await api.post(`${QUO}/set-status/${q._id}`, { status: "sent" });
    await api.post(`${QUO}/set-status/${q._id}`, { status: "accepted" });
    const conv = await api.post(`${QUO}/convert/${q._id}`);
    expect(conv.status).toBe(201);
    expect(conv.body.invoice).toMatchObject({ status: "draft", customerName: "Quote Customer", subtotal: 900.5, tax: 90.05, total: 990.55, quotationId: q._id });
    expect(conv.body.invoice.notes).toBe("Quotation QUO-0001: 30t load");
    expect(conv.body.invoice.lines[0]).toMatchObject({ description: "Harare to Beitbridge", quantity: 2, unitPrice: 450.25, amount: 900.5 });
    expect(conv.body.quotation.invoiceId).toBe(conv.body.invoice._id);
    expect((await api.post(`${QUO}/convert/${q._id}`)).status).toBe(409); // already converted
    expect((await api.del(`${QUO}/delete-quotation/${q._id}`)).status).toBe(409); // has an invoice
    // the draft invoice is a normal draft: it can be issued
    expect((await api.post(`${INV}/issue/${conv.body.invoice._id}`)).body.invoice.number).toBe("INV-0001");
  });

  test("@full validation and delete: customer required, valid-until not before date, drafts deletable", async () => {
    const t = await createTenant("QuoValid");
    const api = await t.api();
    expect((await make(api, { customerName: "" })).status).toBe(400);
    expect((await make(api, { lines: [] })).status).toBe(400);
    expect((await make(api, { taxRatePct: 200 })).status).toBe(400);
    expect((await make(api, { issueDate: "2026-05-10", validUntil: "2026-05-01" })).status).toBe(400);
    const q = (await make(api)).body.quotation;
    expect((await api.del(`${QUO}/delete-quotation/${q._id}`)).status).toBe(200);
    expect((await api.get(`${QUO}/get-quotation/${q._id}`)).status).toBe(404);
    // a quotation that names a trip/job strips them (quotes do not bill trips)
    const sneaky = await make(api, { lines: [{ description: "x", quantity: 1, unitPrice: 1, tripId: "64b000000000000000000000" }] });
    expect(sneaky.status).toBe(404);
  });

  test("@full a sent quotation past its valid-until date reports expired", async () => {
    const t = await createTenant("QuoExpire");
    const api = await t.api();
    const q = (await make(api, { issueDate: "2026-01-01", validUntil: "2026-01-10" })).body.quotation;
    expect(q.expired).toBe(false); // drafts do not expire
    await api.post(`${QUO}/set-status/${q._id}`, { status: "sent" });
    const row = (await api.get(`${QUO}/get-quotations?status=sent`)).body.quotations[0];
    expect(row.expired).toBe(true);
  });
});
