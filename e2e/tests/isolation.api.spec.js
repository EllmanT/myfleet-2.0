/*
 * Multi-tenancy isolation, API level. The most important suite in this folder.
 *
 * Tenant A has one of everything. Tenant B signs in with a REAL session (the same cookie the
 * browser holds) and attacks A with A's real ids: reading, editing, deleting, issuing and
 * downloading. Two things must always hold:
 *   1. nothing B receives contains anything that belongs to A (its names, ids, files)
 *   2. nothing A owns changes (compared document-for-document before and after)
 *
 * Every list endpoint also has a positive control: A's own session DOES see A's marker there, so
 * a passing "B sees nothing" cannot be a broken endpoint that returns nothing to anyone.
 */
const { test, expect } = require("../support/fixtures");
const { ctl } = require("../support/control");
const { Api } = require("../support/api");

const snapshot = (companyId) => ctl("/ctl/snapshot", { companyId });
const leaks = (text, data, tenant) => {
  const found = [];
  if (text.includes(data.marker)) found.push(`marker ${data.marker}`);
  if (text.includes(tenant.name)) found.push(`company name ${tenant.name}`);
  return found;
};

test.describe("tenant isolation (API)", () => {
  test("@smoke @full B's session cannot read A's lists, and A's own session can (positive control)", async ({ world }) => {
    const { A, B, dataA } = world;
    const a = await A.api();
    const b = await B.api();
    const lists = [
      "/api/v2/vehicle/get-all-vehicles-company",
      "/api/v2/vehicle/get-all-vehicles-page?page=0&pageSize=50",
      "/api/v2/customer/get-all-customers-company",
      "/api/v2/customer/get-all-customers-page?page=0&pageSize=50",
      "/api/v2/contractor/get-all-contractors-deliverer",
      "/api/v2/contractor/get-all-contractors-page?page=0&pageSize=50",
      "/api/v2/driver/get-all-drivers-company",
      "/api/v2/job/get-all-jobs-page?page=0&pageSize=50",
      "/api/v2/job/get-latest-jobs-deliverer",
      "/api/v2/job/get-all-jobsReport-deliverer",
      "/api/v2/invoice/get-invoices",
      "/api/v2/invoice/meta",
      "/api/v2/invoice/receivables",
      "/api/v2/invoice/unbilled",
      "/api/v2/tenant/me",
      "/api/v2/tenant/setup",
      "/api/v2/overallStats/get-all-overallStats-company",
      `/api/v2/overallStats/get-all-overallStats-company?companyId=${A.companyId}`,
      `/api/v2/vehicle/get-all-vehicles-company?companyId=${A.companyId}`,
      `/api/v2/customer/get-all-customers-page?page=0&pageSize=50&companyId=${A.companyId}`,
      `/api/v2/job/get-latest-jobs-deliverer?companyId=${A.companyId}`,
      `/api/v2/invoice/get-invoices?tenantId=${A.companyId}`,
      "/api/v2/user/get-all-admins-page?page=0&pageSize=50",
    ];
    // Endpoints whose answer names A's records, so A must see the marker (proves they work).
    const controls = new Set([
      "/api/v2/vehicle/get-all-vehicles-company",
      "/api/v2/customer/get-all-customers-company",
      "/api/v2/contractor/get-all-contractors-deliverer",
      "/api/v2/driver/get-all-drivers-company",
      "/api/v2/invoice/get-invoices",
    ]);
    for (const url of lists) {
      const asA = await a.get(url);
      const asB = await b.get(url);
      expect(asB.status, `B ${url}`).toBeLessThan(500);
      expect(leaks(asB.text, dataA, A), `B ${url} leaked`).toEqual([]);
      for (const id of [A.companyId, dataA.vehicle._id, dataA.customerOne._id, dataA.driver._id, dataA.job._id, dataA.invoice._id]) {
        expect(asB.text.includes(id), `B ${url} contains A id ${id}`).toBe(false);
      }
      if (controls.has(url)) {
        expect(asA.status, `A ${url}`).toBeLessThan(300);
        expect(asA.text.includes(dataA.marker), `control: A should see its own data at ${url}`).toBe(true);
      }
    }
  });

  test("@smoke @full B cannot read, edit or delete A's records by id, and A is unchanged afterwards", async ({ world }) => {
    const { A, B, dataA } = world;
    const b = await B.api();
    const before = await snapshot(A.companyId);

    const v = dataA.vehicle._id;
    const c = dataA.customerOne._id;
    const d = dataA.driver._id;
    const j = dataA.job._id;
    const k = dataA.contractor._id;
    const inv = dataA.invoice._id;
    const attacks = [
      ["GET", `/api/v2/vehicleStats/get-vehicleStats/${v}`],
      ["PUT", "/api/v2/vehicle/update-vehicle", { id: v, make: "HACKED", size: "horse", regNumber: "HACKED" }],
      ["DELETE", `/api/v2/vehicle/delete-vehicle/${v}`],
      ["PUT", "/api/v2/customer/update-customer", { id: c, name: "HACKED", address: "x", city: "x", phoneNumber: "1" }],
      ["DELETE", `/api/v2/customer/delete-customer/${c}`],
      ["PUT", "/api/v2/driver/update-driver", { driverId: d, name: "HACKED", phoneNumber: "1", city: "x", address: "x", idNumber: "x" }],
      ["DELETE", `/api/v2/driver/delete-driver/${d}`],
      ["PUT", "/api/v2/contractor/update-contractor", { id: k, contractorId: k, companyName: "HACKED" }],
      ["DELETE", `/api/v2/contractor/delete-contractor/${k}`],
      ["PUT", "/api/v2/job/update-job", { jobId: j, description: "HACKED" }],
      ["DELETE", `/api/v2/job/delete-job/${j}`],
      ["GET", `/api/v2/job/get-latest-jobs-vehicle/${v}`],
      ["GET", `/api/v2/job/get-latest-jobs-driver/${d}`],
      ["GET", `/api/v2/job/get-latest-jobs-contractor/${k}`],
      ["GET", `/api/v2/job/get-all-jobsReport-vehicle/${v}`],
      ["GET", `/api/v2/driverStats/get-driverStats/${d}`],
      ["GET", `/api/v2/contractorStats/get-contractorStats/${k}`],
      ["GET", `/api/v2/invoice/get-invoice/${inv}`],
      ["PUT", `/api/v2/invoice/update-invoice/${inv}`, { customerName: "HACKED", lines: [{ description: "x", quantity: 1, unitPrice: 1 }] }],
      ["POST", `/api/v2/invoice/issue/${inv}`],
      ["POST", `/api/v2/invoice/void/${inv}`],
      ["POST", `/api/v2/invoice/credit-note/${inv}`],
      ["GET", `/api/v2/invoice/pdf/${inv}`],
      ["DELETE", `/api/v2/invoice/delete-invoice/${inv}`],
      // company-level controls
      ["PUT", "/api/v2/tenant/billing", { companyId: A.companyId, status: "suspended" }],
      ["GET", "/api/v2/admin/companies"],
      ["GET", "/api/v2/admin/summary"],
      ["GET", `/api/v2/admin/companies/${A.companyId}/audit`],
      ["POST", `/api/v2/admin/companies/${A.companyId}/deletion`, {}],
      ["DELETE", `/api/v2/admin/companies/${A.companyId}/deletion`],
      ["POST", "/api/v2/tenant/deletion", { confirmName: A.name }],
    ];

    for (const [method, url, body] of attacks) {
      const r = await b.request(method, url, body ? { json: body } : {});
      expect(r.status, `${method} ${url} should be refused, got ${r.status}: ${String(r.text).slice(0, 160)}`).toBeGreaterThanOrEqual(400);
      expect(r.status, `${method} ${url}`).toBeLessThan(500);
      expect(leaks(String(r.text), dataA, A), `${method} ${url} leaked`).toEqual([]);
    }

    // A "leaky" answer can also be a 2xx that returns the caller's own, empty data. Those are
    // checked in the list test above; here the proof that matters is that A did not change.
    const after = await snapshot(A.companyId);
    expect(after).toEqual(before);
  });

  test("@full B cannot name A as the owner when creating records (the session decides the company)", async ({ world }) => {
    const { A, B } = world;
    const b = await B.api();
    const before = await snapshot(A.companyId);
    const plate = `INJ${B.id.toUpperCase()}`;
    // companyId in the body points at A; the server must put the record in B.
    await b.createVehicle(A.companyId, { regNumber: plate });
    await b.createCustomer(A.companyId, { name: `${plate} Customer` });
    const inB = await ctl("/ctl/find", { collection: "vehicles", filter: { regNumber: plate } });
    expect(inB.docs).toHaveLength(1);
    expect(inB.docs[0].tenantId).toBe(B.companyId);
    const cust = await ctl("/ctl/find", { collection: "customers", filter: { name: `${plate} Customer` } });
    expect(cust.docs[0].tenantId).toBe(B.companyId);
    expect(await snapshot(A.companyId)).toEqual(before);

    // and a job that points at A's vehicle/driver/customers must be refused
    const bData = world.dataB;
    const r = await b.post("/api/v2/job/create-job", [
      {
        jobNumber: `X${B.id}`,
        from: bData.customerOne._id,
        customer: bData.customerTwo._id,
        description: "cross tenant",
        deliveryType: "standard",
        orderDate: new Date().toISOString(),
        contractorId: bData.contractor._id,
        vehicleId: world.dataA.vehicle._id, // A's truck
        driverId: bData.driver._id,
        mileageOut: "1",
        mileageIn: "2",
        distance: 1,
        cost: "1.00",
      },
    ]);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await snapshot(A.companyId)).toEqual(before);
  });

  test("@smoke @full A's private files (driver licence and ID) answer 404 to B and 401 to nobody", async ({ world }) => {
    const { A, B, dataA } = world;
    const a = await A.api();
    const b = await B.api();
    for (const key of dataA.fileKeys) {
      expect(key, "seed should have stored a private file key").toMatch(/^tenants\/[0-9a-f]{24}\//);
      const own = await a.get(`/api/v2/files/${key}`, { raw: true });
      expect(own.status, `A should read its own file ${key}`).toBe(200);
      expect(own.headers.get("content-type")).toContain("image/jpeg");

      const foreign = await b.get(`/api/v2/files/${key}`, { raw: true });
      expect(foreign.status, `B must not read A's file ${key}`).toBe(404);

      const anon = await Api.anonymous().get(`/api/v2/files/${key}`, { raw: true });
      expect(anon.status).toBe(401);
    }
    // path tricks: B naming A's tenant folder with traversal, and a made-up key under A's folder
    const traversal = `tenants/${B.companyId}/../${A.companyId}/driver-id/${dataA.fileKeys[0].split("/").pop()}`;
    expect((await b.get(`/api/v2/files/${traversal}`, { raw: true })).status).toBe(404);
    expect((await b.get(`/api/v2/files/${dataA.fileKeys[0]}%00.jpg`, { raw: true })).status).toBeGreaterThanOrEqual(400);
  });

  test("@full B's export contains B's data only, even when it asks for A's company", async ({ world }) => {
    const { A, B, dataA, dataB } = world;
    const b = await B.api();
    const r = await b.get(`/api/v2/tenant/export?companyId=${A.companyId}`, { raw: true });
    expect(r.status).toBe(200);
    const { unzipText } = require("../support/zip");
    const text = unzipText(r.buffer);
    expect(text.includes(dataB.marker), "B's export should contain B's own data").toBe(true);
    expect(text.includes(dataA.marker), "B's export leaked A's data").toBe(false);
    expect(text.includes(A.companyId), "B's export mentions A's company id").toBe(false);
  });

  test("@full a company manager cannot do admin-only things in their own company or A's", async ({ world }) => {
    const { A, B } = world;
    const mgr = await B.api("manager");
    expect((await mgr.get("/api/v2/tenant/export", { raw: true })).status).toBe(403);
    expect((await mgr.post("/api/v2/tenant/deletion", { confirmName: B.name })).status).toBe(403);
    expect((await mgr.put("/api/v2/tenant/billing", { companyId: B.companyId, status: "suspended" })).status).toBe(403);
    expect((await mgr.get("/api/v2/admin/companies")).status).toBe(403);
    expect((await mgr.post("/api/v2/user/create-admin", { name: "x" })).status).toBe(403);
    expect((await mgr.get(`/api/v2/admin/companies/${A.companyId}/audit`)).status).toBe(403);
  });

  test("@full Clerk session path: a token for org B can never act inside company A", async ({ world }) => {
    // Uses the stubbed Clerk SDK (see README). A user linked to B, presenting a session whose
    // active organization is A, is bounced to re-bootstrap instead of reaching A's data.
    const { A, B, dataA } = world;
    const { uniq } = require("../support/tenants");
    const suffix = uniq();
    const orgA = `org_A_${suffix}`;
    const orgB = `org_B_${suffix}`;
    await ctl("/ctl/clerk/org", { orgId: orgA, name: A.name });
    await ctl("/ctl/clerk/org", { orgId: orgB, name: B.name });
    // link the orgs to the existing companies, then sign in as a fresh Clerk user in org B
    await ctl("/ctl/clerk/user", { userId: `user_${suffix}`, email: `clerk.${suffix}@e2e.test` });
    const tenantB = await require("../support/tenants").createTenant("ClerkB", { clerkOrgId: orgB, users: [] });
    const tenantA = await require("../support/tenants").createTenant("ClerkA", { clerkOrgId: orgA, users: [] });
    await ctl("/ctl/clerk/org", { orgId: orgB, name: tenantB.name });
    await ctl("/ctl/clerk/org", { orgId: orgA, name: tenantA.name });

    const mint = async (orgId, orgRole = "org:admin") =>
      (await ctl("/ctl/clerk/token", { userId: `user_${suffix}`, orgId, orgRole })).token;
    const anon = Api.anonymous();

    const tokenB = await mint(orgB);
    const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: tokenB });
    expect(boot.status).toBe(200);
    expect(String(boot.body.user.companyId)).toBe(tenantB.companyId);
    const okB = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: tokenB });
    expect(okB.status).toBeLessThan(300);

    // same person, token now claims org A: not their company, so the API demands a bootstrap
    // (which would move them if they were a member; never silently grant A's data first)
    const tokenA = await mint(orgA);
    const denied = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: tokenA });
    expect(denied.status).toBe(401);
    expect(denied.body.message).toMatch(/switching company/i);
    expect(denied.text.includes(dataA.marker)).toBe(false);
  });
});
