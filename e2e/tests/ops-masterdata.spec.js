/*
 * Master data, API level: vehicles, drivers, customers, contractors.
 * Per domain: happy path (create -> list -> search -> update -> delete), validation and
 * negative cases, Admin vs Manager, anonymous, and "tenant B cannot touch it".
 */
const { test, expect } = require("../support/fixtures");
const { Api } = require("../support/api");
const o = require("../support/ops");
const { uniq } = require("../support/tenants");

const BASE = "/api/v2";
const page1 = (n) => `page=1&pageSize=${n}`;

async function lone() {
  const t = await o.makeTenant("Master");
  return { t, admin: await t.api("admin"), manager: await t.api("manager") };
}

test.describe("vehicles (API)", () => {
  test("@smoke @full create, list, search, edit and delete a vehicle", async () => {
    const { t, admin } = await lone();
    const c = await admin.post(`${BASE}/vehicle/create-vehicle`, { make: "Isuzu NPR", regNumber: "QAB2002", size: "mediumVehicle", companyId: t.companyId });
    expect(c.status).toBe(201);
    const [v] = await o.find("vehicles", { tenantId: t.companyId, regNumber: "QAB2002" });
    expect(v).toBeTruthy();
    expect(v.companyId).toBe(t.companyId);

    const list = await admin.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(10)}`);
    expect(list.body.totalCount).toBe(1);
    expect(list.body.pageVehicles[0].regNumber).toBe("QAB2002");

    const hit = await admin.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(10)}&search=isuzu`);
    expect(hit.body.totalCount).toBe(1);
    const miss = await admin.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(10)}&search=zzznomatch`);
    expect(miss.body.pageVehicles || []).toHaveLength(0);

    const up = await admin.put(`${BASE}/vehicle/update-vehicle`, { id: v._id, make: "Isuzu NPR 400", size: "largeVehicle", regNumber: "QAB2002", expectedKmPerLitre: 4 });
    expect(up.status).toBeLessThan(300);
    const [after] = await o.find("vehicles", { _id: v._id });
    expect(after.make).toBe("Isuzu NPR 400");
    expect(after.size).toBe("largeVehicle");
    expect(after.expectedKmPerLitre).toBe(4);

    const del = await admin.del(`${BASE}/vehicle/delete-vehicle/${v._id}`);
    expect(del.status).toBeLessThan(300);
    expect(await o.count("vehicles", { _id: v._id })).toBe(0);
    const [co] = await o.find("deliverers", { _id: t.companyId });
    expect(co.vehicle_ids).not.toContain(v._id);
  });

  test("@full vehicle validation: duplicate plate, missing make, bad km per litre, paging", async () => {
    const { t, admin } = await lone();
    const mk = (reg, extra = {}) => admin.post(`${BASE}/vehicle/create-vehicle`, { make: "DAF", regNumber: reg, size: "horse", companyId: t.companyId, ...extra });
    expect((await mk("DUP1001")).status).toBe(201);
    const dup = await mk("DUP1001");
    expect(dup.status).toBeGreaterThanOrEqual(400);
    expect(String(dup.body.message)).toMatch(/already in the system/i);
    expect(await o.count("vehicles", { tenantId: t.companyId, regNumber: "DUP1001" })).toBe(1);

    const noMake = await admin.post(`${BASE}/vehicle/create-vehicle`, { regNumber: "NOM1001", size: "horse", companyId: t.companyId });
    expect(noMake.status).toBe(400);
    expect(await o.count("vehicles", { tenantId: t.companyId, regNumber: "NOM1001" })).toBe(0);

    const [v] = await o.find("vehicles", { tenantId: t.companyId });
    for (const bad of [0, -1, 101, "abc"]) {
      const r = await admin.put(`${BASE}/vehicle/update-vehicle`, { id: v._id, make: "DAF", size: "horse", regNumber: "DUP1001", expectedKmPerLitre: bad });
      expect(r.status, `kmpl ${bad}`).toBe(400);
    }

    // pagination: 3 trucks, pages of 2 (this endpoint pages from 1)
    await mk("PAG1001");
    await mk("PAG2002");
    const p1 = await admin.get(`${BASE}/vehicle/get-all-vehicles-page?page=1&pageSize=2`);
    const p2 = await admin.get(`${BASE}/vehicle/get-all-vehicles-page?page=2&pageSize=2`);
    expect(p1.body.totalCount).toBe(3);
    expect(p1.body.pageVehicles).toHaveLength(2);
    expect(p2.body.pageVehicles).toHaveLength(1);
  });

  // The Vehicle model spells `required` as `requried` for regNumber, so a blank plate is accepted.
  test.fixme("@full a vehicle with a blank registration number is rejected (model typo: requried)", async () => {
    const { t, admin } = await lone();
    const r = await admin.post(`${BASE}/vehicle/create-vehicle`, { make: "DAF", regNumber: "", size: "horse", companyId: t.companyId });
    expect(r.status).toBe(400);
  });

  test.fixme("@full a vehicle with an unknown size is rejected", async () => {
    const { t, admin } = await lone();
    const r = await admin.post(`${BASE}/vehicle/create-vehicle`, { make: "DAF", regNumber: "BAD1001", size: "spaceship", companyId: t.companyId });
    expect(r.status).toBe(400);
  });

  test("@full a Manager can manage vehicles; anonymous callers cannot", async () => {
    const { t, manager } = await lone();
    const c = await manager.post(`${BASE}/vehicle/create-vehicle`, { make: "Hino", regNumber: "MGR1001", size: "largeVehicle", companyId: t.companyId });
    expect(c.status).toBe(201);
    const [v] = await o.find("vehicles", { tenantId: t.companyId, regNumber: "MGR1001" });
    expect((await manager.put(`${BASE}/vehicle/update-vehicle`, { id: v._id, make: "Hino 500", size: "largeVehicle", regNumber: "MGR1001" })).status).toBeLessThan(300);
    expect((await manager.del(`${BASE}/vehicle/delete-vehicle/${v._id}`)).status).toBeLessThan(300);

    const anon = Api.anonymous();
    expect((await anon.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(5)}`)).status).toBe(401);
    expect((await anon.post(`${BASE}/vehicle/create-vehicle`, { make: "X", regNumber: "ANO1001", size: "horse", companyId: t.companyId })).status).toBe(401);
  });

  test("@smoke @full tenant B cannot create into, edit or delete A's vehicles", async ({ world }) => {
    const { A, B, dataA } = world;
    const b = await B.api();
    const evilReg = `EVL${uniq()}`;
    const before = (await o.find("vehicles", { _id: dataA.vehicle._id }))[0];

    // naming A as the company in the body must not put the vehicle in A
    const c = await b.post(`${BASE}/vehicle/create-vehicle`, { make: "Evil", regNumber: evilReg, size: "horse", companyId: A.companyId });
    expect(c.status).toBe(201);
    const [evil] = await o.find("vehicles", { regNumber: evilReg });
    expect(evil.tenantId).toBe(B.companyId);
    expect((await o.find("deliverers", { _id: A.companyId }))[0].vehicle_ids).not.toContain(evil._id);

    const up = await b.put(`${BASE}/vehicle/update-vehicle`, { id: dataA.vehicle._id, make: "Hacked", size: "horse", regNumber: "HAX0000" });
    expect(up.status).toBe(404);
    const del = await b.del(`${BASE}/vehicle/delete-vehicle/${dataA.vehicle._id}`);
    expect(del.status).toBe(404);
    expect((await o.find("vehicles", { _id: dataA.vehicle._id }))[0]).toEqual(before);
  });

  test("@full the same plate can exist in two companies", async () => {
    const A = await o.makeTenant("PlateA");
    const B = await o.makeTenant("PlateB");
    const a = await A.api();
    const b = await B.api();
    const sam = `SAM${uniq()}`;
    expect((await a.createVehicle(A.companyId, { regNumber: sam })).status).toBe(201);
    const r = await b.post(`${BASE}/vehicle/create-vehicle`, { make: "DAF", regNumber: sam, size: "horse", companyId: B.companyId });
    expect(r.status).toBe(201);
    expect(await o.count("vehicles", { regNumber: sam })).toBe(2);
    expect((await a.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(10)}`)).body.totalCount).toBe(1);
    expect((await b.get(`${BASE}/vehicle/get-all-vehicles-page?${page1(10)}`)).body.totalCount).toBe(1);
  });
});

test.describe("customers (API)", () => {
  test("@smoke @full create, list, search, edit and delete a customer", async () => {
    const { t, admin } = await lone();
    const c = await admin.post(`${BASE}/customer/create-customer`, { name: "Delta Mining", address: "Mine Road", city: "Bindura", phoneNumber: "0771", companyId: t.companyId });
    expect(c.status).toBe(201);
    await admin.createCustomer(t.companyId, { name: "Beta Foods" });
    const [cust] = await o.find("customers", { tenantId: t.companyId, name: "Delta Mining" });

    const list = await admin.get(`${BASE}/customer/get-all-customers-page?page=0&pageSize=10`);
    expect(list.body.totalCount).toBe(2);
    const search = await admin.get(`${BASE}/customer/get-all-customers-page?page=0&pageSize=10&search=delta`);
    expect(search.body.totalCount).toBe(1);
    expect(search.body.pageCustomers[0].name).toBe("Delta Mining");
    // paging: 1 per page (this endpoint pages from 0)
    const p0 = await admin.get(`${BASE}/customer/get-all-customers-page?page=0&pageSize=1`);
    const p1 = await admin.get(`${BASE}/customer/get-all-customers-page?page=1&pageSize=1`);
    expect(p0.body.pageCustomers).toHaveLength(1);
    expect(p1.body.pageCustomers).toHaveLength(1);
    expect(p0.body.pageCustomers[0]._id).not.toBe(p1.body.pageCustomers[0]._id);

    const up = await admin.put(`${BASE}/customer/update-customer`, { id: cust._id, name: "Delta Mining Ltd", city: "Harare", address: "New Road", phoneNumber: "0772" });
    expect(up.status).toBeLessThan(300);
    expect((await o.find("customers", { _id: cust._id }))[0]).toMatchObject({ name: "Delta Mining Ltd", city: "Harare", address: "New Road" });

    expect((await admin.del(`${BASE}/customer/delete-customer/${cust._id}`)).status).toBeLessThan(300);
    expect(await o.count("customers", { _id: cust._id })).toBe(0);
  });

  test("@full customer validation: name/address required, duplicate, odd characters kept as text", async () => {
    const { t, admin } = await lone();
    const mk = (b) => admin.post(`${BASE}/customer/create-customer`, { city: "Harare", phoneNumber: "0771", companyId: t.companyId, ...b });
    expect((await mk({ name: "", address: "x" })).status).toBe(400);
    expect((await mk({ name: "No Address", address: "  " })).status).toBe(400);
    expect((await mk({ name: "Dup Co", address: "x" })).status).toBe(201);
    const dup = await mk({ name: "Dup Co", address: "x" });
    expect(dup.status).toBe(409);
    expect(await o.count("customers", { tenantId: t.companyId, name: "Dup Co" })).toBe(1);

    for (const name of ["O'Neil & Sons", "Ñandú Éxpress 🚚", `"><img src=x onerror=alert(1)>`]) {
      expect((await mk({ name, address: "x" })).status, name).toBe(201);
    }
    const all = await admin.get(`${BASE}/customer/get-all-customers-page?page=0&pageSize=50`);
    const names = all.body.pageCustomers.map((c) => c.name);
    for (const name of ["O'Neil & Sons", "Ñandú Éxpress 🚚", `"><img src=x onerror=alert(1)>`]) expect(names).toContain(name);
  });

  test("@full Manager can manage customers; anonymous cannot", async () => {
    const { t, manager } = await lone();
    expect((await manager.createCustomer(t.companyId, { name: "Mgr Customer" })).status).toBe(201);
    const [c] = await o.find("customers", { tenantId: t.companyId });
    expect((await manager.del(`${BASE}/customer/delete-customer/${c._id}`)).status).toBeLessThan(300);
    expect((await Api.anonymous().get(`${BASE}/customer/get-all-customers-page?page=0&pageSize=5`)).status).toBe(401);
  });

  test("@smoke @full tenant B cannot edit or delete A's customers, and a same-named customer is B's own", async ({ world }) => {
    const { A, B, dataA } = world;
    const b = await B.api();
    const before = (await o.find("customers", { _id: dataA.customerOne._id }))[0];
    expect((await b.put(`${BASE}/customer/update-customer`, { id: dataA.customerOne._id, name: "Hacked", city: "x", address: "x", phoneNumber: "1" })).status).toBe(404);
    expect((await b.del(`${BASE}/customer/delete-customer/${dataA.customerOne._id}`)).status).toBe(404);
    // B creating a customer with A's exact name makes a separate record, never a link to A's
    const r = await b.post(`${BASE}/customer/create-customer`, { name: dataA.customerOne.name, address: "b road", city: "Harare", phoneNumber: "1", companyId: A.companyId });
    expect(r.status).toBe(201);
    const same = await o.find("customers", { name: dataA.customerOne.name });
    expect(same).toHaveLength(2);
    expect(same.find((c) => c.tenantId === B.companyId)).toBeTruthy();
    expect((await o.find("customers", { _id: dataA.customerOne._id }))[0]).toEqual(before);
  });
});

test.describe("contractors (API)", () => {
  test("@smoke @full create, list, edit rates and delete a contractor", async () => {
    const { t, admin } = await lone();
    const vrates = JSON.stringify([{ rateType: "local", smallVehicle: 0.6, mediumVehicle: 0.9, largeVehicle: 1.2, horse: 2.5 }]);
    const f = o.form({
      companyName: "Lammel QA", address: "1 Road", city: "Harare", contact: "0771", goodsTypes: "general,fuel",
      vehiclesTypes: "small,horse", deliveryTypes: "local,express", companyId: t.companyId, prefix: "LQ", lastOrder: 1, vrates,
    });
    const c = await admin.request("POST", `${BASE}/contractor/create-contractor`, { form: f });
    expect(c.status).toBe(201);
    const [con] = await o.find("contractors", { tenantId: t.companyId, companyName: "Lammel QA" });
    expect(con).toBeTruthy();
    expect(con.prefix).toBe("LQ");

    const list = await admin.get(`${BASE}/contractor/get-all-contractors-page?${page1(10)}`);
    expect(list.body.totalCount).toBe(1);
    expect((await admin.get(`${BASE}/contractor/get-all-contractors-page?${page1(10)}&search=lammel`)).body.totalCount).toBe(1);

    const [rate] = await o.ratesOf(con._id);
    expect(rate).toBeTruthy();
    const up = await admin.put(`${BASE}/contractor/update-contractor`, {
      compId: con._id, companyName: "Lammel QA Ltd", address: "2 Road", city: "Bulawayo", contact: "0772",
      goodsTypes: ["general"], deliveryTypes: ["local"], vehiclesTypes: ["small"], rateId: rate._id,
      stringRates: JSON.stringify([{ rateType: "local", smallVehicle: 0.7, mediumVehicle: 1, largeVehicle: 1.3, horse: 2.6 }]),
    });
    expect(up.status).toBeLessThan(300);
    expect((await o.find("contractors", { _id: con._id }))[0]).toMatchObject({ companyName: "Lammel QA Ltd", city: "Bulawayo" });
    expect(JSON.stringify((await o.find("rates", { _id: rate._id }))[0].rateTypes)).toContain('"smallVehicle":0.7');

    expect((await admin.del(`${BASE}/contractor/delete-contractor/${con._id}`)).status).toBeLessThan(300);
    expect(await o.count("contractors", { _id: con._id })).toBe(0);
  });

  test("@full contractor validation: bad rates JSON, duplicate name, wrong rate id", async () => {
    const { t, admin } = await lone();
    const body = (over = {}) => o.form({
      companyName: "Dupe Haulage", address: "1", city: "H", contact: "1", goodsTypes: "g", vehiclesTypes: "small",
      deliveryTypes: "local", companyId: t.companyId, prefix: "DH", lastOrder: 0, vrates: "[]", ...over,
    });
    const post = (over) => admin.request("POST", `${BASE}/contractor/create-contractor`, { form: body(over) });
    expect((await post({ vrates: "{not json" })).status).toBe(400);
    expect(await o.count("contractors", { tenantId: t.companyId })).toBe(0);
    expect((await post()).status).toBe(201);
    const dup = await post();
    expect(dup.status).toBeGreaterThanOrEqual(400);
    expect(await o.count("contractors", { tenantId: t.companyId, companyName: "Dupe Haulage" })).toBe(1);

    const [con] = await o.find("contractors", { tenantId: t.companyId });
    const badRate = await admin.put(`${BASE}/contractor/update-contractor`, {
      compId: con._id, companyName: "X", address: "1", city: "H", contact: "1", goodsTypes: ["g"], deliveryTypes: ["l"],
      vehiclesTypes: ["small"], rateId: "000000000000000000000000", stringRates: "[]",
    });
    expect(badRate.status).toBe(400);
    expect((await o.find("contractors", { _id: con._id }))[0].companyName).toBe("Dupe Haulage");
  });

  test("@full Manager can manage contractors; anonymous cannot", async () => {
    const { t, manager } = await lone();
    expect((await manager.createContractor(t.companyId, { companyName: "Mgr Contractor" })).status).toBe(201);
    const [c] = await o.find("contractors", { tenantId: t.companyId });
    expect((await manager.del(`${BASE}/contractor/delete-contractor/${c._id}`)).status).toBeLessThan(300);
    expect((await Api.anonymous().get(`${BASE}/contractor/get-all-contractors-page?${page1(5)}`)).status).toBe(401);
  });

  test("@smoke @full tenant B cannot edit or delete A's contractor", async ({ world }) => {
    const { B, dataA } = world;
    const b = await B.api();
    const before = (await o.find("contractors", { _id: dataA.contractor._id }))[0];
    expect((await b.del(`${BASE}/contractor/delete-contractor/${dataA.contractor._id}`)).status).toBe(404);
    const [rate] = await o.ratesOf(dataA.contractor._id);
    const up = await b.put(`${BASE}/contractor/update-contractor`, {
      compId: dataA.contractor._id, companyName: "Hacked", address: "1", city: "H", contact: "1", goodsTypes: ["g"],
      deliveryTypes: ["l"], vehiclesTypes: ["s"], rateId: rate._id, stringRates: "[]",
    });
    expect(up.status).toBe(404);
    expect((await o.find("contractors", { _id: dataA.contractor._id }))[0]).toEqual(before);
  });
});

test.describe("drivers and uploaded documents (API)", () => {
  const post = (api, fd) => api.request("POST", `${BASE}/driver/create-driver`, { form: fd });
  const byName = async (name, tenantId) => (await o.find("drivers", { name, tenantId }))[0];

  test("@smoke @full create a driver with licence and ID, read the files back, edit, delete removes the files", async () => {
    const { t, admin } = await lone();
    const r = await post(admin, o.driverForm(t.companyId, { name: "Tendai", idNumber: "63-1234567X63" }));
    expect(r.status).toBe(201);
    const d = await byName("Tendai", t.companyId);
    expect(d.license).toMatch(/^tenants\/[a-f0-9]{24}\/driver-licence\/.+\.jpg$/);
    expect(d.id).toMatch(/^tenants\/[a-f0-9]{24}\/driver-id\/.+\.jpg$/);
    expect(d.license.split("/")[1]).toBe(t.companyId);

    const file = await admin.get(`${BASE}/files/${d.license}`, { raw: true });
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/jpeg");
    expect(file.headers.get("cache-control")).toMatch(/no-store/);
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(file.buffer.equals(o.JPEG)).toBe(true);

    const list = await admin.get(`${BASE}/driver/get-all-drivers-page?${page1(10)}`);
    expect(list.body.totalCount).toBe(1);
    expect((await admin.get(`${BASE}/driver/get-all-drivers-page?${page1(10)}&search=tend`)).body.totalCount).toBe(1);

    // edit without files keeps them; edit with a new licence replaces (and removes) the old one
    const e1 = await admin.request("PUT", `${BASE}/driver/update-driver`, { form: o.form({ driverId: d._id, name: "Tendai M", city: "Mutare" }) });
    expect(e1.status).toBeLessThan(300);
    let now = (await o.find("drivers", { _id: d._id }))[0];
    expect(now).toMatchObject({ name: "Tendai M", city: "Mutare", license: d.license, id: d.id });

    const e2 = await admin.request("PUT", `${BASE}/driver/update-driver`, {
      form: o.form({ driverId: d._id }, { license: { buffer: o.PNG, type: "image/png", name: "new.png" } }),
    });
    expect(e2.status).toBeLessThan(300);
    now = (await o.find("drivers", { _id: d._id }))[0];
    expect(now.license).not.toBe(d.license);
    expect(now.license).toMatch(/\.png$/);
    expect((await admin.get(`${BASE}/files/${d.license}`)).status).toBe(404);
    expect((await admin.get(`${BASE}/files/${now.license}`, { raw: true })).headers.get("content-type")).toBe("image/png");

    expect((await admin.del(`${BASE}/driver/delete-driver/${d._id}`)).status).toBeLessThan(300);
    expect(await o.count("drivers", { _id: d._id })).toBe(0);
    expect((await admin.get(`${BASE}/files/${now.license}`)).status).toBe(404);
    expect((await admin.get(`${BASE}/files/${d.id}`)).status).toBe(404);
  });

  test("@full driver validation: both documents required, duplicate ID number, nothing stored on failure", async () => {
    const { t, admin } = await lone();
    const noFiles = await post(admin, o.driverForm(t.companyId, { name: "Nofiles" }, {}));
    expect(noFiles.status).toBe(400);
    const onlyLicence = await post(admin, o.driverForm(t.companyId, { name: "Half" }, { license: { buffer: o.JPEG, name: "l.jpg" } }));
    expect(onlyLicence.status).toBe(400);
    expect(await o.count("drivers", { tenantId: t.companyId })).toBe(0);

    expect((await post(admin, o.driverForm(t.companyId, { name: "First", idNumber: "SAME-1" }))).status).toBe(201);
    const dup = await post(admin, o.driverForm(t.companyId, { name: "Second", idNumber: "SAME-1" }));
    expect(dup.status).toBe(409);
    expect(await o.count("drivers", { tenantId: t.companyId })).toBe(1);
  });

  test("@smoke @full upload rules: type is decided by the bytes, size limit is 4 MB", async () => {
    const { t, admin } = await lone();
    const withFiles = (name, license, id = { buffer: o.JPEG, name: "id.jpg" }) =>
      post(admin, o.driverForm(t.companyId, { name, idNumber: `ID-${name}` }, { license, id }));

    // accepted: JPG, PNG, WebP, PDF
    for (const [label, buffer, type, name] of [
      ["png", o.PNG, "image/png", "a.png"],
      ["webp", o.WEBP, "image/webp", "a.webp"],
      ["pdf", o.PDF, "application/pdf", "a.pdf"],
      ["jpg3mb", o.jpegOfSize(3 * 1024 * 1024), "image/jpeg", "big.jpg"],
    ]) {
      const r = await withFiles(`ok-${label}`, { buffer, type, name });
      expect(r.status, label).toBe(201);
    }
    // the stored extension follows the real type
    const pdfDriver = await byName("ok-pdf", t.companyId);
    expect(pdfDriver.license).toMatch(/\.pdf$/);
    expect((await admin.get(`${BASE}/files/${pdfDriver.license}`, { raw: true })).headers.get("content-type")).toBe("application/pdf");

    // rejected: wrong bytes behind an image name/MIME, SVG with script, executable, empty
    for (const [label, buffer, type, name] of [
      ["text-as-jpg", o.TEXT_AS_JPG, "image/jpeg", "fake.jpg"],
      ["exe-as-jpg", o.EXE_AS_JPG, "image/jpeg", "evil.jpg"],
      ["svg", o.SVG_WITH_SCRIPT, "image/svg+xml", "x.svg"],
      ["svg-as-png-mime", o.SVG_WITH_SCRIPT, "image/png", "x.png"],
      ["empty", Buffer.alloc(0), "image/jpeg", "empty.jpg"],
    ]) {
      const r = await withFiles(`bad-${label}`, { buffer, type, name });
      expect(r.status, label).toBeGreaterThanOrEqual(400);
      expect(r.status, label).toBeLessThan(500);
    }
    // over the limit: a 4.5 MB PDF and a 10 MB PDF
    for (const mb of [4.5, 10]) {
      const r = await withFiles(`big-${mb}`, { buffer: o.pdfOfSize(mb * 1024 * 1024), type: "application/pdf", name: "big.pdf" });
      expect(r.status, `${mb} MB`).toBeGreaterThanOrEqual(400);
      expect(r.status, `${mb} MB`).toBeLessThan(500);
    }
    // none of the rejected drivers exist
    expect(await o.count("drivers", { tenantId: t.companyId, name: { $regex: "^(bad|big)-" } })).toBe(0);
  });

  test("@full the file route is private: anonymous, other company, bad keys", async ({ world }) => {
    const { A, B, dataA } = world;
    const key = dataA.fileKeys[0];
    const a = await A.api();
    const b = await B.api();
    expect((await a.get(`${BASE}/files/${key}`)).status).toBe(200);
    expect((await b.get(`${BASE}/files/${key}`)).status).toBe(404);
    expect((await Api.anonymous().get(`${BASE}/files/${key}`)).status).toBe(401);
    expect((await a.get(`${BASE}/files/tenants/${A.companyId}/driver-id/not-a-uuid.jpg`)).status).toBe(404);
    expect((await a.get(`${BASE}/files/..%2F..%2Fpackage.json`)).status).toBe(404);
    expect((await a.get(`${BASE}/files/tenants/${A.companyId}/../${B.companyId}/driver-id/x.jpg`)).status).toBe(404);
  });

  test("@full a Manager can manage drivers; anonymous cannot", async () => {
    const { t, manager } = await lone();
    expect((await manager.createDriver(t.companyId, { name: "Mgr Driver", idNumber: "M-1" })).status).toBe(201);
    const d = await byName("Mgr Driver", t.companyId);
    expect((await manager.del(`${BASE}/driver/delete-driver/${d._id}`)).status).toBeLessThan(300);
    expect((await Api.anonymous().get(`${BASE}/driver/get-all-drivers-page?${page1(5)}`)).status).toBe(401);
  });

  test("@smoke @full tenant B cannot edit, delete or read the documents of A's driver", async ({ world }) => {
    const { B, dataA } = world;
    const b = await B.api();
    const before = (await o.find("drivers", { _id: dataA.driver._id }))[0];
    const up = await b.request("PUT", `${BASE}/driver/update-driver`, {
      form: o.form({ driverId: dataA.driver._id, name: "Hacked" }, { license: { buffer: o.PNG, type: "image/png", name: "x.png" } }),
    });
    expect(up.status).toBe(404);
    expect((await b.del(`${BASE}/driver/delete-driver/${dataA.driver._id}`)).status).toBe(404);
    expect((await o.find("drivers", { _id: dataA.driver._id }))[0]).toEqual(before);
    for (const key of dataA.fileKeys) expect((await b.get(`${BASE}/files/${key}`)).status).toBe(404);
    // the same ID number in another company is a different person record
    const r = await post(b, o.driverForm(B.companyId, { name: "Same Id", idNumber: dataA.driver.idNumber }));
    expect(r.status).toBe(201);
  });
});
