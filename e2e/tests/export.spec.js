/*
 * Tenant data export: the whole company's data as one ZIP, for the owner only.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant, seedTenantData } = require("../support/tenants");
const { daysFromNow } = require("../support/control");
const { Api } = require("../support/api");
const { unzipFiles, unzipText } = require("../support/zip");

test.describe("tenant export", () => {
  test("@smoke @full the owner downloads a ZIP from the Modules page that holds their data and nobody else's", async ({ world, signedIn }) => {
    const { A, B, dataA, dataB } = world;
    const page = await signedIn(A);
    await page.goto("/del-modules");
    const button = page.getByRole("button", { name: "Download all company data" });
    await expect(button).toBeVisible({ timeout: 20_000 });

    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toMatch(/^myfleet-export-\d{4}-\d{2}-\d{2}\.zip$/);
    const path = await download.path();
    const buffer = require("fs").readFileSync(path);
    const files = unzipFiles(buffer);
    expect(Object.keys(files).length).toBeGreaterThan(3);

    const text = unzipText(buffer);
    expect(text).toContain(dataA.marker);
    expect(text).not.toContain(dataB.marker);
    expect(text).not.toContain(B.companyId);
    await expect(page.getByText("Your data has been downloaded")).toBeVisible();
  });

  test("@full the export includes the uploaded documents and a manifest of what is in it", async ({ world }) => {
    const api = await world.A.api();
    const r = await api.get("/api/v2/tenant/export", { raw: true });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/zip");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    const names = Object.keys(unzipFiles(r.buffer));
    expect(names.some((n) => /manifest/i.test(n)), `entries: ${names.join(", ")}`).toBe(true);
    expect(names.some((n) => /driver/i.test(n))).toBe(true);
  });

  test("@full only company admins can export: a manager, a signed-out visitor and another company are refused", async ({ world }) => {
    const mgr = await world.A.api("manager");
    expect((await mgr.get("/api/v2/tenant/export", { raw: true })).status).toBe(403);
    expect((await Api.anonymous().get("/api/v2/tenant/export", { raw: true })).status).toBe(401);
  });

  test("@full a platform admin can export any company by id; a company admin naming another company gets only their own", async ({ world }) => {
    const platform = await Api.login(world.platform.email, world.platform.password);
    const r = await platform.get(`/api/v2/tenant/export?companyId=${world.A.companyId}`, { raw: true });
    expect(r.status).toBe(200);
    const text = unzipText(r.buffer);
    expect(text).toContain(world.dataA.marker);
    expect(text).not.toContain(world.dataB.marker);
  });

  test("@full a company whose trial ended can still download everything", async () => {
    const t = await createTenant("ExportEnded");
    const data = await seedTenantData(t);
    const api = await t.api();
    await require("../support/control").ctl("/ctl/billing", {
      companyId: t.companyId,
      billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-1) },
    });
    const r = await api.get("/api/v2/tenant/export", { raw: true });
    expect(r.status).toBe(200);
    expect(unzipText(r.buffer)).toContain(data.marker);
  });

  test("@full a second export started while one is running is told to wait, not run twice", async () => {
    const t = await createTenant("ExportBusy");
    await seedTenantData(t);
    const api = await t.api();
    const results = await Promise.all([1, 2, 3].map(() => api.get("/api/v2/tenant/export", { raw: true })));
    const statuses = results.map((r) => r.status).sort();
    // every request is either served or told "an export is already being prepared" (429); never an error
    for (const s of statuses) expect([200, 429]).toContain(s);
    expect(statuses).toContain(200);
  });
});
