/*
 * Company deletion: request with the company name, 30-day cooling-off, cancel, then the daily
 * purge removes everything. Each test uses its own tenant.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant, seedTenantData } = require("../support/tenants");
const { ctl, daysFromNow } = require("../support/control");
const { Api } = require("../support/api");
const { PASSWORD } = require("../support/env");

test.describe("company deletion", () => {
  test("@smoke @full the owner asks to delete: the name must be typed, nothing is removed, and the company keeps working", async ({ signedIn }) => {
    const t = await createTenant("Del");
    const page = await signedIn(t);
    await page.goto("/del-modules");
    await page.getByRole("button", { name: /Delete company/ }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Delete in 30 days" });
    await expect(confirm).toBeDisabled();

    // a wrong name is refused by the server
    await dialog.getByLabel("Company name").fill("Some Other Company");
    await confirm.click();
    await expect(page.getByText(/Type the company name exactly/i)).toBeVisible();
    expect((await (await t.api()).get("/api/v2/tenant/me")).body.deletion.pending).toBe(false);

    await dialog.getByLabel("Company name").fill(t.name);
    await confirm.click();
    const status = page.getByRole("status").filter({ hasText: /will be deleted on/ });
    await expect(status).toBeVisible();
    await expect(status).toContainText(/30 days left|29 days left/);

    // still fully working during the cooling-off period
    const api = await t.api();
    const me = await api.get("/api/v2/tenant/me");
    expect(me.body.deletion.pending).toBe(true);
    expect(me.body.deletion.daysLeft).toBeGreaterThanOrEqual(29);
    expect((await api.createVehicle(t.companyId, { regNumber: `DEL${t.id.toUpperCase()}` })).status).toBe(201);
    expect((await ctl("/ctl/count", { collection: "deliverers", filter: { _id: t.companyId } })).count).toBe(1);
  });

  test("@smoke @full the owner can change their mind with one click, and the request disappears", async ({ signedIn }) => {
    const t = await createTenant("DelCancel");
    const api = await t.api();
    expect((await api.post("/api/v2/tenant/deletion", { confirmName: t.name })).status).toBe(200);

    const page = await signedIn(t);
    await page.goto("/del-modules");
    await expect(page.getByRole("status").filter({ hasText: /will be deleted on/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Download my data" })).toBeVisible();
    await page.getByRole("button", { name: "Keep my company" }).click();
    await expect(page.getByText("Deletion cancelled. Nothing was removed.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete company/ })).toBeVisible();
    expect((await api.get("/api/v2/tenant/me")).body.deletion.pending).toBe(false);
  });

  test("@full only the company admin can ask; the name check ignores case and spacing; asking twice keeps the first date", async () => {
    const t = await createTenant("DelWho", {
      users: [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }],
    });
    const mgr = await t.api("manager");
    expect((await mgr.post("/api/v2/tenant/deletion", { confirmName: t.name })).status).toBe(403);
    expect((await Api.anonymous().post("/api/v2/tenant/deletion", { confirmName: t.name })).status).toBe(401);

    const admin = await t.api("admin");
    const first = await admin.post("/api/v2/tenant/deletion", { confirmName: `  ${t.name.toUpperCase()}  ` });
    expect(first.status).toBe(200);
    const second = await admin.post("/api/v2/tenant/deletion", { confirmName: t.name });
    expect(second.body.deletion.scheduledFor).toBe(first.body.deletion.scheduledFor);
    expect((await mgr.del("/api/v2/tenant/deletion")).status).toBe(403);
  });

  test("@full the pending deletion still allows the data export and works for a company whose trial has ended", async () => {
    const t = await createTenant("DelEnded", { billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-3) } });
    const api = await t.api();
    // deletion and cancelling stay possible even when every other write is paused
    expect((await api.post("/api/v2/tenant/deletion", { confirmName: t.name })).status).toBe(200);
    expect((await api.get("/api/v2/tenant/export", { raw: true })).status).toBe(200);
    expect((await api.del("/api/v2/tenant/deletion")).status).toBe(200);
  });

  test("@smoke @full when the 30 days pass, the purge removes the company, its users, its records and its files and nothing else", async () => {
    const doomed = await createTenant("Doomed", { users: [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }] });
    const survivor = await createTenant("Survivor");
    const dd = await seedTenantData(doomed);
    const sd = await seedTenantData(survivor);
    const admin = await doomed.api("admin");
    const survivorApi = await survivor.api();

    // files exist before
    expect((await admin.get(`/api/v2/files/${dd.fileKeys[0]}`, { raw: true })).status).toBe(200);
    expect((await admin.post("/api/v2/tenant/deletion", { confirmName: doomed.name })).status).toBe(200);

    // not due yet: a purge run leaves it alone
    const early = await ctl("/ctl/purge-due", {});
    expect(early.results.map((r) => String(r.companyId || r.id || "")).includes(doomed.companyId)).toBe(false);
    expect((await ctl("/ctl/count", { collection: "deliverers", filter: { _id: doomed.companyId } })).count).toBe(1);

    // the clock moves past the date
    await ctl("/ctl/deletion-date", { companyId: doomed.companyId, scheduledFor: daysFromNow(-1) });
    const run = await ctl("/ctl/purge-due", {});
    expect(JSON.stringify(run.results)).toContain(doomed.companyId);

    for (const [collection, filter] of [
      ["deliverers", { _id: doomed.companyId }],
      ["users", { companyId: doomed.companyId }],
      ["vehicles", { tenantId: doomed.companyId }],
      ["customers", { tenantId: doomed.companyId }],
      ["drivers", { tenantId: doomed.companyId }],
      ["jobs", { tenantId: doomed.companyId }],
      ["invoices", { tenantId: doomed.companyId }],
    ]) {
      expect((await ctl("/ctl/count", { collection, filter })).count, `${collection} should be empty`).toBe(0);
    }
    // nobody can sign in any more
    await expect(Api.login(doomed.admin.email, PASSWORD)).rejects.toThrow(/login .* failed/);
    expect((await admin.get("/api/v2/user/get-user")).status).toBe(401);

    // the other company is untouched
    expect((await ctl("/ctl/count", { collection: "vehicles", filter: { tenantId: survivor.companyId } })).count).toBe(1);
    const list = await survivorApi.get("/api/v2/vehicle/get-all-vehicles-company");
    expect(list.text).toContain(sd.marker);
    expect((await survivorApi.get(`/api/v2/files/${sd.fileKeys[0]}`, { raw: true })).status).toBe(200);
  });

  test("@full the scheduled-purge endpoint is closed to the public (404 without a secret configured)", async () => {
    const anon = Api.anonymous();
    expect((await anon.get("/api/v2/tenant/purge-due")).status).toBe(404);
    expect((await anon.get("/api/v2/tenant/billing-notices")).status).toBe(404);
    expect((await anon.get("/api/v2/tenant/purge-due", { headers: { authorization: "Bearer guess" } })).status).toBe(404);
  });
});
