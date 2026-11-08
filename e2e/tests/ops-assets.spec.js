/*
 * Trips (incl. cross-border), trailers, compliance documents, maintenance, service plans and
 * tyres, API level. Worked examples are from docs/qa/TEST_DATA.md sections 6 and 7:
 *   T1 Harare > Bulawayo 1500 USD, costs 400 + 50 + 120 = 570, margin 930
 *   T2 Harare ZW > Johannesburg SA (cross-border) 2000 USD, 800 km, fuel 700
 *   T3 Musina SA > Harare ZW 30000 ZAR, 1000 km;  T4 cancelled, 900 USD
 *   summary: trips 3, cross-border 2, 2100 km, USD 3500, ZAR 30000
 *   tyre T-001: 400.00 fitted at 50,000, truck now 60,000 -> 0.04 per km
 *   service plan "Full service" every 10,000 km, last done 50,000, truck at 59,500
 */
const { test, expect } = require("../support/fixtures");
const { Api } = require("../support/api");
const o = require("../support/ops");

const TRIP = "/api/v2/trip";
const TRL = "/api/v2/trailer";
const DOC = "/api/v2/compliance";
const MNT = "/api/v2/maintenance";

const tripBody = (over = {}) => ({
  date: "2026-03-05",
  customerName: "Delta Mining",
  price: 1500,
  currency: "USD",
  distanceKm: 300,
  status: "delivered",
  deliveredAt: "2026-03-06",
  stops: [{ place: "Harare", country: "ZW" }, { place: "Bulawayo", country: "ZW" }],
  costLines: [
    { type: "fuel", amount: 400 },
    { type: "toll", amount: 50 },
    { type: "border_fee", amount: 120 },
  ],
  ...over,
});

async function setup(label, opts) {
  const t = await o.makeTenant(label, opts);
  const admin = await t.api("admin");
  const manager = await t.api("manager");
  return { t, admin, manager };
}

test.describe("trips and cross-border trips (API)", () => {
  test("@smoke @full create a trip: totals and margin (T1), list, edit, delete", async () => {
    const { admin } = await setup("Trips");
    const c = await admin.post(`${TRIP}/create-trip`, tripBody({ clientRef: "AL.01" }));
    expect(c.status).toBe(201);
    const trip = c.body.trip;
    expect(trip).toMatchObject({ totalCosts: 570, margin: 930, mixedCurrency: false, isCrossBorder: false, status: "delivered", clientRef: "AL.01" });
    expect(trip.costsByCurrency).toEqual({ USD: 570 });

    const list = await admin.get(`${TRIP}/get-trips`);
    expect(list.body.total).toBe(1);
    expect(list.body.trips[0]).toMatchObject({ _id: trip._id, margin: 930 });

    // edit: price and an extra cost line; a field the form clears (distance) really clears
    const up = await admin.put(`${TRIP}/update-trip/${trip._id}`, { price: 1600, costLines: [...trip.costLines, { type: "parking", amount: 30 }], distanceKm: "" });
    expect(up.status).toBe(200);
    expect(up.body.trip).toMatchObject({ price: 1600, totalCosts: 600, margin: 1000 });
    expect(up.body.trip.distanceKm).toBeUndefined();

    expect((await admin.del(`${TRIP}/delete-trip/${trip._id}`)).status).toBe(200);
    expect((await admin.get(`${TRIP}/get-trips`)).body.total).toBe(0);
    expect((await admin.del(`${TRIP}/delete-trip/${trip._id}`)).status).toBe(404);
  });

  test("@smoke @full the 2026 worked set: summary counts, cross-border detection, currencies", async () => {
    const { admin } = await setup("TripSet");
    const t1 = await admin.post(`${TRIP}/create-trip`, tripBody());
    const t2 = await admin.post(`${TRIP}/create-trip`, tripBody({
      date: "2026-03-08", deliveredAt: "2026-03-10", price: 2000, distanceKm: 800, customerName: "Delta Mining",
      stops: [{ place: "Harare", country: "ZW" }, { place: "Johannesburg", country: "SA" }], costLines: [{ type: "fuel", amount: 700 }],
    }));
    const t3 = await admin.post(`${TRIP}/create-trip`, tripBody({
      date: "2026-03-12", deliveredAt: "2026-03-14", price: 30000, currency: "ZAR", distanceKm: 1000, customerName: "Beta Foods",
      stops: [{ place: "Musina", country: "SA" }, { place: "Harare", country: "ZW" }], costLines: [{ type: "fuel", amount: 12000, currency: "ZAR" }],
    }));
    const t4 = await admin.post(`${TRIP}/create-trip`, tripBody({
      date: "2026-03-15", price: 900, distanceKm: 100, customerName: "Gamma Steel", status: "cancelled", deliveredAt: undefined,
      stops: [{ place: "Harare", country: "ZW" }, { place: "Mutare", country: "ZW" }], costLines: [],
    }));
    for (const r of [t1, t2, t3, t4]) expect(r.status).toBe(201);
    expect(t1.body.trip.isCrossBorder).toBe(false);
    expect(t2.body.trip.isCrossBorder).toBe(true);
    expect(t3.body.trip.isCrossBorder).toBe(true);
    expect(t3.body.trip).toMatchObject({ currency: "ZAR", totalCosts: 12000, margin: 18000 });
    expect(t4.body.trip.status).toBe("cancelled");

    const s = await admin.get(`${TRIP}/summary?from=2026-01-01&to=2026-12-31`);
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ trips: 3, crossBorderTrips: 2, distanceKm: 2100 });
    expect(s.body.byCurrency.USD.revenue).toBe(3500);
    expect(s.body.byCurrency.ZAR.revenue).toBe(30000);
    expect(s.body.byCurrency.USD.costs).toBe(1270);
    expect(s.body.byCurrency.ZAR.costs).toBe(12000);
    expect(s.body.byMonth).toHaveLength(1);
    expect(s.body.byMonth[0]).toMatchObject({ month: "2026-03", trips: 3 });

    // filters: cross-border only, status, search, date range, paging
    expect((await admin.get(`${TRIP}/get-trips?crossBorder=true`)).body.total).toBe(2);
    expect((await admin.get(`${TRIP}/get-trips?crossBorder=false`)).body.total).toBe(2);
    expect((await admin.get(`${TRIP}/get-trips?status=cancelled`)).body.total).toBe(1);
    expect((await admin.get(`${TRIP}/get-trips?search=musina`)).body.total).toBe(1);
    expect((await admin.get(`${TRIP}/get-trips?search=beta`)).body.total).toBe(1);
    expect((await admin.get(`${TRIP}/get-trips?from=2026-03-07&to=2026-03-13`)).body.total).toBe(2);
    expect((await admin.get(`${TRIP}/get-trips?search=.*`)).body.total).toBe(0);
    const p0 = await admin.get(`${TRIP}/get-trips?page=0&pageSize=3`);
    const p1 = await admin.get(`${TRIP}/get-trips?page=1&pageSize=3`);
    expect(p0.body.trips).toHaveLength(3);
    expect(p1.body.trips).toHaveLength(1);
    expect(p0.body.trips[0].date.slice(0, 10)).toBe("2026-03-15"); // newest first
    // a different year has nothing
    expect((await admin.get(`${TRIP}/summary?from=2025-01-01&to=2025-12-31`)).body.trips).toBe(0);
  });

  test("@full a cost in another currency means no margin is guessed", async () => {
    const { admin } = await setup("Mixed");
    const r = await admin.post(`${TRIP}/create-trip`, tripBody({ costLines: [{ type: "fuel", amount: 400 }, { type: "toll", amount: 900, currency: "ZAR" }] }));
    expect(r.status).toBe(201);
    expect(r.body.trip).toMatchObject({ mixedCurrency: true, margin: null });
    expect(r.body.trip.costsByCurrency).toEqual({ USD: 400, ZAR: 900 });
  });

  test("@full trip validation", async () => {
    const { t, admin } = await setup("TripVal");
    const bad = async (label, over, status = 400) => {
      const r = await admin.post(`${TRIP}/create-trip`, tripBody(over));
      expect(r.status, label).toBe(status);
      return r;
    };
    await bad("no date", { date: undefined });
    await bad("bad date", { date: "yesterday-ish" });
    await bad("no customer", { customerName: "  " });
    await bad("no price", { price: undefined });
    await bad("negative price", { price: -1 });
    await bad("text price", { price: "lots" });
    await bad("one stop", { stops: [{ place: "Harare", country: "ZW" }] });
    await bad("blank stops", { stops: [{ place: "", country: "ZW" }, { place: " ", country: "ZW" }] });
    await bad("13 stops", { stops: Array.from({ length: 13 }, (_, i) => ({ place: `P${i}`, country: "ZW" })) });
    await bad("negative distance", { distanceKm: -5 });
    await bad("delivered before trip date", { date: "2026-03-05", deliveredAt: "2026-03-01" });
    await bad("bad cost amount", { costLines: [{ type: "fuel", amount: -4 }] });
    await bad("61 cost lines", { costLines: Array.from({ length: 61 }, () => ({ type: "fuel", amount: 1 })) });
    await bad("border cleared before arrival", { borderCrossings: [{ post: "Beitbridge", arrivedAt: "2026-03-05T10:00:00Z", clearedAt: "2026-03-05T08:00:00Z" }] });
    expect(await o.count("trips", { tenantId: t.companyId })).toBe(0);

    // unknown currency / cost type / status fall back to safe defaults instead of failing
    const r = await admin.post(`${TRIP}/create-trip`, tripBody({ currency: "EUR", status: "flying", costLines: [{ type: "mystery", amount: 5 }] }));
    expect(r.status).toBe(201);
    expect(r.body.trip).toMatchObject({ currency: "USD", status: "delivered" });
    expect(r.body.trip.costLines[0].type).toBe("other");

    // border crossings round-trip
    const ok = await admin.post(`${TRIP}/create-trip`, tripBody({
      borderCrossings: [{ post: "Beitbridge", direction: "out", arrivedAt: "2026-03-05T08:00:00Z", clearedAt: "2026-03-05T14:00:00Z" }],
    }));
    expect(ok.body.trip.borderCrossings[0]).toMatchObject({ post: "Beitbridge", direction: "out" });
  });

  test("@full job reference (clientRef) is unique inside a company only", async () => {
    const A = await setup("RefA");
    const B = await setup("RefB");
    expect((await A.admin.post(`${TRIP}/create-trip`, tripBody({ clientRef: "AL.01" }))).status).toBe(201);
    const dup = await A.admin.post(`${TRIP}/create-trip`, tripBody({ clientRef: "AL.01" }));
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/already used/i);
    expect((await B.admin.post(`${TRIP}/create-trip`, tripBody({ clientRef: "AL.01" }))).status).toBe(201);
  });

  test("@full a trip can carry this company's truck, trailer and driver, and nobody else's", async () => {
    const A = await setup("Assets");
    const B = await setup("AssetsB");
    const ba = await o.baseline(A.t, A.admin);
    const bb = await o.baseline(B.t, B.admin);
    const trailer = (await A.admin.post(`${TRL}/create-trailer`, { regNumber: "ZZA 1234", type: "tautliner", axles: 3, capacityTons: 34 })).body.trailer;
    const theirs = (await B.admin.post(`${TRL}/create-trailer`, { regNumber: "ZZB 9999" })).body.trailer;

    const ok = await A.admin.post(`${TRIP}/create-trip`, tripBody({ horseId: ba.vehicle._id, driverId: ba.driver._id, trailerId: trailer._id }));
    expect(ok.status).toBe(201);
    expect(ok.body.trip).toMatchObject({ horseId: ba.vehicle._id, driverId: ba.driver._id, trailerId: trailer._id });
    expect((await A.admin.get(`${TRIP}/get-trips?horseId=${ba.vehicle._id}`)).body.total).toBe(1);

    for (const [label, over] of [
      ["truck", { horseId: bb.vehicle._id }],
      ["driver", { driverId: bb.driver._id }],
      ["trailer", { trailerId: theirs._id }],
    ]) {
      const r = await A.admin.post(`${TRIP}/create-trip`, tripBody(over));
      expect(r.status, label).toBe(404);
    }
    const mine = ok.body.trip._id;
    expect((await A.admin.put(`${TRIP}/update-trip/${mine}`, { horseId: bb.vehicle._id })).status).toBe(404);
    expect(await o.count("trips", { tenantId: A.t.companyId })).toBe(1);

    // meta lists only this company's assets
    const meta = await A.admin.get(`${TRIP}/meta`);
    expect(meta.status).toBe(200);
    expect(JSON.stringify(meta.body)).not.toContain(bb.vehicle._id);
    expect(JSON.stringify(meta.body)).not.toContain(theirs._id);
    expect(meta.body.currencies).toEqual(["USD", "ZAR", "ZWG"]);
  });

  test("@full Manager can use trips; anonymous cannot; module off blocks everyone", async () => {
    const { manager, t } = await setup("TripRoles");
    const c = await manager.post(`${TRIP}/create-trip`, tripBody());
    expect(c.status).toBe(201);
    expect((await manager.put(`${TRIP}/update-trip/${c.body.trip._id}`, { price: 1 })).status).toBe(200);
    expect((await manager.del(`${TRIP}/delete-trip/${c.body.trip._id}`)).status).toBe(200);
    expect((await Api.anonymous().get(`${TRIP}/get-trips`)).status).toBe(401);
    expect((await Api.anonymous().post(`${TRIP}/create-trip`, tripBody())).status).toBe(401);

    const off = await o.makeTenant("TripOff", { modules: { crossBorder: false } });
    const a = await off.api();
    for (const r of [await a.get(`${TRIP}/get-trips`), await a.post(`${TRIP}/create-trip`, tripBody()), await a.get(`${TRIP}/summary`)]) {
      expect(r.status).toBe(403);
    }
    expect(await o.count("trips", { tenantId: off.companyId })).toBe(0);
    expect(t.companyId).not.toBe(off.companyId);
  });

  test("@smoke @full tenant B cannot read, edit, delete or summarise A's trips", async ({ world }) => {
    const { A, B } = world;
    const a = await A.api();
    const b = await B.api();
    const made = await a.post(`${TRIP}/create-trip`, tripBody({ customerName: "TRIPMARK-A", clientRef: `W${Date.now()}` }));
    expect(made.status).toBe(201);
    const id = made.body.trip._id;
    const before = (await o.find("trips", { _id: id }))[0];

    expect((await b.put(`${TRIP}/update-trip/${id}`, { price: 1, customerName: "hacked" })).status).toBe(404);
    expect((await b.del(`${TRIP}/delete-trip/${id}`)).status).toBe(404);
    expect((await o.find("trips", { _id: id }))[0]).toEqual(before);
    for (const url of [`${TRIP}/get-trips`, `${TRIP}/get-trips?search=TRIPMARK`, `${TRIP}/summary`, `${TRIP}/meta`]) {
      const r = await b.get(url);
      expect(r.status, url).toBe(200);
      expect(r.text.includes("TRIPMARK-A"), url).toBe(false);
      expect(r.text.includes(id), url).toBe(false);
    }
    expect((await a.get(`${TRIP}/get-trips?search=TRIPMARK`)).body.total).toBe(1); // positive control
    // a body claiming A's tenant is ignored
    const forged = await b.post(`${TRIP}/create-trip`, tripBody({ tenantId: A.companyId, customerName: "TRIPMARK-B" }));
    expect(forged.status).toBe(201);
    expect((await o.find("trips", { _id: forged.body.trip._id }))[0].tenantId).toBe(B.companyId);
  });
});

test.describe("trailers (API)", () => {
  test("@smoke @full create, list, edit, delete a trailer", async () => {
    const { admin } = await setup("Trailers");
    const c = await admin.post(`${TRL}/create-trailer`, { regNumber: "ZZA 1234", type: "tautliner", axles: 3, capacityTons: 34 });
    expect(c.status).toBe(201);
    await admin.post(`${TRL}/create-trailer`, { regNumber: "ZZB 5678", type: "flatbed", axles: 2, capacityTons: 28 });
    const list = await admin.get(`${TRL}/get-trailers`);
    expect(list.body.trailers.map((t) => t.regNumber)).toEqual(["ZZA 1234", "ZZB 5678"]);
    expect(list.body.types).toContain("tautliner");

    const id = c.body.trailer._id;
    const up = await admin.put(`${TRL}/update-trailer/${id}`, { capacityTons: 30, active: false });
    expect(up.status).toBe(200);
    expect(up.body.trailer).toMatchObject({ regNumber: "ZZA 1234", capacityTons: 30, active: false });
    expect((await admin.get(`${TRL}/get-trailers?active=true`)).body.trailers).toHaveLength(1);

    expect((await admin.del(`${TRL}/delete-trailer/${id}`)).status).toBe(200);
    expect((await admin.get(`${TRL}/get-trailers`)).body.trailers).toHaveLength(1);
  });

  test("@full trailer validation: registration, numbers, duplicates (spaces and case ignored), delete protection", async () => {
    const { admin } = await setup("TrlVal");
    const post = (b) => admin.post(`${TRL}/create-trailer`, b);
    expect((await post({ regNumber: "  " })).status).toBe(400);
    expect((await post({ regNumber: "ZZC 1", axles: 13 })).status).toBe(400);
    expect((await post({ regNumber: "ZZC 1", axles: -1 })).status).toBe(400);
    expect((await post({ regNumber: "ZZC 1", capacityTons: 201 })).status).toBe(400);
    expect((await post({ regNumber: "ZZC 1", capacityTons: "heavy" })).status).toBe(400);
    expect((await post({ regNumber: "ZZA 1234" })).status).toBe(201);
    for (const again of ["ZZA 1234", "zza1234", " zza   1234 "]) {
      const d = await post({ regNumber: again });
      expect(d.status, again).toBe(409);
    }
    expect((await admin.get(`${TRL}/get-trailers`)).body.trailers).toHaveLength(1);

    // a trailer that has been on a trip cannot be deleted, only made inactive
    const tr = (await admin.get(`${TRL}/get-trailers`)).body.trailers[0];
    await admin.post(`${TRIP}/create-trip`, tripBody({ trailerId: tr._id }));
    const del = await admin.del(`${TRL}/delete-trailer/${tr._id}`);
    expect(del.status).toBe(409);
    expect(del.body.message).toMatch(/inactive/i);
    expect((await admin.del(`${TRL}/delete-trailer/not-an-id`)).status).toBe(400);
  });

  test("@full deleting a trailer removes its compliance documents", async () => {
    const { t, admin } = await setup("TrlDocs");
    const tr = (await admin.post(`${TRL}/create-trailer`, { regNumber: "ZZD 1" })).body.trailer;
    expect((await admin.post(`${DOC}/create-doc`, { ownerType: "trailer", ownerId: tr._id, docType: "insurance", expiresAt: o.isoDay(100) })).status).toBe(201);
    expect(await o.count("compliancedocs", { tenantId: t.companyId })).toBe(1);
    expect((await admin.del(`${TRL}/delete-trailer/${tr._id}`)).status).toBe(200);
    expect(await o.count("compliancedocs", { tenantId: t.companyId })).toBe(0);
  });

  test("@full the same registration may exist in two companies; Manager allowed; module off blocks", async () => {
    const A = await setup("TrlA");
    const B = await setup("TrlB");
    expect((await A.admin.post(`${TRL}/create-trailer`, { regNumber: "ZZA 1234" })).status).toBe(201);
    expect((await B.admin.post(`${TRL}/create-trailer`, { regNumber: "ZZA 1234" })).status).toBe(201);
    expect((await A.manager.post(`${TRL}/create-trailer`, { regNumber: "MGR 1" })).status).toBe(201);
    expect((await Api.anonymous().get(`${TRL}/get-trailers`)).status).toBe(401);
    const off = await o.makeTenant("TrlOff", { modules: { tractorUnits: false } });
    expect((await (await off.api()).get(`${TRL}/get-trailers`)).status).toBe(403);
  });

  test("@smoke @full tenant B cannot edit or delete A's trailer", async () => {
    const A = await setup("TrlXA");
    const B = await setup("TrlXB");
    const tr = (await A.admin.post(`${TRL}/create-trailer`, { regNumber: "ZZX 1" })).body.trailer;
    const before = (await o.find("trailers", { _id: tr._id }))[0];
    expect((await B.admin.put(`${TRL}/update-trailer/${tr._id}`, { regNumber: "HACKED" })).status).toBe(404);
    expect((await B.admin.del(`${TRL}/delete-trailer/${tr._id}`)).status).toBe(404);
    expect((await o.find("trailers", { _id: tr._id }))[0]).toEqual(before);
    const list = await B.admin.get(`${TRL}/get-trailers`);
    expect(list.text).not.toContain(tr._id);
  });
});

test.describe("compliance documents (API)", () => {
  test("@smoke @full create, list with status, edit and delete a document", async () => {
    const { t, admin } = await setup("Docs");
    const b = await o.baseline(t, admin);
    // expiring D-1, D, D+30, D+31, D+365
    const plan = [[-1, "expired"], [0, "due_soon"], [30, "due_soon"], [31, "ok"], [365, "ok"]];
    const created = [];
    for (const [offset] of plan) {
      const r = await admin.post(`${DOC}/create-doc`, {
        ownerType: "vehicle", ownerId: b.vehicle._id, docType: "insurance", number: `INS-${offset}`, expiresAt: o.isoDay(offset),
      });
      expect(r.status, `offset ${offset}`).toBe(201);
      created.push(r.body.doc._id);
    }
    const list = await admin.get(`${DOC}/get-docs`);
    expect(list.body.dueSoonDays).toBe(30);
    const byNumber = Object.fromEntries(list.body.docs.map((d) => [d.number, d]));
    for (const [offset, status] of plan) {
      expect(byNumber[`INS-${offset}`].status, `offset ${offset}`).toBe(status);
      expect(byNumber[`INS-${offset}`].daysLeft).toBe(offset);
      expect(byNumber[`INS-${offset}`].ownerName).toBe("Toyota Dyna QAA1001");
    }
    expect(list.body.docs.map((d) => d.number)).toEqual(["INS--1", "INS-0", "INS-30", "INS-31", "INS-365"]); // soonest expiry first
    expect((await admin.get(`${DOC}/get-docs?status=expired`)).body.docs).toHaveLength(1);
    expect((await admin.get(`${DOC}/get-docs?status=due_soon`)).body.docs).toHaveLength(2);
    expect((await admin.get(`${DOC}/get-docs?status=ok`)).body.docs).toHaveLength(2);
    const exp = await admin.get(`${DOC}/expiring`);
    expect(exp.body.expired).toHaveLength(1);
    expect(exp.body.dueSoon).toHaveLength(2);
    expect((await admin.get(`${DOC}/expiring?days=400`)).body.dueSoon).toHaveLength(4);

    // renew the expired one
    const up = await admin.put(`${DOC}/update-doc/${created[0]}`, { expiresAt: o.isoDay(365), notes: "renewed" });
    expect(up.status).toBe(200);
    expect((await admin.get(`${DOC}/get-docs?status=expired`)).body.docs).toHaveLength(0);
    expect((await admin.del(`${DOC}/delete-doc/${created[0]}`)).status).toBe(200);
    expect((await admin.get(`${DOC}/get-docs`)).body.docs).toHaveLength(4);
    expect((await admin.del(`${DOC}/delete-doc/${created[0]}`)).status).toBe(404);
  });

  test("@full document owners: truck, trailer, driver; validation", async () => {
    const { t, admin } = await setup("DocOwn");
    const b = await o.baseline(t, admin);
    const tr = (await admin.post(`${TRL}/create-trailer`, { regNumber: "ZZE 1" })).body.trailer;
    const mk = (over) => admin.post(`${DOC}/create-doc`, { ownerType: "vehicle", ownerId: b.vehicle._id, docType: "yellow_card", expiresAt: o.isoDay(90), ...over });
    expect((await mk({})).status).toBe(201);
    expect((await mk({ ownerType: "trailer", ownerId: tr._id, docType: "roadworthy" })).status).toBe(201);
    expect((await mk({ ownerType: "driver", ownerId: b.driver._id, docType: "prdp" })).status).toBe(201);
    const meta = await admin.get(`${DOC}/meta`);
    expect(meta.body.docTypes).toContain("sadc_permit");
    expect(meta.body.vehicles).toHaveLength(1);

    for (const [label, over] of [
      ["no expiry", { expiresAt: undefined }],
      ["bad expiry", { expiresAt: "soon" }],
      ["issued after expiry", { issuedAt: o.isoDay(200), expiresAt: o.isoDay(100) }],
      ["bad issue date", { issuedAt: "x" }],
      ["unknown doc type", { docType: "library_card" }],
      ["unknown owner type", { ownerType: "bicycle" }],
      ["no owner", { ownerId: undefined }],
      ["malformed owner", { ownerId: "123" }],
    ]) {
      expect((await mk(over)).status, label).toBe(400);
    }
    expect((await mk({ ownerId: "000000000000000000000000" })).status).toBe(404);
    expect(await o.count("compliancedocs", { tenantId: t.companyId })).toBe(3);
  });

  test("@full Manager can use documents; anonymous cannot; tractor-units module off blocks", async () => {
    const { t, admin, manager } = await setup("DocRoles");
    const b = await o.baseline(t, admin);
    const body = { ownerType: "driver", ownerId: b.driver._id, docType: "drivers_licence", expiresAt: o.isoDay(60) };
    const c = await manager.post(`${DOC}/create-doc`, body);
    expect(c.status).toBe(201);
    expect((await manager.del(`${DOC}/delete-doc/${c.body.doc._id}`)).status).toBe(200);
    expect((await Api.anonymous().get(`${DOC}/get-docs`)).status).toBe(401);
    const off = await o.makeTenant("DocOff", { modules: { tractorUnits: false } });
    expect((await (await off.api()).get(`${DOC}/get-docs`)).status).toBe(403);
  });

  test("@smoke @full tenant B cannot attach to, read, edit or delete A's documents", async () => {
    const A = await setup("DocXA");
    const B = await setup("DocXB");
    const ba = await o.baseline(A.t, A.admin);
    const bb = await o.baseline(B.t, B.admin);
    const doc = (await A.admin.post(`${DOC}/create-doc`, { ownerType: "vehicle", ownerId: ba.vehicle._id, docType: "insurance", number: "A-ONLY-1", expiresAt: o.isoDay(10) })).body.doc;
    const before = (await o.find("compliancedocs", { _id: doc._id }))[0];

    // B attaching a document to A's truck / driver
    for (const [ownerType, ownerId] of [["vehicle", ba.vehicle._id], ["driver", ba.driver._id]]) {
      const r = await B.admin.post(`${DOC}/create-doc`, { ownerType, ownerId, docType: "insurance", expiresAt: o.isoDay(10) });
      expect(r.status, ownerType).toBe(404);
    }
    expect((await B.admin.put(`${DOC}/update-doc/${doc._id}`, { number: "hacked" })).status).toBe(404);
    expect((await B.admin.del(`${DOC}/delete-doc/${doc._id}`)).status).toBe(404);
    // B's own document cannot be moved onto A's truck
    const mine = (await B.admin.post(`${DOC}/create-doc`, { ownerType: "vehicle", ownerId: bb.vehicle._id, docType: "insurance", expiresAt: o.isoDay(10) })).body.doc;
    expect((await B.admin.put(`${DOC}/update-doc/${mine._id}`, { ownerId: ba.vehicle._id })).status).toBe(404);
    for (const url of [`${DOC}/get-docs`, `${DOC}/get-docs?ownerId=${ba.vehicle._id}`, `${DOC}/expiring?days=365`, `${DOC}/meta`]) {
      const r = await B.admin.get(url);
      expect(r.text.includes("A-ONLY-1"), url).toBe(false);
      expect(r.text.includes(ba.vehicle._id), url).toBe(false);
    }
    expect((await o.find("compliancedocs", { _id: doc._id }))[0]).toEqual(before);
  });
});

test.describe("maintenance, service plans and tyres (API)", () => {
  // Gives the truck an odometer of `km` by recording a job that ends there.
  const odometerAt = (admin, b, km, over = {}) =>
    admin.post("/api/v2/job/create-job", [o.jobPayload(b, { jobNumber: `ODO-${km}`, mileageOut: String(km - 100), mileageIn: String(km), distance: 100, cost: "10.00", ...over })]);

  test("@smoke @full workshop records: create, list totals (150 + 50), filter, edit, delete", async () => {
    const { t, admin } = await setup("Workshop");
    const b = await o.baseline(t, admin);
    const mk = (over) => admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-02-10", type: "service", description: "Oil", supplier: "Garage", cost: 150, ...over });
    const r1 = await mk({});
    expect(r1.status).toBe(201);
    expect((await mk({ date: "2026-03-01", type: "repair", cost: 50, odometer: 59000 })).status).toBe(201);

    const list = await admin.get(`${MNT}/get-records`);
    expect(list.body.total).toBe(200);
    expect(list.body.records).toHaveLength(2);
    expect(list.body.records[0].date.slice(0, 10)).toBe("2026-03-01"); // newest first
    expect(list.body.records[0].assetName).toBe("Toyota Dyna QAA1001");
    expect((await admin.get(`${MNT}/get-records?from=2026-03-01`)).body.total).toBe(50);
    expect((await admin.get(`${MNT}/get-records?assetId=${b.vehicle._id}&assetType=vehicle`)).body.records).toHaveLength(2);

    const up = await admin.put(`${MNT}/update-record/${r1.body.record._id}`, { cost: 175, description: "Oil and filters" });
    expect(up.status).toBe(200);
    expect((await admin.get(`${MNT}/get-records`)).body.total).toBe(225);
    expect((await admin.del(`${MNT}/delete-record/${r1.body.record._id}`)).status).toBe(200);
    expect((await admin.get(`${MNT}/get-records`)).body.total).toBe(50);
  });

  test("@full workshop record validation", async () => {
    const { t, admin } = await setup("WsVal");
    const b = await o.baseline(t, admin);
    const tr = (await admin.post(`${TRL}/create-trailer`, { regNumber: "ZZF 1" })).body.trailer;
    const mk = (over) => admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-02-10", cost: 10, ...over });
    expect((await mk({ date: "nope" })).status).toBe(400);
    expect((await mk({ date: undefined })).status).toBe(400);
    expect((await mk({ cost: -5 })).status).toBe(400);
    expect((await mk({ cost: "cheap" })).status).toBe(400);
    expect((await mk({ assetType: "plane" })).status).toBe(400);
    expect((await mk({ assetId: undefined })).status).toBe(400);
    expect((await mk({ assetType: "trailer", assetId: tr._id, odometer: 5 })).status).toBe(400);
    expect((await mk({ assetType: "trailer", assetId: tr._id })).status).toBe(201);
    expect((await mk({ planId: "000000000000000000000000" })).status).toBe(400);
    const unknownType = await mk({ type: "mystery" });
    expect(unknownType.body.record.type).toBe("service");
    expect(await o.count("maintenancerecords", { tenantId: t.companyId })).toBe(2);
  });

  test("@smoke @full service plan 'Full service' every 10,000 km: due soon at 59,500, overdue past 60,000, reset by a record", async () => {
    const { t, admin } = await setup("Plan");
    const b = await o.baseline(t, admin);
    await odometerAt(admin, b, 59500);
    const c = await admin.post(`${MNT}/create-plan`, { assetType: "vehicle", assetId: b.vehicle._id, name: "Full service", intervalKm: 10000, baselineKm: 50000 });
    expect(c.status).toBe(201);
    expect(c.body.plan).toMatchObject({ name: "Full service", kmSince: 9500, kmLeft: 500, status: "due_soon", lastDoneKm: 50000 });
    const plans = await admin.get(`${MNT}/get-plans`);
    expect(plans.body).toMatchObject({ overdue: 0, dueSoon: 1 });

    await odometerAt(admin, b, 60500);
    const over = (await admin.get(`${MNT}/get-plans`)).body;
    expect(over.plans[0]).toMatchObject({ kmSince: 10500, kmLeft: -500, status: "overdue" });
    expect(over.overdue).toBe(1);

    // a workshop record tied to the plan, at 60,500 km, resets it
    const rec = await admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-11-01", cost: 150, odometer: 60500, planId: c.body.plan._id });
    expect(rec.status).toBe(201);
    const after = (await admin.get(`${MNT}/get-plans`)).body;
    expect(after.plans[0]).toMatchObject({ kmSince: 0, status: "ok", lastDoneKm: 60500 });

    // days-based plans
    const d = await admin.post(`${MNT}/create-plan`, { assetType: "vehicle", assetId: b.vehicle._id, name: "Annual check", intervalDays: 365, baselineDate: o.isoDay(-370) });
    expect(d.body.plan).toMatchObject({ status: "overdue" });
    expect(d.body.plan.daysLeft).toBe(-5);
    expect((await admin.del(`${MNT}/delete-plan/${d.body.plan._id}`)).status).toBe(200);
    // deleting the km plan keeps its record but unlinks it
    expect((await admin.del(`${MNT}/delete-plan/${c.body.plan._id}`)).status).toBe(200);
    expect((await o.find("maintenancerecords", { _id: rec.body.record._id }))[0].planId).toBeUndefined();
    expect(t.companyId).toBeTruthy();
  });

  test("@full service plan validation", async () => {
    const { t, admin } = await setup("PlanVal");
    const b = await o.baseline(t, admin);
    const mk = (over) => admin.post(`${MNT}/create-plan`, { assetType: "vehicle", assetId: b.vehicle._id, name: "Plan", intervalKm: 5000, ...over });
    expect((await mk({ name: "" })).status).toBe(400);
    expect((await mk({ intervalKm: undefined })).status).toBe(400);
    expect((await mk({ intervalKm: 0 })).status).toBe(400);
    expect((await mk({ intervalKm: -10 })).status).toBe(400);
    expect((await mk({ intervalKm: "lots" })).status).toBe(400);
    expect((await mk({ assetId: "000000000000000000000000" })).status).toBe(404);
    expect((await mk({})).status).toBe(201);
    expect(await o.count("serviceplans", { tenantId: t.companyId })).toBe(1);
  });

  test("@smoke @full tyre T-001: 400.00 fitted at 50,000, truck at 60,000 -> 0.04 per km; fit, duplicate wheel, remove, scrap", async () => {
    const { t, admin } = await setup("Tyres");
    const b = await o.baseline(t, admin);
    await odometerAt(admin, b, 60000);
    const tyre = await admin.post(`${MNT}/create-tyre`, { serial: "T-001", brand: "Michelin", size: "315/80R22.5", condition: "new", cost: 400, purchasedAt: "2026-01-01" });
    expect(tyre.status).toBe(201);
    const id = tyre.body.tyre._id;
    expect(tyre.body.tyre).toMatchObject({ serial: "T-001", status: "in_stock", cost: 400 });

    const fit = await admin.post(`${MNT}/fit-tyre`, { tyreId: id, assetType: "vehicle", assetId: b.vehicle._id, position: "Front left", fittedOdometer: 50000, fittedAt: "2026-02-01" });
    expect(fit.status).toBe(201);
    let list = (await admin.get(`${MNT}/get-tyres`)).body.tyres;
    expect(list[0]).toMatchObject({ serial: "T-001", status: "fitted", totalKm: 10000, costPerKm: 0.04, fitments: 1 });
    expect(list[0].fittedTo).toMatchObject({ position: "Front left", assetType: "vehicle" });
    expect((await admin.get(`${MNT}/get-tyres?status=fitted`)).body.tyres).toHaveLength(1);
    expect((await admin.get(`${MNT}/get-tyres?status=in_stock`)).body.tyres).toHaveLength(0);

    // a fitted tyre cannot be fitted again, a wheel position holds one tyre, a fitted tyre keeps its history
    expect((await admin.post(`${MNT}/fit-tyre`, { tyreId: id, assetType: "vehicle", assetId: b.vehicle._id, position: "Rear", fittedOdometer: 1 })).status).toBe(409);
    const t2 = (await admin.post(`${MNT}/create-tyre`, { serial: "T-002", cost: 380 })).body.tyre;
    const clash = await admin.post(`${MNT}/fit-tyre`, { tyreId: t2._id, assetType: "vehicle", assetId: b.vehicle._id, position: "Front left" });
    expect(clash.status).toBe(409);
    expect(clash.body.message).toMatch(/already a tyre on Front left/i);
    expect((await admin.del(`${MNT}/delete-tyre/${id}`)).status).toBeGreaterThanOrEqual(400);

    // truck costs: workshop 200, tyre estimate 0.04 per km on the km driven
    await admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-02-10", cost: 150 });
    await admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-03-01", cost: 50 });
    const costs = await admin.get(`${MNT}/truck-costs?vehicleId=${b.vehicle._id}&from=2026-01-01&to=2026-12-31`);
    expect(costs.status).toBe(200);
    expect(costs.body).toMatchObject({ km: 100, maintenance: 200, tyresFitted: 1, tyresCounted: 1, tyreEstimate: 4, total: 204 });
    expect(costs.body.totalPerKm).toBe(2.04);

    // removing: odometer cannot go backwards; then it goes back to stock (or is scrapped)
    const fitmentId = fit.body.fitment._id;
    expect((await admin.post(`${MNT}/remove-tyre/${fitmentId}`, { removedOdometer: 49000 })).status).toBe(400);
    expect((await admin.post(`${MNT}/remove-tyre/${fitmentId}`, { removedAt: "2026-01-01", removedOdometer: 55000 })).status).toBe(400);
    const rm = await admin.post(`${MNT}/remove-tyre/${fitmentId}`, { removedAt: "2026-06-01", removedOdometer: 58000, reason: "worn", scrap: true });
    expect(rm.status).toBe(200);
    list = (await admin.get(`${MNT}/get-tyres?status=scrapped`)).body.tyres;
    expect(list[0]).toMatchObject({ serial: "T-001", status: "scrapped", totalKm: 8000, costPerKm: 0.05 });
    expect((await admin.post(`${MNT}/remove-tyre/${fitmentId}`, {})).status).toBe(409);
    expect((await admin.post(`${MNT}/fit-tyre`, { tyreId: id, assetType: "vehicle", assetId: b.vehicle._id, position: "Front left" })).status).toBe(409);
  });

  test("@full tyre validation: serial required and unique, an unfitted tyre can be deleted", async () => {
    const { admin } = await setup("TyreVal");
    expect((await admin.post(`${MNT}/create-tyre`, { serial: "  " })).status).toBe(400);
    expect((await admin.post(`${MNT}/create-tyre`, { serial: "T-9", cost: -1 })).status).toBe(400);
    const ok = await admin.post(`${MNT}/create-tyre`, { serial: "T-9", cost: 100, condition: "bogus" });
    expect(ok.status).toBe(201);
    expect(ok.body.tyre.condition).toBe("new");
    for (const again of ["T-9", "t-9", " T-9 "]) {
      const d = await admin.post(`${MNT}/create-tyre`, { serial: again });
      expect(d.status, again).toBe(409);
    }
    expect((await admin.put(`${MNT}/update-tyre/${ok.body.tyre._id}`, { brand: "Bridgestone", cost: 120 })).body.tyre).toMatchObject({ brand: "Bridgestone", cost: 120 });
    expect((await admin.del(`${MNT}/delete-tyre/${ok.body.tyre._id}`)).status).toBe(200);
    expect((await admin.get(`${MNT}/get-tyres`)).body.tyres).toHaveLength(0);
    const bad = await admin.post(`${MNT}/fit-tyre`, { tyreId: "000000000000000000000000", assetType: "vehicle", assetId: "000000000000000000000000", position: "x" });
    expect(bad.status).toBe(404);
  });

  test("@full Manager can use maintenance; anonymous cannot; module off blocks", async () => {
    const { t, admin, manager } = await setup("MntRoles");
    const b = await o.baseline(t, admin);
    const r = await manager.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: b.vehicle._id, date: "2026-02-10", cost: 5 });
    expect(r.status).toBe(201);
    expect((await manager.del(`${MNT}/delete-record/${r.body.record._id}`)).status).toBe(200);
    expect((await Api.anonymous().get(`${MNT}/get-records`)).status).toBe(401);
    const off = await o.makeTenant("MntOff", { modules: { maintenance: false } });
    expect((await (await off.api()).get(`${MNT}/get-records`)).status).toBe(403);
  });

  test("@smoke @full tenant B cannot read, edit, delete or attach anything to A's maintenance data", async () => {
    const A = await setup("MntXA");
    const B = await setup("MntXB");
    const ba = await o.baseline(A.t, A.admin);
    const rec = (await A.admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: ba.vehicle._id, date: "2026-02-10", cost: 99, description: "A-ONLY-WORK" })).body.record;
    const plan = (await A.admin.post(`${MNT}/create-plan`, { assetType: "vehicle", assetId: ba.vehicle._id, name: "A-ONLY-PLAN", intervalDays: 100 })).body.plan;
    const tyre = (await A.admin.post(`${MNT}/create-tyre`, { serial: "A-ONLY-TYRE", cost: 300 })).body.tyre;
    const fit = (await A.admin.post(`${MNT}/fit-tyre`, { tyreId: tyre._id, assetType: "vehicle", assetId: ba.vehicle._id, position: "P1" })).body.fitment;
    const snap = async () => JSON.stringify([
      await o.find("maintenancerecords", { _id: rec._id }), await o.find("serviceplans", { _id: plan._id }),
      await o.find("tyres", { _id: tyre._id }), await o.find("tyrefitments", { _id: fit._id }),
    ]);
    const before = await snap();

    expect((await B.admin.put(`${MNT}/update-record/${rec._id}`, { cost: 1 })).status).toBe(404);
    expect((await B.admin.del(`${MNT}/delete-record/${rec._id}`)).status).toBe(404);
    expect((await B.admin.put(`${MNT}/update-plan/${plan._id}`, { name: "hacked" })).status).toBe(404);
    expect((await B.admin.del(`${MNT}/delete-plan/${plan._id}`)).status).toBe(404);
    expect((await B.admin.put(`${MNT}/update-tyre/${tyre._id}`, { brand: "hacked" })).status).toBe(404);
    expect((await B.admin.del(`${MNT}/delete-tyre/${tyre._id}`)).status).toBe(404);
    expect((await B.admin.post(`${MNT}/remove-tyre/${fit._id}`, {})).status).toBe(404);
    // creating things on A's truck, fitting A's tyre, reading A's truck costs
    expect((await B.admin.post(`${MNT}/create-record`, { assetType: "vehicle", assetId: ba.vehicle._id, date: "2026-02-10", cost: 1 })).status).toBe(404);
    expect((await B.admin.post(`${MNT}/create-plan`, { assetType: "vehicle", assetId: ba.vehicle._id, name: "x", intervalKm: 5 })).status).toBe(404);
    const bb = await o.baseline(B.t, B.admin);
    expect((await B.admin.post(`${MNT}/fit-tyre`, { tyreId: tyre._id, assetType: "vehicle", assetId: bb.vehicle._id, position: "P1" })).status).toBe(404);
    expect((await B.admin.get(`${MNT}/truck-costs?vehicleId=${ba.vehicle._id}`)).status).toBe(404);
    for (const url of [`${MNT}/get-records`, `${MNT}/get-plans`, `${MNT}/get-tyres`, `${MNT}/meta`]) {
      const r = await B.admin.get(url);
      expect(r.text, url).not.toMatch(/A-ONLY/);
      expect(r.text.includes(ba.vehicle._id), url).toBe(false);
    }
    expect(await snap()).toBe(before);
  });
});
