/*
 * Platform admin console (Super Admin / Site Admin) and the create-admin flow.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant, uniq } = require("../support/tenants");
const { ctl, daysFromNow } = require("../support/control");
const { Api } = require("../support/api");
const { PASSWORD } = require("../support/env");

// MUI marks the page behind an open dialog aria-hidden, so toasts are found by attribute, not by role.
const toast = (page, text) => page.locator('[role="status"]').filter({ hasText: text });
const row = (page, name) => page.getByRole("row").filter({ hasText: name });

test.describe("admin console", () => {
  test("@smoke @full a platform admin sees every company with its plan and status, and can search", async ({ world, signedInAs }) => {
    const t1 = await createTenant("ConsoleOne");
    const t2 = await createTenant("ConsoleTwo", { billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-1) } });
    const page = await signedInAs(world.platform.email, world.platform.password);
    await page.goto("/del-admin-console");
    await expect(page.getByRole("heading", { name: /admin console/i })).toBeVisible({ timeout: 20_000 });
    await expect(row(page, t1.name)).toContainText("Trial");
    await expect(row(page, t1.name)).toContainText(t1.admin.email);
    await expect(row(page, t2.name)).toContainText("Read-only");
    await expect(page.getByText("Companies", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Search company, owner or city").fill(t2.name);
    await expect(row(page, t2.name)).toBeVisible();
    await expect(row(page, t1.name)).toHaveCount(0);
  });

  test("@smoke @full extending a trial from the console un-pauses a read-only company and is written to its history", async ({ world, signedInAs }) => {
    const t = await createTenant("ConsoleExtend", { billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-1) } });
    const owner = await t.api();
    expect((await owner.get("/api/v2/tenant/me")).body.billing.writable).toBe(false);

    const page = await signedInAs(world.platform.email, world.platform.password);
    await page.goto("/del-admin-console");
    await row(page, t.name).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(t.name);
    await dialog.getByRole("button", { name: "Extend trial 14 days" }).click();
    await expect(toast(page, "Trial extended 14 days")).toBeVisible();
    await expect(dialog).toContainText(/billing update/i);

    const me = await owner.get("/api/v2/tenant/me");
    expect(me.body.billing.writable).toBe(true);
    expect(me.body.billing.state).toBe("trial");
  });

  test("@full mark paid, suspend and restore from the console change what the company can do", async ({ world, signedInAs }) => {
    const t = await createTenant("ConsolePay");
    const owner = await t.api();
    const page = await signedInAs(world.platform.email, world.platform.password);
    await page.goto("/del-admin-console");
    await row(page, t.name).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(toast(page, "Suspended")).toBeVisible();
    expect((await owner.get("/api/v2/tenant/me")).body.billing.state).toBe("suspended");
    expect((await owner.post("/api/v2/vehicle/create-vehicle", { make: "X", regNumber: `S${uniq()}`, size: "horse", companyId: t.companyId })).status).toBe(403);

    await dialog.getByRole("button", { name: "Restore" }).click();
    await expect(toast(page, "Restored")).toBeVisible();
    expect((await owner.get("/api/v2/tenant/me")).body.billing.state).toBe("trial");

    await dialog.getByRole("button", { name: "Mark paid, +30 days" }).click();
    await expect(toast(page, /^Paid until/)).toBeVisible();
    const billing = (await owner.get("/api/v2/tenant/me")).body.billing;
    expect(billing.state).toBe("active");
    expect(new Date(billing.paidUntil).getTime()).toBeGreaterThan(Date.now() + 28 * 86400000);
  });

  test("@full a platform admin can schedule and cancel a company's deletion from the console", async ({ world, signedInAs }) => {
    const t = await createTenant("ConsoleDelete");
    const page = await signedInAs(world.platform.email, world.platform.password);
    page.on("dialog", (d) => d.accept()); // the "schedule deletion in 30 days?" confirm
    await page.goto("/del-admin-console");
    await row(page, t.name).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Schedule deletion" }).click();
    await expect(toast(page, "Deletion scheduled")).toBeVisible();
    await expect(dialog).toContainText(/Scheduled for/);
    expect((await (await t.api()).get("/api/v2/tenant/me")).body.deletion.pending).toBe(true);

    await dialog.getByRole("button", { name: "Cancel deletion" }).click();
    await expect(toast(page, "Deletion cancelled")).toBeVisible();
    expect((await (await t.api()).get("/api/v2/tenant/me")).body.deletion.pending).toBe(false);
  });

  test("@smoke @full company users get no console: the page says so and every console API answers 403", async ({ world, signedIn }) => {
    const page = await signedIn(world.A);
    await page.goto("/del-admin-console");
    await expect(page.getByText("This page is for platform admins.")).toBeVisible({ timeout: 20_000 });
    for (const key of ["admin", "manager"]) {
      const api = await world.A.api(key);
      for (const path of ["/api/v2/admin/companies", "/api/v2/admin/summary"]) {
        expect((await api.get(path)).status, `${key} ${path}`).toBe(403);
      }
      expect((await api.put("/api/v2/tenant/billing", { companyId: world.A.companyId, band: "pro" })).status).toBe(403);
    }
    expect((await Api.anonymous().get("/api/v2/admin/companies")).status).toBe(401);
  });

  test("@full the summary counts companies by state", async ({ world }) => {
    await createTenant("SummaryTrial");
    await createTenant("SummaryEnded", { billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-5) } });
    const platform = await Api.login(world.platform.email, world.platform.password);
    const r = await platform.get("/api/v2/admin/summary");
    expect(r.status).toBe(200);
    expect(r.body.summary.companies).toBeGreaterThanOrEqual(4);
    expect(r.body.summary.byState.trial).toBeGreaterThanOrEqual(1);
    expect(r.body.summary.byState.read_only).toBeGreaterThanOrEqual(1);
  });
});

test.describe("create-admin", () => {
  const body = (over = {}) => ({
    name: "Added Person",
    email: `added.${uniq()}@e2e.test`,
    phoneNumber: "0771",
    address: "a",
    city: "c",
    role: "Deliverer Manager",
    password: PASSWORD,
    ...over,
  });

  test("@smoke @full a company admin adds a teammate to their own company, who can then sign in", async () => {
    const t = await createTenant("AddAdmin");
    const api = await t.api();
    const payload = body();
    // even if the request names another company, the new person joins the caller's
    const other = await createTenant("AddAdminOther");
    const r = await api.post("/api/v2/user/create-admin", { ...payload, companyId: other.companyId });
    expect(r.status).toBe(201);
    const added = (await ctl("/ctl/find", { collection: "users", filter: { email: payload.email } })).docs[0];
    expect(added.companyId).toBe(t.companyId);

    const login = await Api.login(payload.email, PASSWORD);
    const me = await login.me();
    expect(me.delivererName).toBe(t.name);
    expect(me.user.role).toBe("Deliverer Manager");
  });

  test("@smoke @full a company admin cannot create a platform admin, and managers and strangers cannot create anyone", async ({ world }) => {
    const admin = await world.A.api("admin");
    for (const role of ["Super Admin", "Site Admin"]) {
      const r = await admin.post("/api/v2/user/create-admin", body({ role }));
      expect(r.status, role).toBe(403);
    }
    expect((await admin.post("/api/v2/user/create-admin", body({ role: "Not A Role" }))).status).toBe(400);
    const manager = await world.A.api("manager");
    expect((await manager.post("/api/v2/user/create-admin", body())).status).toBe(403);
    expect((await Api.anonymous().post("/api/v2/user/create-admin", body())).status).toBe(401);
    // and nothing was created by any of the refused attempts
    expect((await ctl("/ctl/count", { collection: "users", filter: { companyId: world.A.companyId, role: "Super Admin" } })).count).toBe(0);
  });

  test("@full a platform admin creates an admin for any company, and platform admins for the platform", async ({ world }) => {
    const t = await createTenant("PlatformAdds");
    const platform = await Api.login(world.platform.email, world.platform.password);
    const forCompany = body({ role: "Deliverer Admin", companyId: t.companyId });
    expect((await platform.post("/api/v2/user/create-admin", forCompany)).status).toBe(201);
    const docs = (await ctl("/ctl/find", { collection: "users", filter: { email: forCompany.email } })).docs;
    expect(docs[0].companyId).toBe(t.companyId);
    expect(docs[0].role).toBe("Deliverer Admin");

    const sa = body({ role: "Site Admin", companyId: t.companyId });
    expect((await platform.post("/api/v2/user/create-admin", sa)).status).toBe(201);
    const siteAdmin = await Api.login(sa.email, PASSWORD);
    expect((await siteAdmin.get("/api/v2/admin/companies")).status).toBe(200);
  });

  test("@full create-admin rejects duplicates, weak passwords and missing fields", async ({ world }) => {
    const admin = await world.A.api("admin");
    const first = body();
    expect((await admin.post("/api/v2/user/create-admin", first)).status).toBe(201);
    expect((await admin.post("/api/v2/user/create-admin", first)).status).toBe(400); // same email
    expect((await admin.post("/api/v2/user/create-admin", body({ password: "short" }))).status).toBe(400);
    expect((await admin.post("/api/v2/user/create-admin", body({ name: "" }))).status).toBe(400);
  });
});
