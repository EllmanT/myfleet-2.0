const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Vehicle = require("../model/vehicle");
const Contractor = require("../model/contractor");
const Customer = require("../model/customer");
const Driver = require("../model/driver");
const Job = require("../model/job");
const Trip = require("../model/trip");
const Invoice = require("../model/invoice");
const { clearModuleCache } = require("../middleware/moduleAccess");
const { computeTotals, lineAmount, paymentState, ageBucket } = require("../utils/invoiceMath");
const { toCents, fromCents } = require("../utils/money");
const app = require("../app");

const ON = { invoices: true, quotations: true, crossBorder: true, tractorUnits: true };

async function makeCompany(modules = ON) {
  return Deliverer.create({
    companyName: "Co " + Math.random().toString(36).slice(2, 7),
    address: "1 Main", city: "Harare", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"], modules,
  });
}
async function cookieFor(company, role = "Deliverer Admin") {
  const u = await User.create({
    name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123",
    phoneNumber: "1", role, address: "a", city: "c", companyId: company._id,
  });
  return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY)];
}

const lines = (...amounts) => amounts.map((a, i) => ({ description: `Line ${i + 1}`, quantity: 1, unitPrice: a }));
const draft = (cookie, over = {}) =>
  request(app).post("/api/v2/invoice/create-invoice").set("Cookie", cookie)
    .send({ customerName: "Lammel", issueDate: "2026-10-01", lines: lines(100, 50.5), ...over });
const issue = (cookie, id) => request(app).post(`/api/v2/invoice/issue/${id}`).set("Cookie", cookie);

describe("money and invoice math", () => {
  test("cents conversion is exact and rejects junk", () => {
    expect(toCents("19.99")).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(1999)).toBe(19.99);
    expect(() => toCents(-1)).toThrow();
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents("")).toThrow();
  });
  test("totals and tax", () => {
    const ls = [{ amountCents: lineAmount(3, 1000) }, { amountCents: lineAmount(1, 555) }];
    expect(computeTotals(ls, 15)).toEqual({ subtotalCents: 3555, taxCents: 533, totalCents: 4088 });
    expect(computeTotals(ls, 0).taxCents).toBe(0);
  });
  test("payment state: unpaid, partial, paid, overdue, credits", () => {
    const base = { status: "issued", totalCents: 10000, paidCents: 0, creditNotes: [], dueDate: "2026-10-01" };
    const now = new Date("2026-10-11T12:00:00Z");
    expect(paymentState(base, now)).toMatchObject({ paymentStatus: "unpaid", balanceCents: 10000, overdue: true, daysOverdue: 10 });
    expect(paymentState({ ...base, paidCents: 4000 }, now)).toMatchObject({ paymentStatus: "partial", balanceCents: 6000 });
    expect(paymentState({ ...base, paidCents: 10000 }, now)).toMatchObject({ paymentStatus: "paid", balanceCents: 0, overdue: false });
    expect(paymentState({ ...base, creditNotes: [{ amountCents: 10000 }] }, now).paymentStatus).toBe("paid");
    expect(paymentState({ ...base, dueDate: "2026-10-20" }, now).overdue).toBe(false);
  });
  test("ageing buckets", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(ageBucket)).toEqual(
      ["current", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90_plus"]
    );
  });
});

describe("invoices, payments and quotations over HTTP", () => {
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
    await Invoice.syncIndexes();
    clearModuleCache();
  });

  test("a draft has no number; issuing numbers it, locks it, and numbers have no gaps", async () => {
    const co = await makeCompany();
    const ck = await cookieFor(co);
    const d1 = await draft(ck);
    expect(d1.status).toBe(201);
    expect(d1.body.invoice.number).toBeUndefined();
    expect(d1.body.invoice.total).toBe(150.5);

    const draft2 = await draft(ck); // never issued: must not use up a number
    const i1 = await issue(ck, d1.body.invoice._id);
    expect(i1.body.invoice.number).toBe("INV-0001");
    const d3 = await draft(ck);
    expect((await issue(ck, d3.body.invoice._id)).body.invoice.number).toBe("INV-0002");

    const edit = await request(app).put(`/api/v2/invoice/update-invoice/${d1.body.invoice._id}`).set("Cookie", ck).send({ customerName: "x", lines: lines(1) });
    expect(edit.status).toBe(409);
    const del = await request(app).delete(`/api/v2/invoice/delete-invoice/${d1.body.invoice._id}`).set("Cookie", ck);
    expect(del.status).toBe(409);
    expect((await request(app).delete(`/api/v2/invoice/delete-invoice/${draft2.body.invoice._id}`).set("Cookie", ck)).status).toBe(200);
  });

  test("numbering is per company", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const cb = await cookieFor(b);
    const ia = await issue(ca, (await draft(ca)).body.invoice._id);
    const ib = await issue(cb, (await draft(cb)).body.invoice._id);
    expect(ia.body.invoice.number).toBe("INV-0001");
    expect(ib.body.invoice.number).toBe("INV-0001");
  });

  test("rejects bad input", async () => {
    const ck = await cookieFor(await makeCompany());
    expect((await draft(ck, { customerName: "" })).status).toBe(400);
    expect((await draft(ck, { lines: [] })).status).toBe(400);
    expect((await draft(ck, { lines: [{ description: "", unitPrice: 5 }] })).status).toBe(400);
    expect((await draft(ck, { lines: [{ description: "x", unitPrice: -5 }] })).status).toBe(400);
    expect((await draft(ck, { dueDate: "2026-09-01" })).status).toBe(400);
    expect((await draft(ck, { taxRatePct: 150 })).status).toBe(400);
  });

  test("partial payments, then full payment, then deleting a payment reopens the balance", async () => {
    const ck = await cookieFor(await makeCompany());
    const inv = (await issue(ck, (await draft(ck, { lines: lines(200) })).body.invoice._id)).body.invoice;
    const pay = (amount) => request(app).post("/api/v2/payment/record-payment").set("Cookie", ck)
      .send({ date: "2026-10-05", amount, method: "ecocash", allocations: [{ invoiceId: inv._id, amount }] });
    const get = async () => (await request(app).get(`/api/v2/invoice/get-invoice/${inv._id}`).set("Cookie", ck)).body.invoice;

    const p1 = await pay(80);
    expect(p1.status).toBe(201);
    expect(await get()).toMatchObject({ paid: 80, balance: 120, paymentStatus: "partial" });

    expect((await pay(150)).status).toBe(400); // more than the 120 outstanding
    const p2 = await pay(120);
    expect(await get()).toMatchObject({ paid: 200, balance: 0, paymentStatus: "paid" });

    expect((await request(app).delete(`/api/v2/payment/delete-payment/${p2.body.payment._id}`).set("Cookie", ck)).status).toBe(200);
    expect(await get()).toMatchObject({ paid: 80, balance: 120, paymentStatus: "partial" });
  });

  test("one payment can settle several invoices, oldest first, and the rest stays as credit", async () => {
    const ck = await cookieFor(await makeCompany());
    const a = (await issue(ck, (await draft(ck, { issueDate: "2026-08-01", lines: lines(100) })).body.invoice._id)).body.invoice;
    const b = (await issue(ck, (await draft(ck, { issueDate: "2026-09-01", lines: lines(100) })).body.invoice._id)).body.invoice;
    const res = await request(app).post("/api/v2/payment/record-payment").set("Cookie", ck)
      .send({ customerName: "Lammel", amount: 250, autoAllocate: true, method: "bank" });
    expect(res.status).toBe(201);
    expect(res.body.payment.allocated).toBe(200);
    expect(res.body.payment.unallocated).toBe(50);
    const list = await request(app).get("/api/v2/invoice/get-invoices").set("Cookie", ck);
    expect(list.body.invoices.every((i) => i.paymentStatus === "paid")).toBe(true);
    expect([a, b]).toHaveLength(2);
  });

  test("payments are only for issued invoices in the same currency, and can't repeat an invoice", async () => {
    const ck = await cookieFor(await makeCompany());
    const d = (await draft(ck)).body.invoice;
    const post = (body) => request(app).post("/api/v2/payment/record-payment").set("Cookie", ck).send({ method: "cash", ...body });
    expect((await post({ amount: 10, allocations: [{ invoiceId: d._id, amount: 10 }] })).status).toBe(409);
    const inv = (await issue(ck, d._id)).body.invoice;
    expect((await post({ amount: 10, currency: "ZAR", allocations: [{ invoiceId: inv._id, amount: 10 }] })).status).toBe(400);
    expect((await post({ amount: 20, allocations: [{ invoiceId: inv._id, amount: 10 }, { invoiceId: inv._id, amount: 10 }] })).status).toBe(400);
    expect((await post({ amount: 5, allocations: [{ invoiceId: inv._id, amount: 10 }] })).status).toBe(400);
    expect((await post({ amount: 0 })).status).toBe(400);
  });

  test("void: allowed when unpaid, refused once paid; credit note reduces the balance", async () => {
    const ck = await cookieFor(await makeCompany());
    const a = (await issue(ck, (await draft(ck, { lines: lines(100) })).body.invoice._id)).body.invoice;
    const credit = await request(app).post(`/api/v2/invoice/credit-note/${a._id}`).set("Cookie", ck).send({ amount: 30, reason: "Damaged goods" });
    expect(credit.body.invoice).toMatchObject({ balance: 70, credits: 30, paymentStatus: "partial" });
    expect(credit.body.invoice.creditNotes[0].number).toBe("CN-0001");
    expect((await request(app).post(`/api/v2/invoice/credit-note/${a._id}`).set("Cookie", ck).send({ amount: 500 })).status).toBe(400);

    await request(app).post("/api/v2/payment/record-payment").set("Cookie", ck)
      .send({ amount: 10, allocations: [{ invoiceId: a._id, amount: 10 }] });
    expect((await request(app).post(`/api/v2/invoice/void/${a._id}`).set("Cookie", ck).send({})).status).toBe(409);

    const b = (await issue(ck, (await draft(ck)).body.invoice._id)).body.invoice;
    const v = await request(app).post(`/api/v2/invoice/void/${b._id}`).set("Cookie", ck).send({ reason: "Wrong client" });
    expect(v.body.invoice.status).toBe("void");
    expect((await request(app).post("/api/v2/payment/record-payment").set("Cookie", ck)
      .send({ amount: 5, allocations: [{ invoiceId: b._id, amount: 5 }] })).status).toBe(409);
  });

  test("a trip can only be billed once; voiding releases it", async () => {
    const co = await makeCompany();
    const ck = await cookieFor(co);
    const trip = await Trip.create({
      tenantId: co._id, date: new Date("2026-10-01"), customerName: "Bonds", price: 1800,
      stops: [{ place: "Harare", country: "ZW" }, { place: "Johannesburg", country: "SA" }], clientRef: "AL.01",
    });
    const from = await request(app).post("/api/v2/invoice/draft-from-trips").set("Cookie", ck).send({ tripIds: [String(trip._id)] });
    expect(from.status).toBe(201);
    expect(from.body.invoice.total).toBe(1800);
    expect(from.body.invoice.customerName).toBe("Bonds");

    const second = await request(app).post("/api/v2/invoice/draft-from-trips").set("Cookie", ck).send({ tripIds: [String(trip._id)] });
    const issued = await issue(ck, from.body.invoice._id);
    expect(issued.status).toBe(200);
    expect((await Trip.findById(trip._id)).invoiceId).toBeTruthy();
    // a second draft made before issuing the first can't be issued afterwards
    expect(second.status).toBe(201);
    expect((await issue(ck, second.body.invoice._id)).status).toBe(409);
    expect((await request(app).post("/api/v2/invoice/draft-from-trips").set("Cookie", ck).send({ tripIds: [String(trip._id)] })).status).toBe(409);

    await request(app).post(`/api/v2/invoice/void/${from.body.invoice._id}`).set("Cookie", ck).send({});
    expect((await Trip.findById(trip._id)).invoiceId).toBeUndefined();
  });

  test("monthly invoice from a contractor's unbilled jobs; jobs are marked billed on issue", async () => {
    const co = await makeCompany();
    const ck = await cookieFor(co);
    const veh = await Vehicle.create({ make: "DAF", regNumber: "AFE5848", size: "horse", companyId: String(co._id), tenantId: co._id });
    const con = await Contractor.create({ companyName: "Lammel", address: "a", city: "c", goodsTypes: ["g"], vehiclesTypes: ["v"], deliveryTypes: ["d"], tenantId: co._id });
    const drv = await Driver.create({ name: "Chris", phoneNumber: "1", address: "a", city: "c", idNumber: "1", id: "x", companyId: String(co._id), tenantId: co._id });
    const [shippy, lammelPlace] = await Customer.create([{ name: "Shippy" }, { name: "Lammel Yard" }]);
    co.vehicle_ids.push(veh._id);
    co.contractor_ids.push(con._id);
    await co.save();
    const mk = (n, date, cost) => ({
      jobNumber: `LM${n}`, from: shippy._id, customer: lammelPlace._id, distance: 12, cost, mileageOut: "100", mileageIn: "112",
      orderDate: new Date(date), description: "d", deliveryType: "local", contractorId: con._id, vehicleId: veh._id, driverId: drv._id,
    });
    const jobs = await Job.create([mk("0001", "2026-10-02", "24.00"), mk("0002", "2026-10-15", "36.50"), mk("0003", "2026-11-03", "99.00")]);

    const res = await request(app).post("/api/v2/invoice/draft-from-jobs").set("Cookie", ck)
      .send({ contractorId: String(con._id), from: "2026-10-01", to: "2026-10-31" });
    expect(res.status).toBe(201);
    expect(res.body.jobs).toBe(2);
    expect(res.body.invoice.total).toBe(60.5);
    expect(res.body.invoice.customerName).toBe("Lammel");
    expect(res.body.invoice.lines[0].description).toContain("Shippy to Lammel Yard");

    await issue(ck, res.body.invoice._id);
    expect((await Job.findById(jobs[0]._id)).invoiceId).toBeTruthy();
    expect((await Job.findById(jobs[2]._id)).invoiceId).toBeUndefined();

    const again = await request(app).post("/api/v2/invoice/draft-from-jobs").set("Cookie", ck)
      .send({ contractorId: String(con._id), from: "2026-10-01", to: "2026-10-31" });
    expect(again.status).toBe(404); // nothing left to bill in October

    const unbilled = await request(app).get("/api/v2/invoice/unbilled").set("Cookie", ck);
    expect(unbilled.body.jobs).toHaveLength(1);
    expect(unbilled.body.jobs[0]).toMatchObject({ month: "2026-11", total: 99 });
  });

  test("tenant isolation: another company can't see, pay, void or print my invoice", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const cb = await cookieFor(b);
    const inv = (await issue(ca, (await draft(ca)).body.invoice._id)).body.invoice;

    expect((await request(app).get("/api/v2/invoice/get-invoices").set("Cookie", cb)).body.invoices).toHaveLength(0);
    expect((await request(app).get(`/api/v2/invoice/get-invoice/${inv._id}`).set("Cookie", cb)).status).toBe(404);
    expect((await request(app).post(`/api/v2/invoice/void/${inv._id}`).set("Cookie", cb).send({})).status).toBe(404);
    expect((await request(app).get(`/api/v2/invoice/pdf/${inv._id}`).set("Cookie", cb)).status).toBe(404);
    const pay = await request(app).post("/api/v2/payment/record-payment").set("Cookie", cb)
      .send({ amount: 5, allocations: [{ invoiceId: inv._id, amount: 5 }] });
    expect(pay.status).toBe(404);
  });

  test("receivables group by customer with ageing", async () => {
    const ck = await cookieFor(await makeCompany());
    const old = (await issue(ck, (await draft(ck, { issueDate: "2026-06-01", dueDate: "2026-06-30", lines: lines(100) })).body.invoice._id)).body.invoice;
    await issue(ck, (await draft(ck, { issueDate: "2026-10-01", dueDate: "2026-12-30", lines: lines(40) })).body.invoice._id);
    const r = await request(app).get("/api/v2/invoice/receivables").query({ asOf: "2026-10-15" }).set("Cookie", ck);
    expect(r.body.customers).toHaveLength(1);
    expect(r.body.customers[0]).toMatchObject({ customerName: "Lammel", d90_plus: 100, current: 40, total: 140 });
    expect(r.body.totals.USD).toBe(140);
    expect(old.number).toBe("INV-0001");
  });

  test("the invoice PDF is generated", async () => {
    const ck = await cookieFor(await makeCompany());
    const inv = (await issue(ck, (await draft(ck)).body.invoice._id)).body.invoice;
    const res = await request(app).get(`/api/v2/invoice/pdf/${inv._id}`).set("Cookie", ck).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.slice(0, 4).toString()).toBe("%PDF");
  });

  test("quotation: numbered, sent, accepted, converted to an invoice draft with the same total", async () => {
    const ck = await cookieFor(await makeCompany());
    const q = await request(app).post("/api/v2/quotation/create-quotation").set("Cookie", ck)
      .send({ customerName: "Bonds", subject: "Harare to Joburg", lines: [{ description: "Haulage 30t", quantity: 1, unitPrice: 1800 }, { description: "Border fees", quantity: 1, unitPrice: 120.55 }] });
    expect(q.status).toBe(201);
    expect(q.body.quotation.number).toBe("QUO-0001");
    expect(q.body.quotation.total).toBe(1920.55);

    const id = q.body.quotation._id;
    expect((await request(app).post(`/api/v2/quotation/convert/${id}`).set("Cookie", ck)).status).toBe(409); // not accepted yet
    expect((await request(app).post(`/api/v2/quotation/set-status/${id}`).set("Cookie", ck).send({ status: "accepted" })).status).toBe(409); // must be sent first
    await request(app).post(`/api/v2/quotation/set-status/${id}`).set("Cookie", ck).send({ status: "sent" });
    await request(app).post(`/api/v2/quotation/set-status/${id}`).set("Cookie", ck).send({ status: "accepted" });

    const conv = await request(app).post(`/api/v2/quotation/convert/${id}`).set("Cookie", ck);
    expect(conv.status).toBe(201);
    expect(conv.body.invoice.total).toBe(1920.55);
    expect(conv.body.invoice.status).toBe("draft");
    expect((await request(app).post(`/api/v2/quotation/convert/${id}`).set("Cookie", ck)).status).toBe(409);
    expect((await request(app).delete(`/api/v2/quotation/delete-quotation/${id}`).set("Cookie", ck)).status).toBe(409);
  });

  test("invoices and quotations are blocked when their modules are off, and for non-finance roles", async () => {
    const off = await makeCompany({ invoices: false, quotations: false });
    const res = await request(app).get("/api/v2/invoice/get-invoices").set("Cookie", await cookieFor(off));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MODULE_DISABLED");

    const on = await makeCompany();
    const manager = await request(app).get("/api/v2/invoice/get-invoices").set("Cookie", await cookieFor(on, "Deliverer Manager"));
    expect(manager.status).toBe(403);
  });
});
