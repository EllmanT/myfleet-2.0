/*
 * Login, logout and session expiry.
 *
 * The browser build used here has no Clerk key, so it uses the email/password cookie login that
 * still exists beside Clerk. Clerk's own sign-in UI cannot run offline; its server-side half
 * (Bearer session handling) is covered with the stubbed SDK further down and in onboarding.spec.js.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant, stateWithToken } = require("../support/tenants");
const { PASSWORD } = require("../support/env");
const { sign } = require("../support/jwt");
const { Api } = require("../support/api");
const { ctl } = require("../support/control");

test.describe("login", () => {
  test("@smoke @full a user signs in with email and password and lands on their dashboard", async ({ page }) => {
    const t = await createTenant("Login");
    await page.goto("/login");
    await page.getByLabel("Email").fill(t.admin.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/del-dashboard/);
    await expect(page.getByText(t.admin.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(t.name).first()).toBeVisible();
  });

  test("@smoke @full a wrong password is refused with one generic message", async ({ page }) => {
    const t = await createTenant("BadPw");
    await page.goto("/login");
    await page.getByLabel("Email").fill(t.admin.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // an unknown email gets the very same message (no account discovery)
    await page.getByLabel("Email").fill("nobody@e2e.test");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("Invalid email or password").first()).toBeVisible();
  });

  test("@full the login API refuses operator injection and empty fields", async () => {
    const anon = Api.anonymous();
    const inj = await anon.post("/api/v2/user/login-user", { email: { $ne: null }, password: { $ne: null } });
    expect(inj.status).toBe(400);
    const empty = await anon.post("/api/v2/user/login-user", { email: "", password: "" });
    expect(empty.status).toBe(400);
  });

  test("@smoke @full a signed-out visitor is sent to the login page from any company page", async ({ page }) => {
    for (const url of ["/del-dashboard", "/del-vehicles", "/del-invoices", "/del-admin-console"]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/login/);
    }
  });

  test("@full a user who is already signed in keeps their session across a reload", async ({ signedIn }) => {
    const t = await createTenant("Reload");
    const page = await signedIn(t);
    await page.goto("/del-dashboard");
    await expect(page.getByText(t.name).first()).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText(t.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/del-dashboard/);
  });
});

test.describe("logout", () => {
  test("@full dropping the session cookie (what logout does) sends the user back to login", async ({ signedIn }) => {
    const t = await createTenant("Logout");
    const page = await signedIn(t);
    await page.goto("/del-dashboard");
    await expect(page.getByText(t.name).first()).toBeVisible({ timeout: 20_000 });
    await page.context().clearCookies();
    await page.goto("/del-vehicles");
    await expect(page).toHaveURL(/\/login/);
    // the API agrees: no cookie, no data
    const r = await page.request.get("/api/v2/vehicle/get-all-vehicles-company");
    expect(r.status()).toBe(401);
  });

  // KNOWN GAP (reported in e2e/README.md): in cookie mode the menu's "Logout" item only re-opens
  // the menu and no /user/logout route exists. Production uses Clerk's signOut, which this
  // offline harness cannot drive. When a real cookie logout is added, turn this into a normal test.
  test.fixme("@full the Logout menu item ends a cookie session", async ({ signedIn }) => {
    const t = await createTenant("LogoutMenu");
    const page = await signedIn(t);
    await page.goto("/del-dashboard");
    await page.getByText(t.admin.name).first().click();
    await page.getByRole("menuitem", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("session expiry", () => {
  test("@smoke @full an expired session cookie is refused by the API with a clear message", async () => {
    const t = await createTenant("Expired");
    const expired = sign({ id: t.admin.id }, { expiresInSec: -60 });
    const r = await Api.withToken(expired).get("/api/v2/user/get-user");
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/session expired/i);
  });

  test("@full a forged cookie (wrong secret), a tampered cookie and a deleted user are all refused", async () => {
    const t = await createTenant("Forged");
    const forged = sign({ id: t.admin.id }, { secret: "not-the-secret" });
    expect((await Api.withToken(forged).get("/api/v2/user/get-user")).status).toBe(401);

    const good = (await t.api()).token;
    const [h, p, s] = good.split(".");
    const tampered = `${h}.${Buffer.from(JSON.stringify({ id: "000000000000000000000000", iat: 1, exp: 9999999999 })).toString("base64url")}.${s}`;
    expect((await Api.withToken(tampered).get("/api/v2/user/get-user")).status).toBe(401);
    void p;

    const ghost = sign({ id: "0123456789abcdef01234567" });
    const r = await Api.withToken(ghost).get("/api/v2/user/get-user");
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/session expired/i);

    const none = await Api.anonymous().get("/api/v2/user/get-user");
    expect(none.status).toBe(401);
    expect(none.body.message).toMatch(/login to continue/i);
  });

  test("@smoke @full the app drops a user whose session expires while they are on a page", async ({ browser }) => {
    const t = await createTenant("MidSession");
    const good = (await t.api()).token;
    const context = await browser.newContext({ storageState: stateWithToken(good) });
    const page = await context.newPage();
    await page.goto("/del-dashboard");
    await expect(page.getByText(t.name).first()).toBeVisible({ timeout: 20_000 });

    // the session cookie is swapped for an expired one; the next page load must not show data
    await context.clearCookies();
    await context.addCookies(stateWithToken(sign({ id: t.admin.id }, { expiresInSec: -60 })).cookies);
    await page.goto("/del-vehicles");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await context.close();
  });

  test("@full a session for a user that was removed stops working at once", async () => {
    const t = await createTenant("Removed", { users: [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }] });
    const mgr = await t.api("manager");
    expect((await mgr.get("/api/v2/user/get-user")).status).toBe(200);
    const admin = await t.api("admin");
    const del = await admin.del(`/api/v2/user/delete-admin/${t.users.manager.id}`);
    expect(del.status, JSON.stringify(del.body)).toBeLessThan(300);
    expect((await mgr.get("/api/v2/user/get-user")).status).toBe(401);
  });
});

test.describe("Clerk session handling (stubbed SDK)", () => {
  test("@smoke @full a Bearer token that is not a valid Clerk session is refused", async () => {
    const anon = Api.anonymous();
    const r = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: "garbage" });
    expect(r.status).toBe(401);
    const b = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: "garbage" });
    expect(b.status).toBe(401);
  });

  test("@full bootstrap needs a session, and a signed-in user with no organisation must pick one first", async () => {
    const { uniq } = require("../support/tenants");
    const s = uniq();
    await ctl("/ctl/clerk/user", { userId: `user_${s}`, email: `noorg.${s}@e2e.test`, firstName: "No", lastName: "Org" });
    const { token } = await ctl("/ctl/clerk/token", { userId: `user_${s}` });
    const anon = Api.anonymous();
    const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: token });
    expect(boot.status).toBe(200);
    expect(boot.body.needsOrganization).toBe(true);
    const data = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: token });
    expect(data.status).toBe(401);
    expect(data.body.message).toMatch(/choose or create a company/i);
  });
});
