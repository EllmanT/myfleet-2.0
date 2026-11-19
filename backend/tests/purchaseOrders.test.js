const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const Trip = require("../model/trip");
const PurchaseOrder = require("../model/purchaseOrder");
const { clearModuleCache } = require("../middleware/moduleAccess");
const app = require("../app");

const ON = { crossBorder: true, invoices: true, quotations: true };

async function makeCompany(modules = ON) {
  return Deliverer.create({
    companyName: "Co " + Math.random().toString(36).slice(2, 7),
    address: "a", city: "c", goodsType: ["g"], vehiclesType: ["v"], deliveryType: ["d"],
    modules,
  });
}
async function cookieFor(company, role = "Deliverer Admin") {
  const u = await User.create({
    name: "U", email: Math.random().toString(36).slice(2) + "@t.com", password: "password123",
    phoneNumber: "1", role, address: "a", city: "c", companyId: company._id,
  });
  return ["token=" + jwt.sign({ id: u._id }, process.env.JWT_SECRET_KEY)];
}

// a real 1x1 PNG, so the file-type check accepts it
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

describe("purchase orders, delivery notes and the letterhead", () => {
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
    await Trip.syncIndexes();
    await PurchaseOrder.syncIndexes();
    clearModuleCache();
  });

  test("a purchase order needs only a client and a date, and may start its trips", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const bad = await request(app).post("/api/v2/purchase-order/create-po").set("Cookie", cookie).send({ customerName: "Bonds" });
    expect(bad.status).toBe(400);

    // word of mouth: no number, no price, no route
    const res = await request(app).post("/api/v2/purchase-order/create-po").set("Cookie", cookie)
      .send({ customerName: "Bonds", date: "2026-10-01", tripCount: 2 });
    expect(res.status).toBe(201);
    expect(res.body.tripsCreated).toBe(2);
    const trips = await Trip.find({ tenantId: co._id });
    expect(trips).toHaveLength(2);
    expect(trips[0].price).toBe(0); // blank price is 0 until known
    expect(String(trips[0].purchaseOrderId)).toBe(res.body.purchaseOrder._id);
  });

  test("the same PO number can't be used twice for one client, but is fine for another", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const mk = (customerName, poNumber) =>
      request(app).post("/api/v2/purchase-order/create-po").set("Cookie", cookie).send({ customerName, date: "2026-10-01", poNumber });
    expect((await mk("Bonds", "PO-1")).status).toBe(201);
    expect((await mk("Bonds", "PO-1")).status).toBe(409);
    expect((await mk("Other", "PO-1")).status).toBe(201);
  });

  test("a company can't see or change another company's purchase orders", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const ca = await cookieFor(a);
    const cb = await cookieFor(b);
    const po = (await request(app).post("/api/v2/purchase-order/create-po").set("Cookie", ca).send({ customerName: "X", date: "2026-10-01" })).body.purchaseOrder;
    expect((await request(app).get(`/api/v2/purchase-order/get-po/${po._id}`).set("Cookie", cb)).status).toBe(404);
    expect((await request(app).delete(`/api/v2/purchase-order/delete-po/${po._id}`).set("Cookie", cb)).status).toBe(404);
    const list = await request(app).get("/api/v2/purchase-order/get-pos").set("Cookie", cb);
    expect(list.body.purchaseOrders).toHaveLength(0);
    // and can't attach its trip to the other company's order
    const bad = await request(app).post("/api/v2/trip/create-trip").set("Cookie", cb).send({
      date: "2026-10-01", customerName: "X", price: 1, purchaseOrderId: po._id,
      stops: [{ place: "A" }, { place: "B" }],
    });
    expect(bad.status).toBe(404);
  });

  test("deleting a purchase order keeps its trips", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const po = (await request(app).post("/api/v2/purchase-order/create-po").set("Cookie", cookie).send({ customerName: "X", date: "2026-10-01", tripCount: 1 })).body.purchaseOrder;
    expect((await request(app).delete(`/api/v2/purchase-order/delete-po/${po._id}`).set("Cookie", cookie)).status).toBe(200);
    const trips = await Trip.find({ tenantId: co._id });
    expect(trips).toHaveLength(1);
    expect(trips[0].purchaseOrderId).toBeUndefined();
  });

  test("delivery note numbers are given once, in order, and a signed copy marks the trip delivered", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const mk = async () => (await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send({
      date: "2026-10-01", customerName: "X", price: 0, stops: [{ place: "A" }, { place: "B" }],
    })).body.trip;
    const t1 = await mk();
    const t2 = await mk();

    // no number yet: the PDF is refused, not invented
    expect((await request(app).get(`/api/v2/trip/delivery-note-pdf/${t1._id}`).set("Cookie", cookie)).status).toBe(409);

    const n1 = await request(app).post(`/api/v2/trip/delivery-note/${t1._id}`).set("Cookie", cookie);
    const again = await request(app).post(`/api/v2/trip/delivery-note/${t1._id}`).set("Cookie", cookie);
    const n2 = await request(app).post(`/api/v2/trip/delivery-note/${t2._id}`).set("Cookie", cookie);
    expect(n1.body.deliveryNoteNo).toBe("DN-0001");
    expect(again.body.deliveryNoteNo).toBe("DN-0001");
    expect(n2.body.deliveryNoteNo).toBe("DN-0002");

    const pdf = await request(app).get(`/api/v2/trip/delivery-note-pdf/${t1._id}`).set("Cookie", cookie);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);

    const up = await request(app).post(`/api/v2/trip/signed-copy/${t1._id}`).set("Cookie", cookie).attach("file", PNG, "signed.png");
    expect(up.status).toBe(200);
    const list = await request(app).get("/api/v2/trip/get-trips").set("Cookie", cookie);
    const row = list.body.trips.find((t) => t._id === t1._id);
    expect(row.status).toBe("delivered");
    expect(row.hasSignedCopy).toBe(true);
    expect(row.payStatus).toBe("not_invoiced");
  });

  test("a trip with no purchase order and no delivery note can still be invoiced and shows its paid status", async () => {
    const co = await makeCompany();
    const cookie = await cookieFor(co);
    const trip = (await request(app).post("/api/v2/trip/create-trip").set("Cookie", cookie).send({
      date: "2026-10-01", customerName: "Bonds", price: 500, stops: [{ place: "A" }, { place: "B" }],
    })).body.trip;
    const inv = await request(app).post("/api/v2/invoice/create-invoice").set("Cookie", cookie).send({
      customerName: "Bonds", issueDate: "2026-10-05", lines: [{ description: "Trip", quantity: 1, unitPrice: 500, tripId: trip._id }],
    });
    expect(inv.status).toBe(201);
    const id = inv.body.invoice._id;
    const issue = await request(app).post(`/api/v2/invoice/issue/${id}`).set("Cookie", cookie);
    expect(issue.status).toBe(200);

    const status = async () =>
      (await request(app).get("/api/v2/trip/get-trips").set("Cookie", cookie)).body.trips[0].payStatus;
    expect(await status()).toBe("invoiced");

    const pay = (amount) =>
      request(app).post("/api/v2/payment/record-payment").set("Cookie", cookie).send({
        customerName: "Bonds", date: "2026-10-10", amount, allocations: [{ invoiceId: id, amount }],
      });
    expect((await pay(200)).status).toBe(201);
    expect(await status()).toBe("part_paid");
    expect((await pay(300)).status).toBe(201);
    expect(await status()).toBe("paid");

    // the invoice prints even with no PO or delivery note on the trip
    const pdf = await request(app).get(`/api/v2/invoice/pdf/${id}`).set("Cookie", cookie);
    expect(pdf.status).toBe(200);
  });

  test("letterhead: admins can save details and a logo; others can't; bad input is refused", async () => {
    const co = await makeCompany();
    const admin = await cookieFor(co);
    const manager = await cookieFor(co, "Deliverer Manager");

    const saved = await request(app).put("/api/v2/letterhead").set("Cookie", admin)
      .send({ phone: "+263 77 000 0000", email: "info@allea.co.zw", tin: "1234567", bankDetails: "Bank X\nAcc 123", paymentTermsDays: 30, address: "Whiteway, Msasa" });
    expect(saved.status).toBe(200);
    expect(saved.body.letterhead.tin).toBe("1234567");
    expect(saved.body.letterhead.address).toBe("Whiteway, Msasa");

    expect((await request(app).put("/api/v2/letterhead").set("Cookie", manager).send({ tin: "x" })).status).toBe(403);
    expect((await request(app).put("/api/v2/letterhead").set("Cookie", admin).send({ email: "nope" })).status).toBe(400);
    expect((await request(app).put("/api/v2/letterhead").set("Cookie", admin).send({ paymentTermsDays: -1 })).status).toBe(400);
    expect((await request(app).post("/api/v2/letterhead/logo").set("Cookie", admin).attach("logo", Buffer.from("not an image at all"), "x.png")).status).toBe(400);

    const logo = await request(app).post("/api/v2/letterhead/logo").set("Cookie", admin).attach("logo", PNG, "logo.png");
    expect(logo.status).toBe(200);
    expect(logo.body.letterhead.hasLogo).toBe(true);

    // a quotation PDF with a logo and full letterhead renders
    const q = await request(app).post("/api/v2/quotation/create-quotation").set("Cookie", admin).send({
      customerName: "Bonds", issueDate: "2026-10-01", lines: [{ description: "Haul", quantity: 1, unitPrice: 10 }],
    });
    expect(q.status).toBe(201);
    const pdf = await request(app).get(`/api/v2/quotation/pdf/${q.body.quotation._id}`).set("Cookie", admin);
    expect(pdf.status).toBe(200);
  });
});
