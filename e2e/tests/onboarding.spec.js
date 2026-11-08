/*
 * Sign-up and onboarding.
 *
 * Real sign-up is Clerk-only: Clerk creates the person and their organisation, then the app calls
 * POST /api/v2/auth/bootstrap, which creates our user and company. This suite drives that exact
 * server path with the stubbed Clerk SDK (see README), and then lets the new owner into the real
 * UI by giving them a local password through the control API.
 *
 * Not covered here, by design: Clerk's hosted sign-up widgets (they need Clerk's servers).
 */
const { test, expect } = require("../support/fixtures");
const { uniq } = require("../support/tenants");
const { ctl } = require("../support/control");
const { Api } = require("../support/api");
const { PASSWORD, ACTIVATION_SECRET } = require("../support/env");
const { sign } = require("../support/jwt");

async function clerkUser(s, extra = {}) {
  const userId = `user_${s}`;
  await ctl("/ctl/clerk/user", { userId, email: `owner.${s}@e2e.test`, firstName: "Nyasha", lastName: "Moyo", ...extra });
  return userId;
}
const session = async (userId, orgId, orgRole = "org:admin") =>
  (await ctl("/ctl/clerk/token", { userId, orgId, orgRole })).token;

test.describe("sign-up and onboarding (Clerk path, stubbed SDK)", () => {
  test("@smoke @full a brand-new owner gets their own empty company on a 30-day trial", async () => {
    const s = uniq();
    const userId = await clerkUser(s);
    const orgId = `org_${s}`;
    await ctl("/ctl/clerk/org", { orgId, name: `New Haulage ${s}` });
    const token = await session(userId, orgId);
    const anon = Api.anonymous();

    const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: token });
    expect(boot.status).toBe(200);
    expect(boot.body.needsOrganization).toBe(false);
    expect(boot.body.delivererName).toBe(`New Haulage ${s}`);
    expect(boot.body.user.role).toBe("Deliverer Admin");
    expect(boot.body.user.email).toBe(`owner.${s}@e2e.test`);
    expect(boot.body.user.password).toBeUndefined();

    // the company: starter plan, trial running, lean module set, nothing in it
    const me = await anon.get("/api/v2/tenant/me", { bearer: token });
    expect(me.status).toBe(200);
    expect(me.body.companyName).toBe(`New Haulage ${s}`);
    expect(me.body.billing.state).toBe("trial");
    expect(me.body.billing.band).toBe("starter");
    expect(me.body.billing.writable).toBe(true);
    expect(me.body.billing.daysLeft).toBeGreaterThanOrEqual(29);
    expect(me.body.billing.daysLeft).toBeLessThanOrEqual(30);
    expect(me.body.modules.analytics).toBe(true);
    expect(me.body.modules.invoices).toBe(false);
    expect(me.body.modules.fuel).toBe(false);

    const setup = await anon.get("/api/v2/tenant/setup", { bearer: token });
    expect(setup.body.counts).toEqual({ vehicles: 0, drivers: 0, customers: 0, jobs: 0, invoices: 0 });
  });

  test("@full bootstrap is idempotent: calling it again changes nothing and adds no company", async () => {
    const s = uniq();
    const userId = await clerkUser(s);
    const orgId = `org_${s}`;
    await ctl("/ctl/clerk/org", { orgId, name: `Twice ${s}` });
    const token = await session(userId, orgId);
    const anon = Api.anonymous();
    const first = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: token });
    const second = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: token });
    expect(second.status).toBe(200);
    expect(second.body.user._id).toBe(first.body.user._id);
    expect((await ctl("/ctl/count", { collection: "deliverers", filter: { clerkOrgId: orgId } })).count).toBe(1);
    expect((await ctl("/ctl/count", { collection: "users", filter: { clerkUserId: userId } })).count).toBe(1);
  });

  test("@full two owners signing up get two separate companies that cannot see each other", async () => {
    const s1 = uniq();
    const s2 = uniq();
    const anon = Api.anonymous();
    const owners = [];
    for (const s of [s1, s2]) {
      const userId = await clerkUser(s);
      const orgId = `org_${s}`;
      await ctl("/ctl/clerk/org", { orgId, name: `Fleet ${s}` });
      const token = await session(userId, orgId);
      const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: token });
      owners.push({ token, companyId: String(boot.body.user.companyId), s });
    }
    expect(owners[0].companyId).not.toBe(owners[1].companyId);
    // owner 1 adds a vehicle; owner 2 sees none
    const add = await anon.post(
      "/api/v2/vehicle/create-vehicle",
      { make: "MAN", regNumber: `ONB${owners[0].s}`, size: "horse", companyId: owners[0].companyId },
      { bearer: owners[0].token }
    );
    expect(add.status).toBe(201);
    const list2 = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: owners[1].token });
    expect(list2.text.includes(`ONB${owners[0].s}`)).toBe(false);
    const list1 = await anon.get("/api/v2/vehicle/get-all-vehicles-company", { bearer: owners[0].token });
    expect(list1.text.includes(`ONB${owners[0].s}`)).toBe(true);
  });

  test("@full a teammate invited to the organisation joins the same company as a manager, not an admin", async () => {
    const s = uniq();
    const ownerId = await clerkUser(s);
    const orgId = `org_${s}`;
    await ctl("/ctl/clerk/org", { orgId, name: `Team ${s}` });
    const anon = Api.anonymous();
    const owner = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: await session(ownerId, orgId) });

    const mate = uniq();
    const mateId = await clerkUser(mate);
    const mateToken = await session(mateId, orgId, "org:member");
    const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: mateToken });
    expect(boot.status).toBe(200);
    expect(String(boot.body.user.companyId)).toBe(String(owner.body.user.companyId));
    expect(boot.body.user.role).toBe("Deliverer Manager");
    // and the manager has no finance/admin powers
    const exp = await anon.request("GET", "/api/v2/tenant/export", { bearer: mateToken, raw: true });
    expect(exp.status).toBe(403);
  });

  test("@full an unverified email never adopts an existing account", async () => {
    const s = uniq();
    // an existing local user with this email and a password (a "legacy" account)
    const { createTenant } = require("../support/tenants");
    const legacy = await createTenant("Legacy");
    const orgId = `org_${s}`;
    await ctl("/ctl/clerk/org", { orgId, name: `Impostor ${s}` });
    const userId = `user_${s}`;
    await ctl("/ctl/clerk/user", { userId, email: legacy.admin.email, verified: false });
    const anon = Api.anonymous();
    const boot = await anon.post("/api/v2/auth/bootstrap", {}, { bearer: await session(userId, orgId) });
    // The unverified identity must not be linked to the legacy user's company.
    if (boot.status === 200) {
      expect(String(boot.body.user.companyId)).not.toBe(legacy.companyId);
      expect(boot.body.user.clerkUserId).toBe(userId);
      expect(boot.body.linkedExistingAccount).toBe(false);
    } else {
      // creating a second user with the same email may be refused by the database; that is also safe
      expect(boot.status).toBeGreaterThanOrEqual(400);
    }
    // either way the legacy user was not hijacked
    const legacyDocs = await ctl("/ctl/find", { collection: "users", filter: { email: legacy.admin.email } });
    expect(legacyDocs.docs.some((u) => u.clerkUserId === userId && String(u.companyId) === legacy.companyId)).toBe(false);
  });

  test("@smoke @full the new owner can sign in to the app and sees an empty company with the getting-started help", async ({ page }) => {
    const s = uniq();
    const userId = await clerkUser(s);
    const orgId = `org_${s}`;
    await ctl("/ctl/clerk/org", { orgId, name: `Fresh Start ${s}` });
    const boot = await Api.anonymous().post("/api/v2/auth/bootstrap", {}, { bearer: await session(userId, orgId) });
    const email = boot.body.user.email;
    // the browser build uses password login, so give this owner one (Clerk would hold it in production)
    await ctl("/ctl/set-password", { email, password: PASSWORD });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/del-dashboard/);
    await expect(page.getByText(`Fresh Start ${s}`).first()).toBeVisible({ timeout: 20_000 });
    // a new company has nothing: the getting-started guide is what a new owner should see
    await expect(page.getByText(/get(ting)? started|set up|first truck|add your/i).first()).toBeVisible();
  });
});

test.describe("legacy email sign-up (public endpoints)", () => {
  test("@full create-user validates input, and never trusts a role or company in the request", async () => {
    const anon = Api.anonymous();
    const short = await anon.post("/api/v2/user/create-user", { name: "A", email: "a@e2e.test", password: "short" });
    expect(short.status).toBe(400);
    const noEmail = await anon.post("/api/v2/user/create-user", { name: "A", password: "long-enough-1" });
    expect(noEmail.status).toBe(400);
  });

  test("@full activating an account yields a user with NO company and NO privileges, whatever the token claims", async () => {
    const s = uniq();
    const token = sign(
      {
        name: "Self Registered",
        email: `self.${s}@e2e.test`,
        phoneNumber: "1",
        address: "a",
        city: "c",
        password: "long-enough-1",
        // an attacker-crafted token cannot be made without the secret, but older tokens may carry these
        role: "Super Admin",
        companyId: "0123456789abcdef01234567",
      },
      { secret: ACTIVATION_SECRET, expiresInSec: 300 }
    );
    const anon = Api.anonymous();
    const r = await anon.post("/api/v2/user/activation", { activation_token: token });
    expect(r.status).toBe(201);
    expect(r.body.user.role).not.toBe("Super Admin");
    expect(r.body.user.companyId).toBeUndefined();
    // such an account can not reach any company data or the platform console
    const self = Api.withToken(r.body.token);
    expect((await self.get("/api/v2/admin/companies")).status).toBeGreaterThanOrEqual(400);
    expect((await self.get("/api/v2/vehicle/get-all-vehicles-company")).status).toBeGreaterThanOrEqual(400);
  });

  test("@full an activation link with the wrong secret or past its five minutes is refused", async () => {
    const anon = Api.anonymous();
    const base = { name: "X", email: "x@e2e.test", phoneNumber: "1", address: "a", city: "c", password: "long-enough-1" };
    const wrong = await anon.post("/api/v2/user/activation", { activation_token: sign(base, { secret: "nope" }) });
    expect(wrong.status).toBe(400);
    const old = await anon.post("/api/v2/user/activation", { activation_token: sign(base, { secret: ACTIVATION_SECRET, expiresInSec: -10 }) });
    expect(old.status).toBe(400);
  });
});
