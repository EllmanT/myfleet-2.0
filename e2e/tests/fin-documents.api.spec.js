/*
 * Finance access control and PDF documents:
 *   - who may touch invoices, payments, quotations, expenses, fuel and profitability (role,
 *     module switch, anonymous, other company, platform admin without a company)
 *   - read-only behaviour after the trial / when overdue / suspended, for every finance write
 *   - the invoice and quotation PDFs: valid PDF, extractable text, company details, footer,
 *     paging, hostile text, and never anything from another company
 */
const { test, expect } = require("../support/fixtures");
const { createTenant } = require("../support/tenants");
const { ctl, daysFromNow } = require("../support/control");
const { Api } = require("../support/api");
const { draft, issued, day, pdfText, buildReference, find } = require("../support/fin");

const INV = "/api/v2/invoice";
const PAY = "/api/v2/payment";
const QUO = "/api/v2/quotation";
const EXP = "/api/v2/expense";
const FUEL = "/api/v2/fuel";

const oneLine = [{ description: "Haulage", quantity: 1, unitPrice: 100 }];
const ID0 = "64b000000000000000000000";

// Every finance endpoint, as [method, path, body]. {inv} {pay} {quo} are replaced with real ids.
const ENDPOINTS = (ids) => [
  ["GET", `${INV}/meta`],
  ["POST", `${INV}/create-invoice`, { customerName: "X", lines: oneLine }],
  ["GET", `${INV}/get-invoices`],
  ["GET", `${INV}/get-invoice/${ids.inv}`],
  ["PUT", `${INV}/update-invoice/${ids.draft}`, { notes: "n" }],
  ["DELETE", `${INV}/delete-invoice/${ids.draft}`],
  ["POST", `${INV}/issue/${ids.draft}`],
  ["POST", `${INV}/void/${ids.inv}`, {}],
  ["POST", `${INV}/credit-note/${ids.inv}`, { amount: 1 }],
  ["GET", `${INV}/pdf/${ids.inv}`],
  ["GET", `${INV}/receivables`],
  ["GET", `${INV}/unbilled`],
  ["POST", `${INV}/draft-from-jobs`, { contractorId: ID0, from: "2026-01-01", to: "2026-01-31" }],
  ["POST", `${INV}/draft-from-trips`, { tripIds: [ID0] }],
  ["POST", `${PAY}/record-payment`, { customerName: "X", amount: 1, autoAllocate: true }],
  ["GET", `${PAY}/get-payments`],
  ["DELETE", `${PAY}/delete-payment/${ids.pay}`],
  ["POST", `${QUO}/create-quotation`, { customerName: "X", lines: oneLine }],
  ["GET", `${QUO}/get-quotations`],
  ["GET", `${QUO}/get-quotation/${ids.quo}`],
  ["PUT", `${QUO}/update-quotation/${ids.quo}`, { subject: "s" }],
  ["POST", `${QUO}/set-status/${ids.quo}`, { status: "sent" }],
  ["POST", `${QUO}/convert/${ids.quo}`],
  ["DELETE", `${QUO}/delete-quotation/${ids.quo}`],
  ["GET", `${QUO}/pdf/${ids.quo}`],
  ["POST", `${EXP}/create-expense`, { type: "expense", category: "other", amount: 1, date: "2026-01-01" }],
  ["GET", `${EXP}/get-expenses`],
  ["PUT", `${EXP}/update-expense/${ids.exp}`, { amount: 2 }],
  ["DELETE", `${EXP}/delete-expense/${ids.exp}`],
  ["GET", `${EXP}/profitability?year=2026`],
  ["GET", `${EXP}/meta`],
  ["GET", `${FUEL}/get-fills`],
  ["POST", `${FUEL}/create-fill`, { vehicleId: ID0, filledAt: "2026-01-01T08:00:00Z", odometer: 1, litres: 1, amount: 1 }],
];
const WRITES = new Set(["POST", "PUT", "DELETE"]);

async function company(label, opts) {
  const t = await createTenant(label, opts || { users: [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }] });
  const api = await t.api();
  const inv = await issued(api, { customerName: `${label} Customer` });
  const dr = await draft(api, { customerName: `${label} Draft` });
  const p = (await api.post(`${PAY}/record-payment`, { customerName: `${label} Customer`, amount: 10, allocations: [{ invoiceId: inv._id, amount: 10 }] })).body.payment;
  const quo = (await api.post(`${QUO}/create-quotation`, { customerName: `${label} Q`, lines: oneLine })).body.quotation;
  const exp = (await api.post(`${EXP}/create-expense`, { type: "expense", category: "other", amount: 5, date: "2026-02-02" })).body.expense;
  return { t, api, ids: { inv: inv._id, draft: dr._id, pay: p._id, quo: quo._id, exp: exp._id } };
}

test.describe("finance access control", () => {
  test("@smoke @full anonymous callers get 401 on every finance endpoint", async () => {
    const anon = Api.anonymous();
    const fake = { inv: ID0, draft: ID0, pay: ID0, quo: ID0, exp: ID0 };
    for (const [m, path, body] of ENDPOINTS(fake)) {
      const r = await anon.request(m, path, body !== undefined ? { json: body } : {});
      expect(r.status, `${m} ${path}`).toBe(401);
    }
  });

  test("@smoke @full a Deliverer Manager is refused (403) on every finance endpoint, reads and writes", async () => {
    const c = await company("MgrDeny");
    const mgr = await c.t.api("manager");
    const before = (await find("invoices", { tenantId: c.t.companyId })).length;
    for (const [m, path, body] of ENDPOINTS(c.ids)) {
      const r = await mgr.request(m, path, body !== undefined ? { json: body } : {});
      expect(r.status, `${m} ${path}`).toBe(403);
      expect(String(r.body.message || r.text), `${m} ${path}`).toMatch(/only company admins/i);
    }
    // nothing changed behind the refusals
    expect((await find("invoices", { tenantId: c.t.companyId })).length).toBe(before);
    // the admin of the same company still sees its own data
    expect((await c.api.get(`${INV}/get-invoices`)).body.invoices.length).toBeGreaterThanOrEqual(2);
  });

  test("@full a Super Admin with no company is refused finance data (no company to read)", async ({ world }) => {
    const platform = await Api.login(world.platform.email, world.platform.password);
    for (const path of [`${INV}/get-invoices`, `${PAY}/get-payments`, `${QUO}/get-quotations`, `${EXP}/profitability?year=2026`]) {
      const r = await platform.get(path);
      expect([403, 401], path).toContain(r.status);
    }
  });

  test("@smoke @full tenant B cannot read, change, void, pay, convert, delete or print tenant A's finance documents", async () => {
    const A = await company("FinA");
    const B = await company("FinB");
    const apiB = B.api;
    const aInvoiceBefore = (await A.api.get(`${INV}/get-invoice/${A.ids.inv}`)).body.invoice;

    // every id-addressed endpoint answers 404 for the foreign id, writes included
    const idEndpoints = ENDPOINTS(A.ids).filter(([, p]) => p.includes(A.ids.inv) || p.includes(A.ids.draft) || p.includes(A.ids.pay) || p.includes(A.ids.quo) || p.includes(A.ids.exp));
    expect(idEndpoints.length).toBeGreaterThan(14);
    for (const [m, path, body] of idEndpoints) {
      const r = await apiB.request(m, path, body !== undefined ? { json: body } : {});
      expect(r.status, `${m} ${path}`).toBe(404);
      expect(r.text, `${m} ${path}`).not.toContain("FinA");
    }
    // nothing of A's changed
    expect((await A.api.get(`${INV}/get-invoice/${A.ids.inv}`)).body.invoice).toEqual(aInvoiceBefore);
    expect((await A.api.get(`${INV}/get-invoice/${A.ids.draft}`)).status).toBe(200);
    expect((await A.api.get(`${QUO}/get-quotation/${A.ids.quo}`)).status).toBe(200);
    expect((await A.api.get(`${PAY}/get-payments`)).body.payments).toHaveLength(1);

    // lists never include the other company's rows
    for (const path of [`${INV}/get-invoices`, `${PAY}/get-payments`, `${QUO}/get-quotations`, `${EXP}/get-expenses`, `${INV}/receivables`, `${INV}/unbilled`, `${INV}/meta`, `${EXP}/profitability?year=2026`]) {
      expect((await apiB.get(path)).text, path).not.toContain("FinA");
    }
  });

  test("@full B cannot pay A's invoice by naming its id in an allocation, nor put A's job or trip on B's invoice", async () => {
    const A = await company("AllocA");
    const B = await company("AllocB");
    const stolen = await B.api.post(`${PAY}/record-payment`, { customerName: "AllocA Customer", amount: 50, allocations: [{ invoiceId: A.ids.inv, amount: 50 }] });
    expect(stolen.status).toBe(404);
    expect((await A.api.get(`${INV}/get-invoice/${A.ids.inv}`)).body.invoice.paid).toBe(10);
    expect((await B.api.get(`${PAY}/get-payments`)).body.payments).toHaveLength(1); // only B's own seed payment

    // A has a real job; B tries to bill it
    const refA = await buildReference("JobOwnerA");
    await refA.api.mustPost("/api/v2/job/create-job", [{ jobNumber: "X1", from: refA.ids.customers.Depot._id, customer: refA.ids.customers["Delta Mining"]._id, description: "d", deliveryType: "local", orderDate: "2026-01-02T10:00:00.000Z", contractorId: refA.ids.contractors["Lammel QA"]._id, vehicleId: refA.ids.vehicles.QAA1001._id, driverId: refA.ids.drivers.Tendai._id, mileageOut: "1", mileageIn: "2", distance: 1, cost: "999.00" }]);
    const [job] = await find("jobs", { tenantId: refA.t.companyId });
    const lineWithAJob = await B.api.post(`${INV}/create-invoice`, { customerName: "Thief", lines: [{ description: "stolen", quantity: 1, unitPrice: 1, jobId: job._id }] });
    expect(lineWithAJob.status).toBe(404);
    const lineWithATrip = await B.api.post(`${INV}/create-invoice`, { customerName: "Thief", lines: [{ description: "stolen", quantity: 1, unitPrice: 1, tripId: ID0 }] });
    expect(lineWithATrip.status).toBe(404);
    const draftFromAContractor = await B.api.post(`${INV}/draft-from-jobs`, { contractorId: refA.ids.contractors["Lammel QA"]._id, from: "2026-01-01", to: "2026-12-31" });
    expect(draftFromAContractor.status).toBe(404);
    // and A's job is still unbilled for A
    const unbilled = (await refA.api.get(`${INV}/unbilled`)).body;
    expect(unbilled.jobs[0]).toMatchObject({ legs: 1, total: 999 });
  });

  test("@full with the invoices/quotations/expenses/fuel modules switched off the endpoints answer 403 MODULE_DISABLED", async () => {
    const t = await createTenant("NoModules", { modules: { invoices: false, quotations: false, expenses: false, fuel: false, analytics: true } });
    const api = await t.api();
    const probes = [
      ["GET", `${INV}/get-invoices`], ["POST", `${INV}/create-invoice`, { customerName: "X", lines: oneLine }],
      ["GET", `${PAY}/get-payments`], ["GET", `${QUO}/get-quotations`], ["POST", `${QUO}/create-quotation`, { customerName: "X", lines: oneLine }],
      ["GET", `${EXP}/profitability?year=2026`], ["GET", `${EXP}/get-expenses`], ["GET", `${FUEL}/get-fills`],
    ];
    for (const [m, path, body] of probes) {
      const r = await api.request(m, path, body ? { json: body } : {});
      expect(r.status, `${m} ${path}`).toBe(403);
      expect(r.body.message).toMatch(/switched off/i);
    }
    // the core dashboard stats are not a module and keep working
    expect((await api.get("/api/v2/overallStats/get-all-overallStats-company?year=2026")).status).toBeLessThan(300);
    // switching a module on takes effect (cache is cleared by the settings call)
    expect((await api.put("/api/v2/tenant/modules", { modules: { invoices: true } })).status).toBe(200);
    expect((await api.get(`${INV}/get-invoices`)).status).toBe(200);
  });
});

test.describe("finance is read-only when the company cannot write", () => {
  const states = {
    "the trial has ended": { band: "starter", status: "trial", trialEndsAt: daysFromNow(-2) },
    "payment is 10 days overdue": { band: "starter", status: "active", paidUntil: daysFromNow(-10) },
  };
  for (const [label, billing] of Object.entries(states)) {
    test(`@${label.startsWith("the trial") ? "smoke @full" : "full"} when ${label}: every finance write is 402, reads, lists and PDFs still work, data is unchanged`, async () => {
      const c = await company("RO" + label.slice(0, 5).replace(/\W/g, ""));
      await ctl("/ctl/billing", { companyId: c.t.companyId, billing });
      const api = c.api;
      const counts = async () => Object.fromEntries(await Promise.all(["invoices", "payments", "quotations", "expenses", "counters"].map(async (k) => [k, (await find(k, { [k === "expenses" ? "companyId" : "tenantId"]: c.t.companyId })).length])));
      const before = await counts();
      for (const [m, path, body] of ENDPOINTS(c.ids)) {
        const r = await api.request(m, path, body !== undefined ? { json: body } : {});
        if (WRITES.has(m)) {
          expect(r.status, `${m} ${path}`).toBe(402);
          expect(String(r.body.message), `${m} ${path}`).toMatch(/trial has ended|overdue/i);
        } else {
          expect(r.status, `${m} ${path}`).toBeLessThan(300);
        }
      }
      expect(await counts()).toEqual(before);
      const pdf = await api.get(`${INV}/pdf/${c.ids.inv}`, { raw: true });
      expect(pdf.buffer.subarray(0, 5).toString()).toBe("%PDF-");
      // restoring the subscription restores writing at once
      await ctl("/ctl/billing", { companyId: c.t.companyId, billing: { band: "starter", status: "active", paidUntil: daysFromNow(30) } });
      expect((await api.post(`${INV}/issue/${c.ids.draft}`)).status).toBe(200);
    });
  }

  test("@full suspended companies cannot create invoices or record payments but keep read access", async ({ world }) => {
    const c = await company("Susp");
    const platform = await Api.login(world.platform.email, world.platform.password);
    expect((await platform.put("/api/v2/tenant/billing", { companyId: c.t.companyId, status: "suspended" })).status).toBe(200);
    // suspended answers 403 (not 402 like trial/overdue/cancelled): see billing.spec.js
    const w1 = await c.api.post(`${INV}/create-invoice`, { customerName: "S", lines: oneLine });
    expect(w1.status).toBe(403);
    expect(w1.body.message).toMatch(/suspended/i);
    expect((await c.api.post(`${PAY}/record-payment`, { customerName: "S", amount: 1 })).status).toBe(403);
    expect((await c.api.get(`${INV}/get-invoices`)).status).toBe(200);
  });
});

test.describe("PDF documents", () => {
  test("@smoke @full an issued invoice PDF is a real PDF with the company, number, customer, lines, totals and footer", async () => {
    const t = await createTenant("Pdf");
    const api = await t.api();
    const inv = await issued(api, {
      customerName: "Acme (Pvt) Ltd & Sons",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      taxRatePct: 15,
      notes: "Bank: FNB 123456",
      terms: "Pay within 30 days",
      lines: [{ description: "Harare to Mutare (return)", quantity: 2, unitPrice: 45.5 }, { description: "Border fee", quantity: 1, unitPrice: 100 }],
    });
    await api.post(`${PAY}/record-payment`, { customerName: "Acme (Pvt) Ltd & Sons", amount: 100, allocations: [{ invoiceId: inv._id, amount: 100 }] });

    const res = await api.get(`${INV}/pdf/${inv._id}`, { raw: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/pdf/);
    expect(res.headers.get("content-disposition")).toContain("INV-0001.pdf");
    const pdf = res.buffer;
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-16).toString()).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(1500);

    const text = pdfText(pdf);
    for (const needle of [t.name, "INVOICE", "INV-0001", "Date: 2026-03-01", "Due: 2026-03-31", "Bill to", "Acme (Pvt) Ltd & Sons",
      "Harare to Mutare (return)", "Border fee", "Subtotal", "$191.00", "Tax (15%)", "$28.65", "Total", "$219.65", "Paid", "$100.00", "Balance due", "$119.65",
      "Bank: FNB 123456", "Pay within 30 days"]) {
      expect(text, `PDF text should contain "${needle}"`).toContain(needle);
    }
    // the footer says it is a business document, not a fiscal tax invoice
    expect(text).toMatch(/prepared with myfleet/i);
    expect(text).toMatch(/not a ZIMRA fiscalised tax invoice/i);
    expect(text).not.toContain("VOID");
  });

  test("@full draft, void and paid variants: DRAFT label, VOID stamp, no balance block on non-issued", async () => {
    const t = await createTenant("PdfStates");
    const api = await t.api();
    const dr = await draft(api, { customerName: "Drafty" });
    const dtxt = pdfText((await api.get(`${INV}/pdf/${dr._id}`, { raw: true })).buffer);
    expect(dtxt).toContain("DRAFT");
    expect(dtxt).not.toContain("Balance due");
    const dres = await api.get(`${INV}/pdf/${dr._id}`, { raw: true });
    expect(dres.headers.get("content-disposition")).toContain("draft-invoice.pdf");

    const v = await issued(api, { customerName: "Voidy" });
    await api.post(`${INV}/void/${v._id}`, { reason: "dup" });
    const vtxt = pdfText((await api.get(`${INV}/pdf/${v._id}`, { raw: true })).buffer);
    expect(vtxt).toContain("VOID");
    expect(vtxt).toContain("INV-0001");

    const p = await issued(api, { customerName: "Payer", lines: [{ description: "x", quantity: 1, unitPrice: 10 }] });
    await api.post(`${INV}/credit-note/${p._id}`, { amount: 4 });
    const ptxt = pdfText((await api.get(`${INV}/pdf/${p._id}`, { raw: true })).buffer);
    expect(ptxt).toContain("Credit notes");
    expect(ptxt).toContain("$4.00");
    expect(ptxt).toContain("$6.00");
  });

  test("@full a quotation PDF carries QUOTATION, number, valid-until, subject and the footer", async () => {
    const t = await createTenant("PdfQuo");
    const api = await t.api();
    const q = (await api.post(`${QUO}/create-quotation`, { customerName: "Quote Co", subject: "Harare to Joburg 30t", issueDate: "2026-04-01", validUntil: "2026-04-15", taxRatePct: 10, lines: [{ description: "Freight", quantity: 2, unitPrice: 450.25 }] })).body.quotation;
    const res = await api.get(`${QUO}/pdf/${q._id}`, { raw: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/pdf/);
    expect(res.headers.get("content-disposition")).toContain("QUO-0001.pdf");
    const text = pdfText(res.buffer);
    for (const needle of [t.name, "QUOTATION", "QUO-0001", "Valid until: 2026-04-15", "Quote Co", "Harare to Joburg 30t", "Freight", "$900.50", "Tax (10%)", "$90.05", "$990.55"]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).toMatch(/Quotation prepared with myfleet/);
    expect(text).not.toContain("Balance due"); // quotations have no payment block
  });

  test("@full long invoices page properly (80 lines -> several pages) and hostile text cannot break the file", async () => {
    const t = await createTenant("PdfBig");
    const api = await t.api();
    const lines = Array.from({ length: 80 }, (_, i) => ({ description: `Leg ${i + 1} ${"x".repeat(i % 7 ? 10 : 140)}`, quantity: 1, unitPrice: 1 }));
    lines[3].description = `(((unbalanced ) \\ " <script>alert(1)</script> Ñandú Éxpress`;
    const inv = await issued(api, { customerName: "=HYPERLINK(\"http://evil.test\")", lines, notes: "N".repeat(1500) });
    const res = await api.get(`${INV}/pdf/${inv._id}`, { raw: true });
    expect(res.status).toBe(200);
    const raw = res.buffer.toString("latin1");
    const pages = (raw.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(2);
    const text = pdfText(res.buffer);
    expect(text).toContain("Leg 80");
    expect(text).toContain("$80.00");
    expect(text).toContain("<script>alert(1)</script>"); // printed as text, nothing executes in a PDF
    expect(text).toContain("=HYPERLINK");
  });

  test("@smoke @full a PDF never contains another company's data, even with identical customer names", async () => {
    const A = await createTenant("PdfIsoA");
    const B = await createTenant("PdfIsoB");
    const [apiA, apiB] = [await A.api(), await B.api()];
    // overlapping customer name on purpose; distinct amounts
    const ia = await issued(apiA, { customerName: "Shared Name Ltd", lines: [{ description: "A-only haulage", quantity: 1, unitPrice: 111.11 }] });
    const ib = await issued(apiB, { customerName: "Shared Name Ltd", lines: [{ description: "B-only haulage", quantity: 1, unitPrice: 222.22 }] });
    const ta = pdfText((await apiA.get(`${INV}/pdf/${ia._id}`, { raw: true })).buffer);
    const tb = pdfText((await apiB.get(`${INV}/pdf/${ib._id}`, { raw: true })).buffer);
    expect(ta).toContain(A.name);
    expect(ta).not.toContain(B.name);
    expect(ta).toContain("$111.11");
    expect(ta).not.toContain("B-only");
    expect(ta).not.toContain("222.22");
    expect(tb).toContain(B.name);
    expect(tb).not.toContain(A.name);
    expect(tb).not.toContain("A-only");
    // B asking for A's PDF is refused and returns no PDF bytes
    const stolen = await apiB.get(`${INV}/pdf/${ia._id}`, { raw: true });
    expect(stolen.status).toBe(404);
    expect(stolen.buffer.subarray(0, 4).toString()).not.toBe("%PDF");
    // both are INV-0001 for their own company: same number, different documents
    expect(ia.number).toBe(ib.number);
  });

  test("@full PDF endpoint errors: bad id 400, unknown id 404 (JSON, not a broken PDF)", async () => {
    const t = await createTenant("PdfErr");
    const api = await t.api();
    expect((await api.get(`${INV}/pdf/zzz`)).status).toBe(400);
    expect((await api.get(`${INV}/pdf/${ID0}`)).status).toBe(404);
    expect((await api.get(`${QUO}/pdf/${ID0}`)).status).toBe(404);
  });
});
